/**
 * Orchestriert die NF-Erzeugung pro Teilvorhaben (Artefakt-Engine, dev-Flag
 * `nfNachforderungen`). Reuse des Skill-Runners + Baustein-Katalogs: die
 * G-Bausteine werden EINMAL am Verbund-Kontext gefüllt und in JEDE TV-NF gemerged,
 * die T-Bausteine je TV. Ausgabe je TV: gemergter NF-Text + Checks + E-Mail-Entwurf
 * (mailto). Persistenz pro TV unter `workflow-run:nf:<tv-az>`.
 *
 * DSGVO: der Transport kommt über `bridge.getTransportForSkillRun(skill)` (NF ist
 * dokument-tragend → intern erzwungen, Pitfall #30). Es wird NICHTS versendet —
 * der Mensch öffnet/prüft/sendet die Entwürfe (Entwurf ≠ Entscheidung).
 */
import { useEffect, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import {
  runSkill, loadSkillRegistry, getSkillById, resolveRegeln, nfBausteineByScope, capVbMarkdown,
  NF_SKILL_ID, type CheckResult, type SkillRecord, type QualitaetsRegel,
} from '@/core/services/skills';
import { getVbCharCap } from '@/core/services/ai/llm-context';
import type { DocumentFull } from '@/plugins/dokumente/store';
import { resolveVb } from '../kurzfassung/vbDokument';
import { buildStammdaten } from '../gutachten/skill-context';
import { putWorkflowRun } from '../gutachten/workflow-store';
import { logArbeitskontext } from '@/core/services/personal-storage/arbeitskontext-log';
import type { StepRun, WorkflowRun } from '../gutachten/types';
import type { KurzfassungContext } from '../kurzfassung/types';
import { formatBausteinKatalog, pruefeNf, nfFreigabereif, mergeNfFuerTv, buildNfMailto } from './nf-service';

/** Ein fertiger NF-Entwurf für ein Teilvorhaben. */
export interface NfEntwurf {
  aktenzeichen: string;
  titel: string | null;
  antragsteller: string | null;
  text: string;
  checks: CheckResult[];
  freigabereif: boolean;
  mailto: string;
}

export interface NachforderungenController {
  loading: boolean;
  busy: boolean;
  error: string | null;
  llmAvailable: boolean | null;
  vbVorhanden: boolean;
  vbDokument: DocumentFull | null;
  entwuerfe: NfEntwurf[];
  /** Erzeugt für JEDES TV einen NF-Entwurf (G-Block einmal + je TV-Block). */
  generiereAlle: () => void;
  refreshVb: () => void;
  stop: () => void;
  clearError: () => void;
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function useNachforderungen(ctx: KurzfassungContext): NachforderungenController {
  const storage = useStorage();
  const bridge = useAIBridge();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(null);
  const [vb, setVb] = useState<{ dokument: DocumentFull | null; markdown: string } | null>(null);
  const [skill, setSkill] = useState<SkillRecord | null>(null);
  const [regeln, setRegeln] = useState<QualitaetsRegel[]>([]);
  const [entwuerfe, setEntwuerfe] = useState<NfEntwurf[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [vbRes, reg] = await Promise.all([resolveVb(storage.idb, ctx), loadSkillRegistry(storage)]);
        if (cancelled) return;
        setVb(vbRes ? { dokument: vbRes.dokument, markdown: vbRes.markdown } : null);
        const sk = getSkillById(reg.file, NF_SKILL_ID) ?? null;
        setSkill(sk);
        setRegeln(sk ? resolveRegeln(reg.file, sk) : []);
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // Nur auf den Verbund-Key reagieren (ctx wird je Render neu gebaut — sonst
    // Reload-Schleife). storage/bridge sind Context-stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.key]);

  async function generiereAlle(): Promise<void> {
    if (!vb || !skill) return;
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true); setError(null); setEntwuerfe([]);
    try {
      const transport = bridge.getTransportForSkillRun(skill);
      const reachable = await transport.ping({ openIfNeeded: true }).catch(() => false);
      setLlmAvailable(reachable);
      if (!reachable) { setError('KI nicht erreichbar — NF-Generierung derzeit nicht möglich.'); return; }

      const cap = getVbCharCap();
      const { text: vbCapped } = capVbMarkdown(vb.markdown, cap);
      const stammdaten = buildStammdaten(ctx);
      const modell = (transport as { name?: string }).name ?? 'intern';
      const gKatalog = formatBausteinKatalog(nfBausteineByScope('verbund'));
      const tvKatalog = formatBausteinKatalog(nfBausteineByScope('tv'));

      // 1) Verbund-Block EINMAL (G-Bausteine am Gesamtvorhaben-Kontext).
      const gRes = await runSkill(transport, skill, regeln, {
        stammdaten, vbMarkdown: '', vbCharCap: cap, signal: ac.signal,
        verbundKontext: vbCapped, tvKontext: '', nfBausteine: gKatalog,
      });
      const gBlock = gRes.parsed.finalerText;

      // 2) Je TV der TV-Block (T-Bausteine), dann G-Block + TV-Block mergen.
      const ergebnisse: NfEntwurf[] = [];
      const now = new Date().toISOString();
      for (const tv of ctx.teilvorhaben) {
        if (ac.signal.aborted) break;
        const tvKontext = `Teilvorhaben ${tv.nr}: ${tv.titel ?? '[ohne Titel]'} `
          + `(Antragsteller: ${tv.antragsteller ?? '[Im Antrag nicht genannt]'})\n\n${vbCapped}`;
        const tvRes = await runSkill(transport, skill, regeln, {
          stammdaten, vbMarkdown: '', vbCharCap: cap, signal: ac.signal,
          verbundKontext: '', tvKontext, nfBausteine: tvKatalog,
        });
        const merged = mergeNfFuerTv(gBlock, tvRes.parsed.finalerText);
        const checks = pruefeNf(merged);
        const step: StepRun = {
          quellenanalyse: tvRes.parsed.quellenanalyse,
          entwurf: tvRes.parsed.entwurf,
          finalerText: merged,
          checks,
          status: 'entwurf',
          erstellt_am: now,
          modell,
          skillId: skill.id,
          skillVersion: skill.version,
        };
        const run: WorkflowRun = {
          aktenzeichen: tv.aktenzeichen, schritte: { NF: step }, aktiverSchritt: 'NF',
          erstellt_am: now, geaendert_am: now, schemaVersion: 1,
        };
        await putWorkflowRun(storage.idb, run, 'nf');
        ergebnisse.push({
          aktenzeichen: tv.aktenzeichen,
          titel: tv.titel,
          antragsteller: tv.antragsteller,
          text: merged,
          checks,
          freigabereif: nfFreigabereif(merged),
          mailto: buildNfMailto({ fkz: tv.aktenzeichen, nachforderungen: merged }),
        });
        setEntwuerfe([...ergebnisse]); // inkrementell anzeigen
      }
      // Arbeitskontext-Log (Home-„Weitermachen") — rein lokal (IDB), fire-and-forget.
      // Ein Eintrag je Verbund (ctx.key), sobald mindestens ein TV-Entwurf steht.
      if (ergebnisse.length > 0) {
        void logArbeitskontext(storage.idb, {
          typ: 'nachforderung', verbundKey: ctx.key, ts: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch (e) {
      if (!ac.signal.aborted) setError(errMsg(e));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  async function refreshVb(): Promise<void> {
    const vbRes = await resolveVb(storage.idb, ctx);
    setVb(vbRes ? { dokument: vbRes.dokument, markdown: vbRes.markdown } : null);
  }

  return {
    loading,
    busy,
    error,
    llmAvailable,
    vbVorhanden: vb !== null,
    vbDokument: vb?.dokument ?? null,
    entwuerfe,
    generiereAlle: () => { void generiereAlle(); },
    refreshVb: () => { void refreshVb(); },
    stop: () => abortRef.current?.abort(),
    clearError: () => setError(null),
  };
}
