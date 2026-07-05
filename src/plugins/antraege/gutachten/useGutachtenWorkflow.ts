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
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { appendFeedback, getUserId, resolveInstallId, type Rating } from '@/core/services/skill-feedback';
import {
  runSkill,
  loadSkillRegistry,
  runRegelChecks,
  loadSkillTweak,
  saveSkillTweak,
  deleteSkillTweak,
  clampMaxRetries,
  RELEVANZ_MAP_SKILL_ID,
  SEED_RELEVANZ_MAP_SKILL,
  type CheckResult,
  type SkillModifierKey,
  type QualitaetsRegel,
  type SkillRecord,
  type SkillTweak,
  type SkillRegistryFile,
  type WorkflowDef,
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
import { resolveWorkflowSteps, verfuegbareWorkflows } from './active-workflow';
import { erlaubeWorkflowEntwuerfe } from '@/config/feature-flags';
import { buildVorherigeAbschnitte, buildVbRelevant } from './context-provider';
import { getOrComputeRelevanzMap, vbBrauchtRelevanzMap, type RelevanzAbschnitt } from './relevanz-map';
import { loadOrMigrateWorkflowRun } from './kurzfassung-migration';
import { putWorkflowRun } from './workflow-store';
import { logArbeitskontext } from '@/core/services/personal-storage/arbeitskontext-log';
import {
  applyGeneration, applyBearbeitung, applyZuruecksetzen, applyPruefen, applyQsHinweise, freigeben, erneutOeffnen, weiterschalten, verwerfen, uebernehmen,
  firstNonFreigegeben, leereSchritte, setVorlageRef,
  type GenerationInput,
} from './runner';
import { parseQsBefunde } from './qs';
import { chooseRetryModifier } from './retry-policy';
import type { StepId, WorkflowRun } from './types';

export interface GutachtenWorkflowController {
  run: WorkflowRun | null;
  vbDokument: DocumentFull | null;
  vbVorhanden: boolean;
  loading: boolean;
  busy: boolean;
  /** Läuft gerade der Bulk-Lauf „Alle Abschnitte erstellen"? (Button → Stopp + Fortschritt.) */
  bulkRunning: boolean;
  error: string | null;
  /** Neutraler Vermerk nach erschöpftem Auto-Retry („nach N Versuchen weiterhin Fehler"). */
  retryNote: string | null;
  llmAvailable: boolean | null;
  /** Thinking-/Reasoning-Budget für die NÄCHSTE Generierung (Default aus der Einstellung; übersteuerbar, nicht persistiert). */
  thinkingBudget: ThinkingBudget;
  setThinkingBudget: (budget: ThinkingBudget) => void;
  /** True, wenn der aktive Schritt `kontextBedarf: 'relevant'` trägt (Relevanz-Map greift — Override sinnvoll). */
  kontextRelevant: boolean;
  /** Pro-Lauf-Override „vollständigen Kontext erzwingen" → ignoriert die Relevanz-Map, nutzt den vollen VB. */
  forceFullContext: boolean;
  setForceFullContext: (v: boolean) => void;
  /** Live-Streaming-Vorschau während `busy` (rohe Antwort + Denkprozess). */
  streamContent: string;
  streamThinking: string;
  /** Geordnete GENERIERUNGS-Schritte des aktiven Workflows (llm_qs-Schritte sind herausgefiltert). */
  steps: WorkflowStep[];
  /** dev-Test: explizit gewählter Workflow (null = Default-GA per Tie-Break). */
  testWorkflowId: string | null;
  setTestWorkflowId: (id: string | null) => void;
  /** Wählbare GA-Workflows fürs dev-Dropdown (gefiltert/sortiert; leer außerhalb dev). */
  verfuegbareWorkflows: WorkflowDef[];
  aktiverSchritt: StepId;
  /** Skill des AKTIVEN Schritts (Version + Tweak-Editor). */
  activeSkill: SkillRecord | null;
  /** Regeln des AKTIVEN Schritts (Tweak-Vorschau). */
  regeln: QualitaetsRegel[];
  tweak: SkillTweak | null;
  generate: (stepId: StepId) => void;
  /** Alle noch fehlenden Abschnitte nacheinander als Entwurf erzeugen (ohne Zwischen-Freigabe). */
  alleGenerieren: () => void;
  modify: (stepId: StepId, modifier: SkillModifierKey) => void;
  /** Manuelle Inline-Bearbeitung des finalen Textes übernehmen (Checks neu, ein persist). Awaitable für `useAsyncAction`. */
  bearbeitenStep: (stepId: StepId, text: string) => Promise<void>;
  /** Manuelle Bearbeitung verwerfen → ursprünglich generierten Text wiederherstellen. */
  zuruecksetzenStep: (stepId: StepId) => Promise<void>;
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
  /** Ein-Klick-Feedback zu einem Abschnitt → S1-Substrat (DSGVO-Guard, nicht blockierend). */
  sendFeedback: (stepId: StepId, rating: Rating, notiz?: string) => void;
  /** Audit-Stempel der zuletzt zum Export genutzten Vorlage setzen (Artefakt-Engine). */
  stampVorlage: (info: { pfad: string; hash?: string }) => void;
}

export function useGutachtenWorkflow(ctx: KurzfassungContext): GutachtenWorkflowController {
  const storage = useStorage();
  const bridge = useAIBridge();
  const meinKuerzel = useMeinKuerzel();
  const key = ctx.key;

  const [run, setRun] = useState<WorkflowRun | null>(null);
  // VB-Auflösung: IDB-Index (Vorrang) ODER persönlicher Ordner (Teil A, Fallback).
  const [vb, setVb] = useState<VbAufloesung | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNote, setRetryNote] = useState<string | null>(null);
  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(null);
  const [skillMap, setSkillMap] = useState<Map<StepId, SkillCtx>>(new Map());
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  // QS-Konfiguration: Ziel-Generierungs-Schritt-ID → der bewertende llm_qs-Schritt.
  const [qsZiele, setQsZiele] = useState<Map<StepId, WorkflowStep>>(new Map());
  const [tweak, setTweak] = useState<SkillTweak | null>(null);
  // Relevanz-Map-Skill aus der geladenen Registry (Kurator-pflegbar), Seed als Fallback.
  const [relevanzSkill, setRelevanzSkill] = useState<SkillRecord>(SEED_RELEVANZ_MAP_SKILL);
  // Pro-Generierung-Budget: Default aus der Einstellung (an → 'medium'), lokal übersteuerbar. Nicht persistiert.
  const [thinkingBudget, setThinkingBudget] = useState<ThinkingBudget>(budgetForThinking(getLlmThinkingEnabled()));
  // Pro-Lauf-Override: vollständigen VB-Kontext erzwingen (Relevanz-Map ignorieren). Nicht persistiert.
  const [forceFullContext, setForceFullContext] = useState(false);
  // Läuft gerade der Bulk-Lauf „Alle Abschnitte erstellen"? (Button → Stopp + Fortschrittszeile.)
  const [bulkRunning, setBulkRunning] = useState(false);
  const stream = useStreamingBuffer();
  const abortRef = useRef<AbortController | null>(null);
  // dev-Test-Workflowwahl: nur lokal (resettet pro Reload). `regFile` hält die
  // geladene Registry für die Dropdown-Optionen. `erlaubeEntwuerfe` ist ein
  // Build-Konstant (dev → true), daher render-stabil.
  const erlaubeEntwuerfe = erlaubeWorkflowEntwuerfe();
  const [testWorkflowId, setTestWorkflowId] = useState<string | null>(null);
  const [regFile, setRegFile] = useState<SkillRegistryFile | null>(null);
  const verfuegbar = useMemo(
    () => (regFile ? verfuegbareWorkflows(regFile, 'ga', { erlaubeEntwuerfe }) : []),
    [regFile, erlaubeEntwuerfe],
  );

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
      setRegFile(loaded.file);
      const workflowId = testWorkflowId ?? undefined;
      setSkillMap(buildSkillMap(loaded.file, { workflowId }));
      setRelevanzSkill(loaded.file.skills.find(s => s.id === RELEVANZ_MAP_SKILL_ID) ?? SEED_RELEVANZ_MAP_SKILL);
      // llm_qs-Schritte aus der Generierungs-Schrittfolge filtern (reine Konfiguration —
      // stören firstNonFreigegeben/freigeben/Stepper nicht) und nach Ziel-Schritt indexieren.
      const allSteps = resolveWorkflowSteps(loaded.file, 'ga', { erlaubeEntwuerfe, workflowId });
      setSteps(allSteps.filter(s => s.rolle !== 'llm_qs'));
      const ziele = new Map<StepId, WorkflowStep>();
      for (const s of allSteps) if (s.rolle === 'llm_qs' && s.qsZielStepId) ziele.set(s.qsZielStepId, s);
      setQsZiele(ziele);
      setRun(r);
      setVb(vbRes);
      setLoading(false);
      // LLM-Probe nur, wenn Generierung relevant ist (VB da, aktiver Schritt nicht freigegeben).
      // PASSIV (`openIfNeeded: false`): öffnet beim Mount keinen KI-Tab (sonst poppt das
      // Öffnen der Verbund-Detailseite ungefragt die Bridge auf, Bug). Pingt nur ein
      // bereits offenes Bridge-Fenster; sonst false (= Button disabled), wie der bisherige Timeout.
      if (vbRes && r.schritte[r.aktiverSchritt]?.status !== 'freigegeben') {
        try { if (!cancelled) setLlmAvailable(await bridge.getActiveTransport().ping({ openIfNeeded: false })); }
        catch { if (!cancelled) setLlmAvailable(false); }
      }
    })();
    return () => { cancelled = true; };
    // testWorkflowId in den Deps: Wechsel lädt Run/Steps/SkillMap des gewählten Workflows neu.
  }, [key, storage.idb, bridge, testWorkflowId, erlaubeEntwuerfe]);

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

  /**
   * Arbeitskontext-Log (Home-„Weitermachen") — rein lokal (IDB), fire-and-forget.
   * NIE die Arbeitsaktion brechen: eigener try/catch. Loggt nur Metadaten
   * (Verbund-Key + Abschnitt), kein Text.
   */
  const logKontext = (abschnittId: StepId): void => {
    void logArbeitskontext(storage.idb, {
      typ: 'gutachten', verbundKey: key, abschnittId, ts: new Date().toISOString(),
    }).catch(() => {});
  };

  /**
   * Generierungs-Kern für EINEN Abschnitt — gegen einen ÜBERGEBENEN `base`-Run
   * (kein Closure-`run`, damit der Bulk-Lauf den frischen Stand durchreichen kann).
   * Liefert `{ next, checks }` oder `null` (Transport nicht erreichbar → `error`
   * gesetzt). Wirft bei echten Fehlern/Abbruch — der jeweilige Orchestrator
   * (`runGeneration` / `generiereAlle`) fängt das und besitzt busy/abort/persist.
   * Der Tweak wird ÜBERGEBEN (nicht aus der Closure), damit der Bulk-Lauf pro
   * Schritt den zum jeweiligen Skill gehörenden Tweak nutzen kann.
   */
  const generateInto = async (
    base: WorkflowRun,
    stepId: StepId,
    o: { modifier?: SkillModifierKey; quelle: 'freigegeben' | 'entwurf'; tweak: SkillTweak | null; signal: AbortSignal },
  ): Promise<{ next: WorkflowRun; checks: CheckResult[] } | null> => {
    const sc = skillMap.get(stepId);
    if (!sc || !vb) return null;
    stream.reset();
    const transport = bridge.getTransportForSkillRun(sc.skill);
    const ok = await transport.ping();
    setLlmAvailable(ok);
    if (!ok) { setError('KI nicht erreichbar — Generierung derzeit nicht möglich.'); return null; }
    const tw = o.tweak;
    const tweakWirksam = !!(tw?.aktiv && tw.skillId === sc.skill.id
      && (tw.stilHinweise.trim() || tw.beispielFormulierungen.trim()));
    const prevText = base.schritte[stepId]?.finalerText;
    // Relevanz-Map: nur wenn der Schritt `kontextBedarf: 'relevant'` trägt UND die
    // VB groß genug ist. JEDER Fehlerpfad (Map leer / Lauf gescheitert) degradiert
    // still zu Volltext — kein `vbRelevant` → der Skill nutzt {{vbMarkdown}} wie bisher.
    let vbRelevant: string | undefined;
    const stepDef = steps.find(s => s.id === stepId);
    if (!forceFullContext && stepDef?.kontextBedarf === 'relevant' && vbBrauchtRelevanzMap(vb.markdown)) {
      try {
        const abschnitte: RelevanzAbschnitt[] = steps.map(s => ({ id: s.id, label: s.label }));
        const relevanz = await getOrComputeRelevanzMap(storage.idb, transport, relevanzSkill, key, vb.markdown, abschnitte);
        const block = buildVbRelevant(relevanz, vb.markdown, stepId, getVbCharCap());
        if (block) vbRelevant = block;
      } catch {
        // Relevanz-Lauf gescheitert → Volltext-Fallback (nie scheitern).
      }
    }
    const result = await runSkill(transport, sc.skill, sc.regeln, {
      stammdaten: buildStammdaten(ctx),
      vbMarkdown: vb.markdown,
      vbCharCap: getVbCharCap(),
      thinkingBudget,
      onContentDelta: stream.onContentDelta,
      onThinkingDelta: stream.onThinkingDelta,
      vorherigeAbschnitte: buildVorherigeAbschnitte(base, stepId, steps, 2000, o.quelle),
      ...(vbRelevant ? { vbRelevant } : {}),
      ...(tweakWirksam ? { tweak: tw } : {}),
      ...(o.modifier ? { modifier: o.modifier } : {}),
      ...(o.modifier && prevText ? { vorherigerText: prevText } : {}),
      signal: o.signal,
    });
    const checks = runRegelChecks(result.parsed.finalerText, sc.regeln);
    const gen: GenerationInput = {
      quellenanalyse: result.parsed.quellenanalyse,
      entwurf: result.parsed.entwurf,
      finalerText: result.parsed.finalerText,
      ...(result.parsed.teile?.length ? { teile: result.parsed.teile } : {}),
      checks,
      modell: transport.displayName ?? transport.name,
      skillId: sc.skill.id,
      skillVersion: sc.skill.version,
      vbGekuerzt: result.vbGekuerzt,
      ...(result.parsed.warnung ? { warnung: result.parsed.warnung } : {}),
      ...(o.modifier ? { modifier: o.modifier } : {}),
      ...(tweakWirksam ? { mitTweak: true, tweakGeaendertAm: tw!.geaendert_am } : {}),
      ...(result.thinking ? { denkprozess: result.thinking } : {}),
      ...(thinkingBudget !== 'none' ? { denkprozessAngefordert: true } : {}),
    };
    return { next: applyGeneration(base, stepId, gen, new Date().toISOString()), checks };
  };

  /**
   * Eine Generierung (optional mit Modifier). Liefert die berechneten Checks zurück
   * (für den Auto-Retry-Orchestrator), `null` bei Bail/Transport-weg/Abbruch/Fehler
   * — dann beendet der Orchestrator den Loop sofort (STOPP).
   */
  const runGeneration = async (stepId: StepId, modifier?: SkillModifierKey): Promise<CheckResult[] | null> => {
    if (!vb || busy || !run || !skillMap.get(stepId)) return null;
    setBusy(true);
    setError(null);
    setRetryNote(null);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const res = await generateInto(run, stepId, { quelle: 'freigegeben', tweak, signal: abort.signal, ...(modifier ? { modifier } : {}) });
      if (!res) return null;
      await persist(res.next);
      logKontext(stepId);
      return res.checks;
    } catch (err) {
      if (abort.signal.aborted) return null;
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  /**
   * Bulk „Alle Abschnitte als Entwurf erstellen": generiert die noch FEHLENDEN
   * Abschnitte (Umfang „nur fehlende" — Entwürfe + Freigaben bleiben unangetastet
   * und dienen als Kontext) nacheinander als Entwurf — KEINE Zwischen-Freigabe
   * nötig. Jeder neue Entwurf bekommt die vorherigen Abschnitte (auch Entwürfe,
   * `quelle:'entwurf'`) als Kontext; der `run` wird LOKAL durchgereicht (kein stale
   * Closure → B sieht A's frischen Entwurf). Single-pass (KEIN Auto-Retry). STOPP
   * bei Transport-weg/Abbruch/Fehler — fertige Entwürfe bleiben persistiert
   * (idempotent fortsetzbar). Persist pro Abschnitt (Pitfall #16/#20).
   */
  const generiereAlle = async (): Promise<void> => {
    if (!vb || busy || !run) return;
    const offen = leereSchritte(run, steps.map(s => s.id));
    if (offen.length === 0) return;
    setBusy(true);
    setBulkRunning(true);
    setError(null);
    setRetryNote(null);
    const abort = new AbortController();
    abortRef.current = abort;
    const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
    try {
      let current = run;
      for (const stepId of offen) {
        if (abort.signal.aborted) break;
        if (!skillMap.get(stepId)) continue;
        // Fokus auf den gerade laufenden Abschnitt → Live-Stream im aktiven Card.
        // Nur State (kein eigener Write); der Entwurf-Persist unten nimmt den Fokus mit.
        current = weiterschalten(current, stepId, new Date().toISOString());
        setRun(current);
        const stepTweak = await loadSkillTweak(storage.idb, persHandle, skillMap.get(stepId)!.skill.id).catch(() => null);
        const res = await generateInto(current, stepId, { quelle: 'entwurf', tweak: stepTweak, signal: abort.signal });
        if (!res) break; // Transport weg (error gesetzt) → STOPP, fertige Entwürfe bleiben
        current = res.next;
        await persist(current);
        logKontext(stepId);
      }
    } catch (err) {
      if (!abort.signal.aborted) setError(err instanceof Error ? err.message : String(err));
    } finally {
      abortRef.current = null;
      setBulkRunning(false);
      setBusy(false);
    }
  };

  /**
   * Generierung mit beschränktem Auto-Retry (opt-in pro Schritt). Generieren →
   * deterministisch prüfen → bei `fehler` und Versuch < N automatisch mit passendem
   * Modifier neu generieren. Harte Decke N (`maxRetries`, geklemmt). Transport weg /
   * Abbruch ⇒ `runGeneration` liefert `null` ⇒ Loop endet sofort. Nach N STOPP mit
   * Vermerk. KEINE LLM-Entscheidung über den Ablauf — reiner Reducer-Loop mit Zähler.
   */
  const runGenerateMitRetry = async (stepId: StepId): Promise<void> => {
    const step = steps.find(s => s.id === stepId);
    const max = step?.autoRetry ? clampMaxRetries(step.maxRetries) : 0;
    let checks = await runGeneration(stepId);
    let attempt = 0;
    while (checks && attempt < max) {
      const mod = chooseRetryModifier(checks);
      if (!mod) return; // nur ok/hinweis → fertig
      attempt += 1;
      checks = await runGeneration(stepId, mod);
    }
    // Decke erreicht und weiterhin retry-würdige Fehler → neutraler Vermerk (kein roter Error).
    if (checks && attempt > 0 && chooseRetryModifier(checks)) {
      setRetryNote(`Nach ${attempt} ${attempt === 1 ? 'automatischen Versuch' : 'automatischen Versuchen'} weiterhin Fehler — bitte prüfen.`);
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
   * Manuelle Inline-Bearbeitung des finalen Textes übernehmen. Plain-Text (passt zu
   * Markdown-Render + DOCX-Füller); die deterministischen Checks werden über dem
   * neuen Text frisch gerechnet, damit Prüf-Ergebnis + Text konsistent bleiben.
   * Ein `setState` + ein `persist` (Pitfall #16/#20) über `reduce`; awaitable, damit
   * die Karte `useAsyncAction` (Pitfall #15) nutzen kann.
   */
  const bearbeitenStep = async (stepId: StepId, text: string): Promise<void> => {
    const sc = skillMap.get(stepId);
    if (!run || !sc) return;
    const checks = runRegelChecks(text, sc.regeln);
    await reduce((r, now) => applyBearbeitung(r, stepId, text, checks, now));
  };

  /** Manuelle Bearbeitung verwerfen → ursprünglich generierten Text wiederherstellen (Checks neu). */
  const zuruecksetzenStep = async (stepId: StepId): Promise<void> => {
    const sc = skillMap.get(stepId);
    const step = run?.schritte[stepId];
    if (!run || !sc || step?.originalText == null) return;
    const checks = runRegelChecks(step.originalText, sc.regeln);
    await reduce((r, now) => applyZuruecksetzen(r, stepId, checks, now));
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
      const transport = bridge.getTransportForSkillRun(qsCtx.skill);
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
      // Passiv — wie die Mount-Probe (kein ungefragter KI-Tab beim VB-Refresh).
      try { setLlmAvailable(await bridge.getActiveTransport().ping({ openIfNeeded: false })); }
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

  /**
   * Ein-Klick-Feedback zum erzeugenden Skill eines Abschnitts → S1. Läuft durch
   * den DSGVO-Guard (nur skillId/Version/Rating/kurze Notiz/Identität — NIE
   * generierter Text/VB/FKZ). Nicht blockierend: Schreibfehler werden geschluckt.
   */
  const sendFeedback = async (stepId: StepId, rating: Rating, notiz?: string): Promise<void> => {
    const step = run?.schritte[stepId];
    if (!step?.skillId) return;
    try {
      const userId = getUserId(meinKuerzel, await resolveInstallId(storage.idb));
      await appendFeedback(storage, {
        skillId: step.skillId,
        skillVersion: step.skillVersion ?? 0,
        rating,
        ts: new Date().toISOString(),
        userId,
        ...(notiz ? { notiz } : {}),
      });
    } catch {
      // stiller S1-Fallback — Feedback ist nicht blockierend
    }
  };

  return {
    run,
    vbDokument: vb?.dokument ?? null,
    vbVorhanden: vb !== null,
    loading,
    busy,
    bulkRunning,
    error,
    retryNote,
    llmAvailable,
    thinkingBudget,
    setThinkingBudget,
    kontextRelevant: steps.find(s => s.id === aktiverSchritt)?.kontextBedarf === 'relevant',
    forceFullContext,
    setForceFullContext,
    streamContent: stream.content,
    streamThinking: stream.thinking,
    steps,
    testWorkflowId,
    setTestWorkflowId,
    verfuegbareWorkflows: verfuegbar,
    aktiverSchritt,
    activeSkill: activeCtx?.skill ?? null,
    regeln: activeCtx?.regeln ?? [],
    tweak,
    generate: (id) => { void runGenerateMitRetry(id); },
    alleGenerieren: () => { void generiereAlle(); },
    modify: (id, m) => { void runGeneration(id, m); },
    bearbeitenStep,
    zuruecksetzenStep,
    pruefen: (id) => { void pruefenStep(id); },
    qsFor: (id) => qsZiele.get(id) ?? null,
    runQs: (id) => { void runQs(id); },
    freigebenStep: (id) => { void reduce((r, now) => freigeben(r, id, now, order)); logKontext(id); },
    erneutOeffnenStep: (id) => { void reduce((r, now) => erneutOeffnen(r, id, now)); },
    weiterschaltenStep: (id) => { void reduce((r, now) => weiterschalten(r, id, now)); },
    verwerfenStep: (id) => { void reduce((r, now) => verwerfen(r, id, now)); logKontext(id); },
    uebernehmenStep: (id, index) => { void reduce((r, now) => uebernehmen(r, id, index, now)); },
    refreshVb: () => { void refreshVb(); },
    stop: () => abortRef.current?.abort(),
    clearError: () => setError(null),
    saveTweak,
    removeTweak,
    sendFeedback: (id, rating, notiz) => { void sendFeedback(id, rating, notiz); },
    stampVorlage: (info) => {
      void reduce((r, now) => setVorlageRef(r, { pfad: info.pfad, hash: info.hash ?? '', gelesenAm: now }, now));
    },
  };
}
