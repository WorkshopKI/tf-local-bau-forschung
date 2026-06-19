/**
 * Orchestriert den Gutachten-Workflow A–G auf Verbund-Ebene: lädt VB + Workflow-
 * Run (mit Migration eines Alt-Kurzfassungs-Laufs als Schritt A), löst Skill +
 * Regeln PRO Schritt aus der Registry auf, fährt Generierung/Modifier/Prüfung/
 * Freigabe je Schritt und persistiert nach JEDEM Statuswechsel (nie während des
 * Streams). Die Ablauf-Logik liegt in den reinen Runner-Reducern; dieser Hook ist
 * nur die IO-/Transport-Schicht.
 *
 * Alle Aktionen sind self-catching (Pitfall #15): Fehler → `error`-State (Banner).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import {
  runSkill,
  loadSkillRegistry,
  runRegelChecks,
  loadSkillTweak,
  saveSkillTweak,
  deleteSkillTweak,
  type SkillModifierKey,
  type QualitaetsRegel,
  type SkillRecord,
  type SkillTweak,
  type WorkflowStep,
} from '@/core/services/skills';
import { getVbCharCap } from '@/core/services/ai/llm-context';
import { getLlmThinkingEnabled, budgetForThinking, type ThinkingBudget } from '@/core/services/ai/llm-thinking';
import { buildStammdaten, buildSkillMap, type SkillCtx } from './skill-context';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import type { DocumentFull } from '@/plugins/dokumente/store';
import { resolveVb, type VbAufloesung } from '../kurzfassung/vbDokument';
import { useStreamingBuffer } from '../kurzfassung/useStreamingBuffer';
import type { KurzfassungContext } from '../kurzfassung/types';
import type { TweakEingabe } from '../kurzfassung/useKurzfassung';
import { resolveActiveWorkflow } from './active-workflow';
import { buildVorherigeAbschnitte } from './context-provider';
import { loadOrMigrateWorkflowRun } from './kurzfassung-migration';
import { putWorkflowRun } from './workflow-store';
import {
  applyGeneration, applyPruefen, applyQsHinweise, freigeben, erneutOeffnen, weiterschalten, verwerfen, uebernehmen,
  firstNonFreigegeben,
  type GenerationInput,
} from './runner';
import { parseQsBefunde } from './qs';
import type { StepId, WorkflowRun } from './types';

export interface GutachtenWorkflowController {
  run: WorkflowRun | null;
  vbDokument: DocumentFull | null;
  vbVorhanden: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  llmAvailable: boolean | null;
  /** Thinking-/Reasoning-Budget für die NÄCHSTE Generierung (Default aus der Einstellung; übersteuerbar, nicht persistiert). */
  thinkingBudget: ThinkingBudget;
  setThinkingBudget: (budget: ThinkingBudget) => void;
  /** Live-Streaming-Vorschau während `busy` (rohe Antwort + Denkprozess). */
  streamContent: string;
  streamThinking: string;
  /** Geordnete GENERIERUNGS-Schritte des aktiven Workflows (llm_qs-Schritte sind herausgefiltert). */
  steps: WorkflowStep[];
  aktiverSchritt: StepId;
  /** Skill des AKTIVEN Schritts (Version + Tweak-Editor). */
  activeSkill: SkillRecord | null;
  /** Regeln des AKTIVEN Schritts (Tweak-Vorschau). */
  regeln: QualitaetsRegel[];
  tweak: SkillTweak | null;
  generate: (stepId: StepId) => void;
  modify: (stepId: StepId, modifier: SkillModifierKey) => void;
  pruefen: (stepId: StepId) => void;
  /** Liefert den `llm_qs`-Schritt, der diesen Generierungs-Schritt bewertet (oder null). */
  qsFor: (stepId: StepId) => WorkflowStep | null;
  /** Beratende LLM-QS über den Zielabschnitt fahren (Befunde an den Ziel-Schritt). */
  runQs: (stepId: StepId) => void;
  freigebenStep: (stepId: StepId) => void;
  erneutOeffnenStep: (stepId: StepId) => void;
  weiterschaltenStep: (stepId: StepId) => void;
  verwerfenStep: (stepId: StepId) => void;
  uebernehmenStep: (stepId: StepId, index: number) => void;
  refreshVb: () => void;
  stop: () => void;
  clearError: () => void;
  saveTweak: (eingabe: TweakEingabe) => Promise<void>;
  removeTweak: () => Promise<void>;
}

