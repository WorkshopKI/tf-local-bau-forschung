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
import { kurzfassungSkill, runSkill, type SkillModifierKey } from '@/core/services/skills';
import type { DocumentFull } from '@/plugins/dokumente/store';
import { findVorhabensbeschreibung } from './vbDokument';
import { getKurzfassung, putKurzfassung, deleteKurzfassung } from './kurzfassung-store';
import type { KurzfassungContext, KurzfassungRecord } from './types';

export interface KurzfassungController {
  record: KurzfassungRecord | null;
  vbDokument: DocumentFull | null;
  vbVorhanden: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  /** null = noch nicht geprüft. */
  llmAvailable: boolean | null;
  generate: () => void;
  modify: (modifier: SkillModifierKey) => void;
  pruefen: () => void;
  freigeben: () => void;
  verwerfen: () => void;
  refreshVb: () => void;
  stop: () => void;
  clearError: () => void;
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
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [rec, vb] = await Promise.all([
        getKurzfassung(storage.idb, key),
        findVorhabensbeschreibung(storage.idb, key),
      ]);
      if (cancelled) return;
      setRecord(rec);
      setVbDokument(vb);
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
    if (!vbDokument || busy) return;
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
      const result = await runSkill(transport, kurzfassungSkill, {
        stammdaten: buildStammdaten(ctx),
        vbMarkdown: vbDokument.markdown,
        ...(modifier ? { modifier } : {}),
        ...(modifier && record ? { vorherigerText: record.finalerText } : {}),
        signal: abort.signal,
      });
      const rec: KurzfassungRecord = {
        key,
        quellenanalyse: result.parsed.quellenanalyse,
        entwurf: result.parsed.entwurf,
        finalerText: result.parsed.finalerText,
        checks: kurzfassungSkill.runChecks(result.parsed.finalerText),
        status: 'entwurf',
        erstellt_am: new Date().toISOString(),
        modell: transport.name,
        vbGekuerzt: result.vbGekuerzt,
        ...(result.parsed.warnung ? { warnung: result.parsed.warnung } : {}),
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
    if (!record) return;
    try {
      const rec: KurzfassungRecord = { ...record, checks: kurzfassungSkill.runChecks(record.finalerText) };
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

  const refreshVb = async (): Promise<void> => {
    const vb = await findVorhabensbeschreibung(storage.idb, key);
    setVbDokument(vb);
    if (vb && llmAvailable === null) {
      try { setLlmAvailable(await bridge.getActiveTransport().ping()); }
      catch { setLlmAvailable(false); }
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
    generate: () => { void runGeneration(); },
    modify: (m) => { void runGeneration(m); },
    pruefen: () => { void pruefen(); },
    freigeben: () => { void freigeben(); },
    verwerfen: () => { void verwerfen(); },
    refreshVb: () => { void refreshVb(); },
    stop: () => abortRef.current?.abort(),
    clearError: () => setError(null),
  };
}
