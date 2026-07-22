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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { kiVerbindungBereit } from '@/core/services/ai/ki-guard';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { appendFeedback, getUserId, resolveInstallId, type Rating } from '@/core/services/skill-feedback';
import {
  loadSkillRegistry,
  runRegelChecks,
  regelnMitOverride,
  loadSkillTweak,
  saveSkillTweak,
  deleteSkillTweak,
  clampMaxRetries,
  RELEVANZ_MAP_SKILL_ID,
  SEED_RELEVANZ_MAP_SKILL,
  GA_LEKTOR_SKILL_ID,
  SEED_GA_LEKTOR_SKILL,
  type CheckResult,
  type SkillModifierKey,
  type QualitaetsRegel,
  type SkillRecord,
  type SkillTweak,
  type SkillRegistryFile,
  type WorkflowDef,
  type WorkflowStep,
} from '@/core/services/skills';
import { getLlmThinkingEnabled, budgetForThinking, type ThinkingBudget } from '@/core/services/ai/llm-thinking';
import { useBridgeStatus } from '@/core/services/ai/bridge-status';
import { buildSkillMap, type SkillCtx } from './skill-context';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import type { DocumentFull } from '@/plugins/dokumente/store';
import { useGutachtenQuellen, type GutachtenQuellen } from './useGutachtenQuellen';
import { useStreamingBuffer } from '../kurzfassung/useStreamingBuffer';
import type { KurzfassungContext } from '../kurzfassung/types';
import type { TweakEingabe } from '../kurzfassung/useKurzfassung';
import { resolveWorkflowSteps, resolveWorkflowDefId, verfuegbareWorkflows, ACTIVE_WORKFLOW_ID } from './active-workflow';
import { erlaubeWorkflowEntwuerfe } from '@/config/feature-flags';
import { loadOrMigrateWorkflowRun } from './kurzfassung-migration';
import { generateInto, laufQs, laufLektorat, type GenerierungsDeps } from './workflow-generierung';
import { makePersist, makeReduce } from './workflow-persistenz';
import { logArbeitskontext } from '@/core/services/personal-storage/arbeitskontext-log';
import { protokolliereEreignis } from '@/core/services/assistent/protokoll';
import {
  applyBearbeitung, applyZuruecksetzen, applyPruefen, freigeben, erneutOeffnen, weiterschalten, verwerfen, uebernehmen,
  firstNonFreigegeben, leereSchritte, setVorlageRef,
} from './runner';
import { chooseRetryModifier } from './retry-policy';
import type { StepId, WorkflowRun } from './types';

/**
 * Regel-gebundener Kontext eines Korrektur-Laufs (Journey-Paket 3): die aus einem
 * verletzten Check abgeleitete Zusatz-Anweisung (`regelKorrekturAnweisung`) plus
 * die auslösende Regel-ID. Optional an `modify` durchgereicht — fehlt er, ist der
 * Lauf ein regulärer Modifier-Lauf (byte-identisch zu vorher).
 */