export function useGutachtenWorkflow(ctx: KurzfassungContext): GutachtenWorkflowController {
  const storage = useStorage();
  const bridge = useAIBridge();
  const key = ctx.key;

  const [run, setRun] = useState<WorkflowRun | null>(null);
  // VB-Auflösung: IDB-Index (Vorrang) ODER persönlicher Ordner (Teil A, Fallback).
  const [vb, setVb] = useState<VbAufloesung | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(null);
  const [skillMap, setSkillMap] = useState<Map<StepId, SkillCtx>>(new Map());
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  // QS-Konfiguration: Ziel-Generierungs-Schritt-ID → der bewertende llm_qs-Schritt.
  const [qsZiele, setQsZiele] = useState<Map<StepId, WorkflowStep>>(new Map());
  const [tweak, setTweak] = useState<SkillTweak | null>(null);
  // Pro-Generierung-Budget: Default aus der Einstellung (an → 'medium'), lokal übersteuerbar. Nicht persistiert.
  const [thinkingBudget, setThinkingBudget] = useState<ThinkingBudget>(budgetForThinking(getLlmThinkingEnabled()));
  const stream = useStreamingBuffer();
  const abortRef = useRef<AbortController | null>(null);

  const order = useMemo(() => steps.map(s => s.id), [steps]);
  // Defensiver Guard: zeigt ein persistierter `aktiverSchritt` auf einen Schritt,
  // den die (umkuratierte) Def nicht mehr kennt, auf den ersten offenen zurückfallen.
  const rawAktiv = run?.aktiverSchritt ?? (steps[0]?.id ?? 'A');
  const aktiverSchritt = (run && steps.length > 0 && !steps.some(s => s.id === rawAktiv))
    ? firstNonFreigegeben(run, order)
    : rawAktiv;
  const activeCtx = skillMap.get(aktiverSchritt) ?? null;
  const activeSkillId = activeCtx?.skill.id;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const now = new Date().toISOString();
      const [r, vbRes, loaded] = await Promise.all([
        loadOrMigrateWorkflowRun(storage.idb, key, now),
        resolveVb(storage.idb, ctx),
        loadSkillRegistry(storage),
      ]);
      if (cancelled) return;
      setSkillMap(buildSkillMap(loaded.file));
      // llm_qs-Schritte aus der Generierungs-Schrittfolge filtern (reine Konfiguration —
      // stören firstNonFreigegeben/freigeben/Stepper nicht) und nach Ziel-Schritt indexieren.
      const allSteps = resolveActiveWorkflow(loaded.file);
      setSteps(allSteps.filter(s => s.rolle !== 'llm_qs'));
      const ziele = new Map<StepId, WorkflowStep>();
      for (const s of allSteps) if (s.rolle === 'llm_qs' && s.qsZielStepId) ziele.set(s.qsZielStepId, s);
      setQsZiele(ziele);
      setRun(r);
      setVb(vbRes);
      setLoading(false);
      // LLM-Probe nur, wenn Generierung relevant ist (VB da, aktiver Schritt nicht freigegeben).
      if (vbRes && r.schritte[r.aktiverSchritt]?.status !== 'freigegeben') {
        try { if (!cancelled) setLlmAvailable(await bridge.getActiveTransport().ping()); }
        catch { if (!cancelled) setLlmAvailable(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [key, storage.idb, bridge]);

  // Tweak des AKTIVEN Skills laden (wechselt mit dem aktiven Schritt).
  useEffect(() => {
    if (!activeSkillId) return;
    let cancelled = false;
    (async () => {
      const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
      const t = await loadSkillTweak(storage.idb, persHandle, activeSkillId).catch(() => null);
      if (!cancelled) setTweak(t);
    })();
    return () => { cancelled = true; };
  }, [activeSkillId, storage.idb]);

  const persist = async (next: WorkflowRun): Promise<void> => {
    setRun(next);
    await putWorkflowRun(storage.idb, next);
  };

  const runGeneration = async (stepId: StepId, modifier?: SkillModifierKey): Promise<void> => {
    const sc = skillMap.get(stepId);
    if (!vb || busy || !run || !sc) return;
    setBusy(true);
    setError(null);
    stream.reset();
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const transport = bridge.getActiveTransport();
      const ok = await transport.ping();
      setLlmAvailable(ok);
      if (!ok) { setError('KI nicht erreichbar — Generierung derzeit nicht möglich.'); return; }
      const tweakWirksam = !!(tweak?.aktiv && tweak.skillId === sc.skill.id
        && (tweak.stilHinweise.trim() || tweak.beispielFormulierungen.trim()));
      const prevText = run.schritte[stepId]?.finalerText;
      const result = await runSkill(transport, sc.skill, sc.regeln, {
        stammdaten: buildStammdaten(ctx),
        vbMarkdown: vb.markdown,
        vbCharCap: getVbCharCap(),
        thinkingBudget,
        onContentDelta: stream.onContentDelta,
        onThinkingDelta: stream.onThinkingDelta,
        vorherigeAbschnitte: buildVorherigeAbschnitte(run, stepId, steps),
        ...(tweakWirksam ? { tweak } : {}),
        ...(modifier ? { modifier } : {}),
        ...(modifier && prevText ? { vorherigerText: prevText } : {}),
        signal: abort.signal,
      });
      const gen: GenerationInput = {
        quellenanalyse: result.parsed.quellenanalyse,
        entwurf: result.parsed.entwurf,
        finalerText: result.parsed.finalerText,
        checks: runRegelChecks(result.parsed.finalerText, sc.regeln),
        modell: transport.displayName ?? transport.name,
        skillId: sc.skill.id,
        skillVersion: sc.skill.version,
        vbGekuerzt: result.vbGekuerzt,
        ...(result.parsed.warnung ? { warnung: result.parsed.warnung } : {}),
        ...(modifier ? { modifier } : {}),
        ...(tweakWirksam ? { mitTweak: true, tweakGeaendertAm: tweak!.geaendert_am } : {}),
        ...(result.thinking ? { denkprozess: result.thinking } : {}),
        ...(thinkingBudget !== 'none' ? { denkprozessAngefordert: true } : {}),
      };
      await persist(applyGeneration(run, stepId, gen, new Date().toISOString()));
    } catch (err) {
      if (abort.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  /** Hülle für reine Reducer-Aktionen (self-catching + persist). */
  const reduce = async (fn: (r: WorkflowRun, now: string) => WorkflowRun): Promise<void> => {
    if (!run) return;
    try {
      const next = fn(run, new Date().toISOString());
      if (next !== run) await persist(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const pruefenStep = async (stepId: StepId): Promise<void> => {
    const sc = skillMap.get(stepId);
    const step = run?.schritte[stepId];
    if (!run || !sc || !step) return;
    await reduce((r, now) => applyPruefen(r, stepId, runRegelChecks(step.finalerText, sc.regeln), now));
  };

  /**
   * Beratende LLM-QS über den FINALEN Text eines Generierungs-Schritts. Nutzt
   * denselben (internen) Transport + Runner wie die Generierung; die Befunde landen
   * via `applyQsHinweise` am Ziel-Schritt (kein Text-Overwrite). Transport weg → STOPP.
   */
  const runQs = async (zielStepId: StepId): Promise<void> => {
    const qsStep = qsZiele.get(zielStepId);
    const qsCtx = qsStep ? skillMap.get(qsStep.id) : undefined;
    const zielStep = run?.schritte[zielStepId];
    if (!vb || busy || !run || !qsStep || !qsCtx || !zielStep || !zielStep.finalerText.trim()) return;
    setBusy(true);
    setError(null);
    stream.reset();
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const transport = bridge.getActiveTransport();
      const ok = await transport.ping();
      setLlmAvailable(ok);
      if (!ok) { setError('KI nicht erreichbar — QS derzeit nicht möglich.'); return; }
      const zielDef = steps.find(s => s.id === zielStepId);
      const result = await runSkill(transport, qsCtx.skill, qsCtx.regeln, {
        stammdaten: buildStammdaten(ctx),
        vbMarkdown: vb.markdown,
        vbCharCap: getVbCharCap(),
        thinkingBudget,
        onContentDelta: stream.onContentDelta,
        onThinkingDelta: stream.onThinkingDelta,
        zielText: zielStep.finalerText,
        abschnittszweck: zielDef?.label ?? zielStepId,
        signal: abort.signal,
      });
      await persist(applyQsHinweise(run, zielStepId, parseQsBefunde(result.raw), new Date().toISOString()));
    } catch (err) {
      if (abort.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const refreshVb = async (): Promise<void> => {
    const vbRes = await resolveVb(storage.idb, ctx);
    setVb(vbRes);
    if (vbRes && llmAvailable === null) {
      try { setLlmAvailable(await bridge.getActiveTransport().ping()); }
      catch { setLlmAvailable(false); }
    }
  };

  const saveTweak = async (eingabe: TweakEingabe): Promise<void> => {
    if (!activeCtx) return;
    const next: SkillTweak = {
      skillId: activeCtx.skill.id,
      angelegtFuerSkillVersion: activeCtx.skill.version,
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
    if (!activeCtx) return;
    const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
    await deleteSkillTweak(storage.idb, persHandle, activeCtx.skill.id);
    setTweak(null);
  };

  return {
    run,
    vbDokument: vb?.dokument ?? null,
    vbVorhanden: vb !== null,
    loading,
    busy,
    error,
    llmAvailable,
    thinkingBudget,
    setThinkingBudget,
    streamContent: stream.content,
    streamThinking: stream.thinking,
    steps,
    aktiverSchritt,
    activeSkill: activeCtx?.skill ?? null,
    regeln: activeCtx?.regeln ?? [],
    tweak,
    generate: (id) => { void runGeneration(id); },
    modify: (id, m) => { void runGeneration(id, m); },
    pruefen: (id) => { void pruefenStep(id); },
    qsFor: (id) => qsZiele.get(id) ?? null,
    runQs: (id) => { void runQs(id); },
    freigebenStep: (id) => { void reduce((r, now) => freigeben(r, id, now, order)); },
    erneutOeffnenStep: (id) => { void reduce((r, now) => erneutOeffnen(r, id, now)); },
    weiterschaltenStep: (id) => { void reduce((r, now) => weiterschalten(r, id, now)); },
    verwerfenStep: (id) => { void reduce((r, now) => verwerfen(r, id, now)); },
    uebernehmenStep: (id, index) => { void reduce((r, now) => uebernehmen(r, id, index, now)); },
    refreshVb: () => { void refreshVb(); },
    stop: () => abortRef.current?.abort(),
    clearError: () => setError(null),
    saveTweak,
    removeTweak,
  };
}
