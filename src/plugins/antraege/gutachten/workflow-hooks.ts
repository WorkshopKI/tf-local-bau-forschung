/**
 * Die drei Nebenzustände des Gutachten-Workflows, je als eigener kleiner Hook.
 *
 * `useGutachtenWorkflow` blieb nach dem Konsolidierungs-Pass bei 674 Zeilen und
 * trug neben der eigentlichen Ablauf-Orchestrierung drei Zustände, die mit ihr
 * nichts zu tun haben: welche Workflow-Definition gerade gilt, ob die interne KI
 * erreichbar ist, und welcher persönliche Skill-Tweak zum aktiven Schritt gehört.
 * Jeder davon hat seinen eigenen Auslöser und seine eigene Lebensdauer — sie
 * standen nur deshalb beieinander, weil sie denselben Aufrufer haben.
 *
 * Hier ändert sich NICHTS am Verhalten: dieselben Effekte, dieselben Deps,
 * dieselben Kommentare (sie tragen den Grund für die Dep-Auswahl und wandern
 * deshalb mit). Der Gewinn ist, dass jeder Zustand jetzt eine Überschrift hat.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AIBridge } from '@/core/services/ai/bridge';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import {
  loadSkillRegistry,
  loadSkillTweak,
  RELEVANZ_MAP_SKILL_ID,
  SEED_RELEVANZ_MAP_SKILL,
  GA_LEKTOR_SKILL_ID,
  SEED_GA_LEKTOR_SKILL,
  type SkillRecord,
  type SkillTweak,
  type SkillRegistryFile,
  type WorkflowStep,
} from '@/core/services/skills';
import type { StorageService } from '@/core/services/storage';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { buildSkillMap, type SkillCtx } from './skill-context';
import { resolveWorkflowSteps, resolveWorkflowDefId, verfuegbareWorkflows, ACTIVE_WORKFLOW_ID } from './active-workflow';
import type { StepId } from './types';

// ── 1. Geltende Workflow-Definition ──────────────────────────────────────────

export interface WorkflowRegistrySicht {
  /** Zuletzt geladene Registry-Datei (Quelle der Dropdown-Optionen im dev-Editor). */
  regFile: SkillRegistryFile | null;
  /** Schritt-ID → Skill + Regeln. */
  skillMap: Map<StepId, SkillCtx>;
  /** Generierungs-Schrittfolge (ohne die reinen QS-Schritte). */
  steps: WorkflowStep[];
  /** Ziel-Generierungs-Schritt-ID → der bewertende llm_qs-Schritt. */
  qsZiele: Map<StepId, WorkflowStep>;
  relevanzSkill: SkillRecord;
  lektorSkill: SkillRecord;
  /** dev-Test-Workflowwahl (nur lokal, resettet pro Reload). */
  testWorkflowId: string | null;
  setTestWorkflowId: (id: string | null) => void;
  verfuegbar: ReturnType<typeof verfuegbareWorkflows>;
  /** ID des tatsächlich laufenden GA-Workflows (der dev-Inline-Editor bearbeitet genau diese Def). */
  activeWorkflowId: string;
  /** Registry-abgeleiteten Zustand aus einer bereits geladenen Datei setzen. */
  applyRegistry: (loadedFile: SkillRegistryFile) => void;
  /** Registry frisch lesen und nur die registry-abgeleiteten Teile neu setzen. */
  reloadRegistry: () => void;
}

export function useWorkflowRegistry(
  storage: StorageService,
  erlaubeEntwuerfe: boolean,
): WorkflowRegistrySicht {
  const [regFile, setRegFile] = useState<SkillRegistryFile | null>(null);
  const [skillMap, setSkillMap] = useState<Map<StepId, SkillCtx>>(new Map());
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [qsZiele, setQsZiele] = useState<Map<StepId, WorkflowStep>>(new Map());
  // Relevanz-Map- und Lektor-Skill aus der geladenen Registry (kurator-pflegbar), Seeds als Fallback.
  const [relevanzSkill, setRelevanzSkill] = useState<SkillRecord>(SEED_RELEVANZ_MAP_SKILL);
  const [lektorSkill, setLektorSkill] = useState<SkillRecord>(SEED_GA_LEKTOR_SKILL);
  const [testWorkflowId, setTestWorkflowId] = useState<string | null>(null);

  const verfuegbar = useMemo(
    () => (regFile ? verfuegbareWorkflows(regFile, 'ga', { erlaubeEntwuerfe }) : []),
    [regFile, erlaubeEntwuerfe],
  );

  const activeWorkflowId = useMemo(
    () => (regFile ? resolveWorkflowDefId(regFile, 'ga', { erlaubeEntwuerfe, workflowId: testWorkflowId ?? undefined }) : ACTIVE_WORKFLOW_ID),
    [regFile, erlaubeEntwuerfe, testWorkflowId],
  );

  // Geteilt von Mount-Effekt UND `reloadRegistry` (dev-Inline-Editor).
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

  // dev-Inline-Editor: Registry frisch lesen; Run/VB (Fortschritt) bleiben unberührt
  // (kein Neuladen des Laufs).
  const reloadRegistry = useCallback((): void => {
    void (async () => {
      const loaded = await loadSkillRegistry(storage);
      applyRegistry(loaded.file);
    })();
  }, [storage, applyRegistry]);

  return {
    regFile, skillMap, steps, qsZiele, relevanzSkill, lektorSkill,
    testWorkflowId, setTestWorkflowId, verfuegbar, activeWorkflowId,
    applyRegistry, reloadRegistry,
  };
}