export interface KorrekturKontext {
  /** Konkrete Zusatz-Anweisung (Zielwert/Ist-Wert), die den Modifier verschärft. */
  anweisung: string;
  /** ID der Regel, deren Verletzung den Lauf ausgelöst hat (nur Anzeige). */
  regelId?: string;
}

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
  /** ID des tatsächlich laufenden GA-Workflows (für den dev-Inline-Editor). */
  activeWorkflowId: string;
  /** Registry frisch laden + Schritte/Skills neu ableiten (nach dev-Inline-Bearbeitung); Run/VB bleiben. */
  reloadRegistry: () => void;
  aktiverSchritt: StepId;
  /** Skill des AKTIVEN Schritts (Version + Tweak-Editor). */
  activeSkill: SkillRecord | null;
  /** Regeln des AKTIVEN Schritts (Tweak-Vorschau). */
  regeln: QualitaetsRegel[];
  tweak: SkillTweak | null;
  generate: (stepId: StepId) => void;
  /** Alle noch fehlenden Abschnitte nacheinander als Entwurf erzeugen (ohne Zwischen-Freigabe). */
  alleGenerieren: () => void;
  modify: (stepId: StepId, modifier: SkillModifierKey, kontext?: KorrekturKontext) => void;
  /** Manuelle Inline-Bearbeitung des finalen Textes übernehmen (Checks neu, ein persist). Awaitable für `useAsyncAction`. */
  bearbeitenStep: (stepId: StepId, text: string) => Promise<void>;
  /** Manuelle Bearbeitung verwerfen → ursprünglich generierten Text wiederherstellen. */
  zuruecksetzenStep: (stepId: StepId) => Promise<void>;
  pruefen: (stepId: StepId) => void;
  /**
   * Sprachlicher Feinschliff (Lektor-Skill) über den finalen Text eines Entwurfs:
   * EIN Lauf ohne Vorhabensbeschreibung, danach die Regeln DES ABSCHNITTS neu.
   * Ein abgeschnittenes/leeres Ergebnis wird verworfen (Abschnitt bleibt unverändert).
   */
  lektorieren: (stepId: StepId) => void;
  /** False, wenn der Kurator den Lektor-Skill deaktiviert hat (`aktiv: false`) → Knopf entfällt. */
  lektorVerfuegbar: boolean;
  /** Liefert den `llm_qs`-Schritt, der diesen Generierungs-Schritt bewertet (oder null). */
  qsFor: (stepId: StepId) => WorkflowStep | null;
  /** Beratende LLM-QS über den Zielabschnitt fahren (Befunde an den Ziel-Schritt). */
  runQs: (stepId: StepId) => void;
  freigebenStep: (stepId: StepId) => void;
  erneutOeffnenStep: (stepId: StepId) => void;
  weiterschaltenStep: (stepId: StepId) => void;
  verwerfenStep: (stepId: StepId) => void;
  uebernehmenStep: (stepId: StepId, index: number) => void;
  /** Quellen (VB + Inventar + Korpus) nach Upload/Auswahl-Änderung neu auflösen. */
  refreshKorpus: () => void;
  /** Quellen-Zustand + Mutationen für das Dokument-Inventar. */
  quellen: GutachtenQuellen;
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
  // Live-Verbindungsstatus der internen KI (Heartbeat-Store, treibt auch „● KI"-Anzeige):
  // Übergang → 'connected' triggert unten eine erneute Erreichbarkeits-Probe.
  const bridgeStatus = useBridgeStatus(s => s.status);
  const meinKuerzel = useMeinKuerzel();
  const key = ctx.key;

  const [run, setRun] = useState<WorkflowRun | null>(null);
  // Quellen des Gutachtens: die maßgebliche VB (IDB-Index mit Vorrang ODER persönlicher
  // Ordner als Fallback) PLUS das Inventar aller Verbund-Dokumente und der daraus
  // zusammengesetzte Korpus. `quellen.vb` ist die VB wie bisher; `quellen.markdown` ist
  // das, was tatsächlich ins Modell geht (bei leerer Auswahl beides identisch).
  const quellenCtrl = useGutachtenQuellen(ctx);
  const vb = quellenCtrl.quellen?.vb ?? null;
  const korpusMd = quellenCtrl.quellen?.markdown ?? '';
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
  // Lektor-Skill (sprachlicher Feinschliff) — ebenfalls kurator-pflegbar, Seed als Fallback.
  const [lektorSkill, setLektorSkill] = useState<SkillRecord>(SEED_GA_LEKTOR_SKILL);
  // Pro-Generierung-Budget: Default aus der Einstellung (an → 'medium'), lokal übersteuerbar. Nicht persistiert.
  const [thinkingBudget, setThinkingBudget] = useState<ThinkingBudget>(budgetForThinking(getLlmThinkingEnabled()));
  // Pro-Lauf-Override: vollständigen VB-Kontext erzwingen (Relevanz-Map ignorieren). Nicht persistiert.
  const [forceFullContext, setForceFullContext] = useState(false);
  // Läuft gerade der Bulk-Lauf „Alle Abschnitte erstellen"? (Button → Stopp + Fortschrittszeile.)
  const [bulkRunning, setBulkRunning] = useState(false);
  const stream = useStreamingBuffer();
  const abortRef = useRef<AbortController | null>(null);
  // Assistent-Protokoll: pro Abschnitt max. 1 „editiert"-Ereignis je Zeitfenster
  // (bearbeitenStep ist bereits ein Save, kein Tastendruck — hier nur gegen
  // wiederholtes „Übernehmen" desselben Abschnitts entprellt).
  const editiertZuletzt = useRef<Map<StepId, number>>(new Map());
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
  // ID des tatsächlich laufenden GA-Workflows (dev-Inline-Editor bearbeitet genau diese Def).
  const activeWorkflowId = useMemo(
    () => (regFile ? resolveWorkflowDefId(regFile, 'ga', { erlaubeEntwuerfe, workflowId: testWorkflowId ?? undefined }) : ACTIVE_WORKFLOW_ID),
    [regFile, erlaubeEntwuerfe, testWorkflowId],
  );

  // Registry-abgeleiteten Zustand (Skills/Schritte/QS/Relevanz) aus einer geladenen
  // Datei setzen — geteilt von Mount-Effekt UND `reloadRegistry` (dev-Inline-Editor).
  const applyRegistry = useCallback((loadedFile: SkillRegistryFile): void => {
    const workflowId = testWorkflowId ?? undefined;
    setRegFile(loadedFile);
    setSkillMap(buildSkillMap(loadedFile, { workflowId }));
    setRelevanzSkill(loadedFile.skills.find(s => s.id === RELEVANZ_MAP_SKILL_ID) ?? SEED_RELEVANZ_MAP_SKILL);
    setLektorSkill(loadedFile.skills.find(s => s.id === GA_LEKTOR_SKILL_ID) ?? SEED_GA_LEKTOR_SKILL);
    // llm_qs-Schritte aus der Generierungs-Schrittfolge filtern (reine Konfiguration —
    // stören firstNonFreigegeben/freigeben/Stepper nicht) und nach Ziel-Schritt indexieren.
    const allSteps = resolveWorkflowSteps(loadedFile, 'ga', { erlaubeEntwuerfe, workflowId });
    setSteps(allSteps.filter(s => s.rolle !== 'llm_qs'));
    const ziele = new Map<StepId, WorkflowStep>();
    for (const s of allSteps) if (s.rolle === 'llm_qs' && s.qsZielStepId) ziele.set(s.qsZielStepId, s);
    setQsZiele(ziele);
  }, [testWorkflowId, erlaubeEntwuerfe]);

  // dev-Inline-Editor: Registry frisch lesen und nur die registry-abgeleiteten Teile
  // neu setzen — Run/VB (Fortschritt) bleiben unberührt (kein Neuladen des Laufs).
  const reloadRegistry = useCallback((): void => {
    void (async () => {
      const loaded = await loadSkillRegistry(storage);
      applyRegistry(loaded.file);
    })();
  }, [storage, applyRegistry]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const now = new Date().toISOString();
      // VB/Korpus lädt `useGutachtenQuellen` parallel und eigenständig.
      const [r, loaded] = await Promise.all([
        loadOrMigrateWorkflowRun(storage.idb, key, now),
        loadSkillRegistry(storage),
      ]);
      if (cancelled) return;
      applyRegistry(loaded.file);
      setRun(r);
      setLoading(false);
      // Die Erreichbarkeits-Probe der internen KI läuft in einem eigenen Effekt (unten),
      // damit sie nicht nur einmal beim Mount, sondern auch bei jedem Schrittwechsel greift.
    })();
    return () => { cancelled = true; };
    // testWorkflowId in den Deps: Wechsel lädt Run/Steps/SkillMap des gewählten Workflows neu.
  }, [key, storage.idb, testWorkflowId, erlaubeEntwuerfe]);

  // Erreichbarkeit der internen KI (neu) proben. War die KI zwischenzeitlich getrennt
  // und ist wieder verbunden, muss der nächste Schritt generierbar sein — sonst bliebe
  // `llmAvailable` auf einem veralteten `false` stehen und „KI nicht erreichbar" bliebe
  // trotz bestehender Verbindung sichtbar (Bug). Trigger:
  //  • initial, sobald die VB geladen ist,
  //  • Wechsel des aktiven Abschnitts (der vom Nutzer genannte „nächste Workflow-Schritt"),
  //  • Reconnect der Bridge (`bridgeStatus` → 'connected', auch ohne Schrittwechsel),
  //  • Ende einer Generierung (`busy` → false, u.a. nach Abbruch durch Trennung).
  // PASSIV (`openIfNeeded: false`): kein ungefragter KI-Tab, pingt nur ein bereits offenes
  // Bridge-Fenster. Nicht während einer Generierung (single-window-Bridge, Pitfall #36) und
  // nicht bei bereits freigegebenem aktivem Schritt (dort ist Generierung nicht relevant).
  const vbVorhanden = vb != null;
  useEffect(() => {
    if (busy || !vbVorhanden || run?.schritte[aktiverSchritt]?.status === 'freigegeben') return undefined;
    let cancelled = false;
    (async () => {
      try { const ok = await bridge.getActiveTransport().ping({ openIfNeeded: false }); if (!cancelled) setLlmAvailable(ok); }
      catch { if (!cancelled) setLlmAvailable(false); }
    })();
    return () => { cancelled = true; };
    // `run` bewusst NICHT in den Deps (sonst Re-Probe nach jedem persist/Bearbeiten) — beim
    // Schrittwechsel ist es im Closure ohnehin frisch (aktiverSchritt leitet sich daraus ab).
  }, [aktiverSchritt, vbVorhanden, bridgeStatus, busy, bridge]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /**
   * Regeln eines Schritts INKL. persönlichem Vorgaben-Override. Der Override gilt
   * nur, wenn der geladene Tweak wirklich zu diesem Skill gehört (der Tweak-State
   * folgt dem aktiven Schritt) und der Kurator die Vorgabe freigegeben hat — die
   * Klemmung sitzt in `regelnMitOverride`. Prompt UND Check laufen dadurch gegen
   * denselben Wert; sonst bekäme der Nutzer einen Fehler für die Länge, die er
   * selbst gewählt hat.
   */
  const regelnFuer = (sc: SkillCtx, tw: SkillTweak | null): QualitaetsRegel[] =>
    tw && tw.skillId === sc.skill.id
      ? regelnMitOverride(sc.skill, sc.regeln, tw.vorgabenOverride)
      : sc.regeln;

  const persist = makePersist(storage.idb, setRun);

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
   * Alles, was die Lauf-Funktionen aus `workflow-generierung.ts` brauchen. Bewusst je
   * Render frisch gebaut: die Läufe lesen `steps`/`skillMap`/`korpusMd` zum Zeitpunkt
   * des Klicks, nicht zum Zeitpunkt eines Memo-Caches.
   */
  const genDeps = (): GenerierungsDeps => ({
    idb: storage.idb,
    bridge,
    ctx,
    key,
    skillMap,
    steps,
    korpusMd,
    vbVorhanden: vb != null,
    relevanzSkill,
    lektorSkill,
    thinkingBudget,
    forceFullContext,
    stream,
    regelnFuer,
    setLlmAvailable,
    setError,
  });

  /**
   * Eine Generierung (optional mit Modifier). Liefert die berechneten Checks zurück
   * (für den Auto-Retry-Orchestrator), `null` bei Bail/Transport-weg/Abbruch/Fehler
   * — dann beendet der Orchestrator den Loop sofort (STOPP).
   */
  const runGeneration = async (stepId: StepId, modifier?: SkillModifierKey, kontext?: KorrekturKontext): Promise<CheckResult[] | null> => {
    if (!vb || busy || !run || !skillMap.get(stepId)) return null;
    setBusy(true);
    setError(null);
    setRetryNote(null);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const res = await generateInto(run, stepId, {
        quelle: 'freigegeben', tweak, signal: abort.signal,
        ...(modifier ? { modifier } : {}),
        ...(kontext?.anweisung ? { zusatzAnweisung: kontext.anweisung } : {}),
        ...(kontext?.regelId ? { korrekturRegelId: kontext.regelId } : {}),
      }, genDeps());
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
        const res = await generateInto(current, stepId, { quelle: 'entwurf', tweak: stepTweak, signal: abort.signal }, genDeps());
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

  /** Hülle für reine Reducer-Aktionen (self-catching + persist, siehe workflow-persistenz.ts). */
  const reduce = makeReduce(() => run, persist, setError);

  const pruefenStep = async (stepId: StepId): Promise<void> => {
    const sc = skillMap.get(stepId);
    const step = run?.schritte[stepId];
    if (!run || !sc || !step) return;
    await reduce((r, now) => applyPruefen(r, stepId, runRegelChecks(step.finalerText, regelnFuer(sc, tweak)), now));
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
    const checks = runRegelChecks(text, regelnFuer(sc, tweak));
    await reduce((r, now) => applyBearbeitung(r, stepId, text, checks, now));
    // Nur die Tatsache „Abschnitt bearbeitet" protokollieren — NIE den Textinhalt.
    const jetzt = Date.now();
    if (jetzt - (editiertZuletzt.current.get(stepId) ?? 0) > 60_000) {
      editiertZuletzt.current.set(stepId, jetzt);
      void protokolliereEreignis({
        typ: 'gutachten_abschnitt_editiert',
        entitaet: { art: 'workflowSchritt', id: stepId },
        detail: { abschnittId: stepId },
      });
    }
  };

  /** Manuelle Bearbeitung verwerfen → ursprünglich generierten Text wiederherstellen (Checks neu). */
  const zuruecksetzenStep = async (stepId: StepId): Promise<void> => {
    const sc = skillMap.get(stepId);
    const step = run?.schritte[stepId];
    if (!run || !sc || step?.originalText == null) return;
    const checks = runRegelChecks(step.originalText, regelnFuer(sc, tweak));
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
      const next = await laufQs(run, zielStepId, qsCtx, abort.signal, genDeps());
      if (next) await persist(next);
    } catch (err) {
      if (abort.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  /**
   * Sprachlicher Feinschliff eines Entwurfs (Lektor-Skill). Bewusst KEIN
   * Generierungs-Lauf: der Prompt trägt nur den Abschnittstext (`zielText`) +
   * den Abschnittszweck — die Vorhabensbeschreibung bleibt draußen, damit der
   * Lauf strukturell nichts hinzuerfinden kann. Geprüft wird danach mit den
   * Regeln DES ABSCHNITTS (Umfang bleibt die maßgebliche Instanz).
   *
   * Zwei Abbruch-Tore VOR dem Schreiben: leeres Ergebnis und
   * `istVerdaechtigGekuerzt` (abgeschnittene Antwort) → Fehlermeldung, Abschnitt
   * bleibt unverändert. Transport intern-pflichtig über `getTransportForSkillRun`
   * (Pitfall #30); ein `setState` + ein `persist` (Pitfall #16/#20).
   */
  const runLektorat = async (stepId: StepId): Promise<void> => {
    const sc = skillMap.get(stepId);
    const step = run?.schritte[stepId];
    if (busy || !run || !sc || !step || step.status !== 'entwurf' || !step.finalerText.trim()) return;
    if (!kiVerbindungBereit(bridge)) return;
    setBusy(true);
    setError(null);
    setRetryNote(null);
    stream.reset();
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const next = await laufLektorat(run, stepId, sc, tweak, abort.signal, genDeps());
      if (!next) return; // leer / verdaechtig gekuerzt / Transport weg -> Fehler ist gesetzt
      await persist(next);
      logKontext(stepId);
    } catch (err) {
      if (abort.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  // Nach Upload/„Fertig" oder einer Änderung an der Quellen-Auswahl neu auflösen.
  const refreshKorpus = async (): Promise<void> => {
    await quellenCtrl.refresh();
    if (llmAvailable === null) {
      // Passiv — wie die Mount-Probe (kein ungefragter KI-Tab beim Quellen-Refresh).
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
    quellen: quellenCtrl,
    loading: loading || quellenCtrl.loading,
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
    activeWorkflowId,
    reloadRegistry,
    aktiverSchritt,
    activeSkill: activeCtx?.skill ?? null,
    regeln: activeCtx?.regeln ?? [],
    tweak,
    generate: (id) => { void runGenerateMitRetry(id); },
    alleGenerieren: () => { void generiereAlle(); },
    modify: (id, m, kontext) => { void runGeneration(id, m, kontext); },
    bearbeitenStep,
    zuruecksetzenStep,
    pruefen: (id) => { void pruefenStep(id); },
    lektorieren: (id) => { void runLektorat(id); },
    lektorVerfuegbar: lektorSkill.aktiv !== false,
    qsFor: (id) => qsZiele.get(id) ?? null,
    runQs: (id) => { void runQs(id); },
    freigebenStep: (id) => { void reduce((r, now) => freigeben(r, id, now, order)); logKontext(id); },
    erneutOeffnenStep: (id) => { void reduce((r, now) => erneutOeffnen(r, id, now)); },
    weiterschaltenStep: (id) => { void reduce((r, now) => weiterschalten(r, id, now)); },
    verwerfenStep: (id) => { void reduce((r, now) => verwerfen(r, id, now)); logKontext(id); },
    uebernehmenStep: (id, index) => { void reduce((r, now) => uebernehmen(r, id, index, now)); },
    refreshKorpus: () => { void refreshKorpus(); },
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
