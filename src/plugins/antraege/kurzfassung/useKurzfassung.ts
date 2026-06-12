/**
 * Orchestriert die Kurzfassung-Sektion auf **Verbund-Ebene**: lädt VB-Status +
 * persistierten Record, prüft LLM-Verfügbarkeit, fährt Generierung/Modifier/
 * Prüfung/Freigabe und persistiert nach jedem Statuswechsel (nie während der
 * Generierung).
 *
 * Alle Aktionen sind self-catching (Pitfall #15): Fehler landen im `error`-State
 * (→ Banner), nicht in einer verschluckten Promise-Rejection.
 */
import { useEffect, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { runSkill, type SkillModifierKey } from '@/core/services/skills';
import { getVbCharCap } from '@/core/services/ai/llm-context';
import { getLlmThinkingBudget } from '@/core/services/ai/llm-thinking';
import {
  loadSkillRegistry,
  getSkillById,
  resolveRegeln,
  runRegelChecks,
  KURZFASSUNG_SKILL_ID,
  SEED_SKILL,
  SEED_REGELN,
  type QualitaetsRegel,
  type SkillRecord,
} from '@/core/services/skill-registry';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { loadSkillTweak, saveSkillTweak, deleteSkillTweak, type SkillTweak } from '@/core/services/skill-tweaks';
import type { DocumentFull } from '@/plugins/dokumente/store';
import { findVorhabensbeschreibung } from './vbDokument';
import { getKurzfassung, putKurzfassung, deleteKurzfassung } from './kurzfassung-store';
import { appendVerlauf, restoreVersion } from './kurzfassung-verlauf';
import type { KurzfassungContext, KurzfassungRecord } from './types';

/** Eingaben des Tweak-Editors (User-Tweaks v2) beim Speichern. */
export interface TweakEingabe {
  stilHinweise: string;
  beispielFormulierungen: string;
  aktiv: boolean;
}

export interface KurzfassungController {
  record: KurzfassungRecord | null;
  vbDokument: DocumentFull | null;
  vbVorhanden: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  /** null = noch nicht geprüft. */
  llmAvailable: boolean | null;
  /** Aufgelöster Skill (Registry-Cache oder Seed-Fallback) — für Version + Tweak-Editor. */
  skill: SkillRecord | null;
  /** Zugeordnete Qualitätsregeln — für die „So wird es der KI mitgegeben"-Vorschau. */
  regeln: QualitaetsRegel[];
  /** Persönlicher Tweak des Nutzers für diesen Skill (User-Tweaks v2), lokal. */
  tweak: SkillTweak | null;
  generate: () => void;
  modify: (modifier: SkillModifierKey) => void;
  pruefen: () => void;
  freigeben: () => void;
  verwerfen: () => void;
  /** Eine Vorfassung (Index in `record.verlauf`) wieder zur aktiven Fassung machen. */
  uebernehmen: (index: number) => void;
  refreshVb: () => void;
  stop: () => void;
  clearError: () => void;
  /** Tweak speichern (setzt `angelegtFuerSkillVersion` = aktuelle Skill-Version). Wirft bei Fehler. */
  saveTweak: (eingabe: TweakEingabe) => Promise<void>;
  /** Tweak entfernen. Wirft bei Fehler. */
  removeTweak: () => Promise<void>;
  /** Versions-Hinweis für die aktuelle Skill-Version wegklicken (Close-X). */
  dismissVersionHint: () => void;
}

function buildStammdaten(ctx: KurzfassungContext): string {
  const nn = '[Im Antrag nicht genannt]';
  const lines = [
    `- Förderkennzeichen (Verbund): ${ctx.foerderkennzeichen}`,
    `- Akronym: ${ctx.akronym}`,
    `- Verbund-Titel: ${ctx.titel ?? nn}`,
    `- Konsortialführer: ${ctx.antragsteller ?? nn}`,
  ];
  if (ctx.teilvorhaben.length > 0) {
    lines.push(`- Teilvorhaben (${ctx.teilvorhaben.length}):`);
    for (const tv of ctx.teilvorhaben) {
      lines.push(`  - TV ${tv.nr} (${tv.aktenzeichen}, ${tv.antragsteller ?? nn}): ${tv.titel ?? nn}`);
    }
  }
  return lines.join('\n');
}

export function useKurzfassung(ctx: KurzfassungContext): KurzfassungController {
  const storage = useStorage();
  const bridge = useAIBridge();
  const key = ctx.key;

  const [record, setRecord] = useState<KurzfassungRecord | null>(null);
  const [vbDokument, setVbDokument] = useState<DocumentFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(null);
  const [skillCtx, setSkillCtx] = useState<{ skill: SkillRecord; regeln: QualitaetsRegel[] } | null>(null);
  const [tweak, setTweak] = useState<SkillTweak | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [rec, vb, loaded] = await Promise.all([
        getKurzfassung(storage.idb, key),
        findVorhabensbeschreibung(storage.idb, key),
        loadSkillRegistry(storage),
      ]);
      if (cancelled) return;
      // Skill aus der Registry (Cache-Pfad). Fehlt er (noch nicht kuratiert /
      // gelöscht), Fallback auf den eingebauten Seed.
      const found = getSkillById(loaded.file, KURZFASSUNG_SKILL_ID);
      const skill = found ?? SEED_SKILL;
      setSkillCtx(found
        ? { skill: found, regeln: resolveRegeln(loaded.file, found) }
        : { skill: SEED_SKILL, regeln: SEED_REGELN });
      setRecord(rec);
      setVbDokument(vb);
      // Persönlicher Tweak (User-Tweaks v2): IDB-Cache → ggf. persönl. Ordner (LWW).
      // getPersoenlichHandle liest nur den gespeicherten Handle (kein Prompt); ohne
      // Ordner/Permission liefert loadSkillTweak den IDB-Cache (in dev: null).
      const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
      const loadedTweak = await loadSkillTweak(storage.idb, persHandle, skill.id).catch(() => null);
      if (cancelled) return;
      setTweak(loadedTweak);
      setLoading(false);
      // LLM-Probe nur, wenn Generierung relevant ist (VB da, noch nicht freigegeben).
      // DirectLLM.ping = billiger /v1/models-Fetch; aktive Streamlit-Bridge würde
      // ihr Fenster öffnen (Edge-Case, in den llama.cpp-Konfigs irrelevant).
      if (vb && (!rec || rec.status !== 'freigegeben')) {
        try { if (!cancelled) setLlmAvailable(await bridge.getActiveTransport().ping()); }
        catch { if (!cancelled) setLlmAvailable(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [key, storage.idb, bridge]);

  const runGeneration = async (modifier?: SkillModifierKey): Promise<void> => {
    if (!vbDokument || busy || !skillCtx) return;
    setBusy(true);
    setError(null);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const transport = bridge.getActiveTransport();
      const ok = await transport.ping();
      setLlmAvailable(ok);
      if (!ok) {
        setError('KI nicht erreichbar — Generierung derzeit nicht möglich.');
        return;
      }
      // Tweak nur einspeisen, wenn aktiv UND nicht leer — dann ist auch `mitTweak`
      // korrekt (composeSkillPrompt würde sonst keinen Block emittieren).
      const tweakWirksam = !!(tweak?.aktiv && (tweak.stilHinweise.trim() || tweak.beispielFormulierungen.trim()));
      const result = await runSkill(transport, skillCtx.skill, skillCtx.regeln, {
        stammdaten: buildStammdaten(ctx),
        vbMarkdown: vbDokument.markdown,
        vbCharCap: getVbCharCap(),
        thinkingBudget: getLlmThinkingBudget(),
        ...(tweakWirksam ? { tweak } : {}),
        ...(modifier ? { modifier } : {}),
        ...(modifier && record ? { vorherigerText: record.finalerText } : {}),
        signal: abort.signal,
      });
      const rec: KurzfassungRecord = {
        key,
        quellenanalyse: result.parsed.quellenanalyse,
        entwurf: result.parsed.entwurf,
        finalerText: result.parsed.finalerText,
        checks: runRegelChecks(result.parsed.finalerText, skillCtx.regeln),
        status: 'entwurf',
        erstellt_am: new Date().toISOString(),
        modell: transport.name,
        skillId: skillCtx.skill.id,
        skillVersion: skillCtx.skill.version,
        vbGekuerzt: result.vbGekuerzt,
        // Die noch aktive Fassung wandert vor dem Überschreiben in den Verlauf.
        verlauf: appendVerlauf(record),
        ...(modifier ? { modifier } : {}),
        ...(tweakWirksam ? { mitTweak: true, tweakGeaendertAm: tweak!.geaendert_am } : {}),
        ...(result.parsed.warnung ? { warnung: result.parsed.warnung } : {}),
        ...(result.thinking ? { denkprozess: result.thinking } : {}),
      };
      setRecord(rec);
      await putKurzfassung(storage.idb, rec); // Persist NACH der Generierung
    } catch (err) {
      if (abort.signal.aborted) return; // bewusster Stop ist kein Fehler
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const pruefen = async (): Promise<void> => {
    if (!record || !skillCtx) return;
    try {
      const rec: KurzfassungRecord = { ...record, checks: runRegelChecks(record.finalerText, skillCtx.regeln) };
      setRecord(rec);
      await putKurzfassung(storage.idb, rec);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const freigeben = async (): Promise<void> => {
    if (!record) return;
    try {
      const rec: KurzfassungRecord = { ...record, status: 'freigegeben', freigegeben_am: new Date().toISOString() };
      setRecord(rec);
      await putKurzfassung(storage.idb, rec);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const verwerfen = async (): Promise<void> => {
    try {
      setRecord(null);
      await deleteKurzfassung(storage.idb, key);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const uebernehmen = async (index: number): Promise<void> => {
    if (!record) return;
    try {
      const rec = restoreVersion(record, index);
      if (rec === record) return; // Out-of-range — nichts zu tun
      setRecord(rec);
      await putKurzfassung(storage.idb, rec);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const refreshVb = async (): Promise<void> => {
    const vb = await findVorhabensbeschreibung(storage.idb, key);
    setVbDokument(vb);
    if (vb && llmAvailable === null) {
      try { setLlmAvailable(await bridge.getActiveTransport().ping()); }
      catch { setLlmAvailable(false); }
    }
  };

  // --- User-Tweaks v2: persönliche Stil-Schicht (lokal, IDB + best-effort Spiegel) ---

  const saveTweak = async (eingabe: TweakEingabe): Promise<void> => {
    if (!skillCtx) return;
    const next: SkillTweak = {
      skillId: skillCtx.skill.id,
      angelegtFuerSkillVersion: skillCtx.skill.version,
      aktiv: eingabe.aktiv,
      stilHinweise: eingabe.stilHinweise,
      beispielFormulierungen: eingabe.beispielFormulierungen,
      geaendert_am: new Date().toISOString(),
    };
    const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
    await saveSkillTweak(storage.idb, persHandle, next);
    setTweak(next);
  };

  const removeTweak = async (): Promise<void> => {
    if (!skillCtx) return;
    const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
    await deleteSkillTweak(storage.idb, persHandle, skillCtx.skill.id);
    setTweak(null);
  };

  const dismissVersionHint = async (): Promise<void> => {
    if (!skillCtx || !tweak) return;
    try {
      const next: SkillTweak = { ...tweak, hinweisAusgeblendetFuerVersion: skillCtx.skill.version };
      const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
      await saveSkillTweak(storage.idb, persHandle, next);
      setTweak(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return {
    record,
    vbDokument,
    vbVorhanden: vbDokument !== null,
    loading,
    busy,
    error,
    llmAvailable,
    skill: skillCtx?.skill ?? null,
    regeln: skillCtx?.regeln ?? [],
    tweak,
    generate: () => { void runGeneration(); },
    modify: (m) => { void runGeneration(m); },
    pruefen: () => { void pruefen(); },
    freigeben: () => { void freigeben(); },
    verwerfen: () => { void verwerfen(); },
    uebernehmen: (i) => { void uebernehmen(i); },
    refreshVb: () => { void refreshVb(); },
    stop: () => abortRef.current?.abort(),
    clearError: () => setError(null),
    saveTweak,
    removeTweak,
    dismissVersionHint: () => { void dismissVersionHint(); },
  };
}