// ── 2. Erreichbarkeit der internen KI ────────────────────────────────────────

export interface LlmProbeArgs {
  bridge: AIBridge;
  /** Live-Verbindungsstatus (Heartbeat-Store) — Reconnect löst eine neue Probe aus. */
  bridgeStatus: string;
  /** Läuft gerade eine Generierung? Dann NICHT proben (single-window-Bridge, Pitfall #36). */
  busy: boolean;
  /** Der aktive Abschnitt — sein Wechsel ist der Haupt-Auslöser. */
  aktiverSchritt: StepId;
  /** Erst proben, wenn die VB geladen ist. */
  vbVorhanden: boolean;
  /** Beim bereits freigegebenen aktiven Schritt ist Generierung nicht relevant. */
  aktiverSchrittFreigegeben: boolean;
}

/**
 * Erreichbarkeit der internen KI (neu) proben. War die KI zwischenzeitlich getrennt
 * und ist wieder verbunden, muss der nächste Schritt generierbar sein — sonst bliebe
 * `llmAvailable` auf einem veralteten `false` stehen und „KI nicht erreichbar" bliebe
 * trotz bestehender Verbindung sichtbar (Bug). Trigger:
 *  • initial, sobald die VB geladen ist,
 *  • Wechsel des aktiven Abschnitts (der vom Nutzer genannte „nächste Workflow-Schritt"),
 *  • Reconnect der Bridge (`bridgeStatus` → 'connected', auch ohne Schrittwechsel),
 *  • Ende einer Generierung (`busy` → false, u.a. nach Abbruch durch Trennung).
 * PASSIV (`openIfNeeded: false`): kein ungefragter KI-Tab, pingt nur ein bereits offenes
 * Bridge-Fenster.
 *
 * Der Setter wandert mit nach draußen: die Generierungs-Läufe und der Quellen-Refresh
 * melden ihr Ping-Ergebnis ebenfalls hierher zurück.
 */
export function useLlmErreichbarkeit(
  args: LlmProbeArgs,
): [boolean | null, React.Dispatch<React.SetStateAction<boolean | null>>] {
  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(null);
  const { bridge, bridgeStatus, busy, aktiverSchritt, vbVorhanden, aktiverSchrittFreigegeben } = args;

  useEffect(() => {
    if (busy || !vbVorhanden || aktiverSchrittFreigegeben) return undefined;
    let cancelled = false;
    (async () => {
      try { const ok = await bridge.getActiveTransport().ping({ openIfNeeded: false }); if (!cancelled) setLlmAvailable(ok); }
      catch { if (!cancelled) setLlmAvailable(false); }
    })();
    return () => { cancelled = true; };
    // `run` bewusst NICHT in den Deps (sonst Re-Probe nach jedem persist/Bearbeiten) — beim
    // Schrittwechsel ist es im Closure ohnehin frisch (aktiverSchritt leitet sich daraus ab).
  }, [aktiverSchritt, vbVorhanden, bridgeStatus, busy, bridge]); // eslint-disable-line react-hooks/exhaustive-deps

  return [llmAvailable, setLlmAvailable];
}

// ── 3. Persönlicher Tweak des aktiven Skills ─────────────────────────────────

/**
 * Tweak des AKTIVEN Skills laden (wechselt mit dem aktiven Schritt). Der Setter
 * geht mit nach draußen, weil Speichern und Löschen des Tweaks im Aufrufer sitzen
 * (sie schreiben zusätzlich in den persönlichen Ordner).
 */
export function useSkillTweak(
  idb: IDBStore,
  activeSkillId: string | undefined,
): [SkillTweak | null, React.Dispatch<React.SetStateAction<SkillTweak | null>>] {
  const [tweak, setTweak] = useState<SkillTweak | null>(null);

  useEffect(() => {
    if (!activeSkillId) return;
    let cancelled = false;
    (async () => {
      const persHandle = await getPersoenlichHandle(idb).catch(() => null);
      const t = await loadSkillTweak(idb, persHandle, activeSkillId).catch(() => null);
      if (!cancelled) setTweak(t);
    })();
    return () => { cancelled = true; };
  }, [activeSkillId, idb]);

  return [tweak, setTweak];
}
