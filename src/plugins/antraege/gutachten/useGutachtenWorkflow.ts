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
import { kiVerbindungBereit } from '@/core/services/ai/ki-guard';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { appendFeedback, getUserId, resolveInstallId, type Rating } from '@/core/services/skill-feedback';
import {
  loadSkillRegistry,
  runRegelChecks,
  regelnMitOverride,
  resolveRegeln,
  renderSkillPrompt,
  type SkillRunInput,
  type RenderedSkillPrompt,
  loadSkillTweak,
  saveSkillTweak,
  deleteSkillTweak,
  clampMaxRetries,
  type CheckResult,
  type SkillModifierKey,
  type QualitaetsRegel,
  type SkillRecord,
  type SkillTweak,
  type WorkflowDef,
  type WorkflowStep,
} from '@/core/services/skills';
import { getLlmThinkingEnabled, budgetForThinking, type ThinkingBudget } from '@/core/services/ai/llm-thinking';
import { useBridgeStatus } from '@/core/services/ai/bridge-status';
import type { SkillCtx } from './skill-context';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import type { DocumentFull } from '@/plugins/dokumente/store';
import { useGutachtenQuellen, type GutachtenQuellen } from './useGutachtenQuellen';
import { useStreamingBuffer, type LaufPhase } from '../kurzfassung/useStreamingBuffer';
import type { KurzfassungContext } from '../kurzfassung/types';
import type { TweakEingabe } from '../kurzfassung/useKurzfassung';
import { erlaubeWorkflowEntwuerfe } from '@/config/feature-flags';
import { loadOrMigrateWorkflowRun } from './kurzfassung-migration';
import { generateInto, laufQs, laufLektorat, type GenerierungsDeps } from './workflow-generierung';
import { getTeilPlan, teilAufgabe, teilRegeln } from './teilGenerierung';
import { baueSkillEingabe, tweakWirktAuf } from './laufEingabe';
import { buildVorherigeAbschnitte } from './context-provider';
import { getVbCharCap } from '@/core/services/ai/llm-context';
import { aktivesZielFuerLauf, kontextZielFuer, useKiZiel } from '@/core/services/ai/ki-ziel';
import type { BridgeZiel } from '@/core/services/ai/transports/streamlit';
import type { GesendeterPrompt } from './promptAnsicht';
import { bestimmeZweitfassung, type ZweitfassungArt } from './zweitfassung';
import { useLlmErreichbarkeit, useSkillTweak, useWorkflowRegistry } from './workflow-hooks';
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

/**
 * Was einen Generierungs-Lauf von einer frischen Generierung unterscheidet. Als
 * Objekt statt als Positional-Liste: die drei Fälle (Modifier-Knopf, regel-gebundene
 * Korrektur, freie Anweisung) sind unabhängig voneinander und wachsen sonst zu einer
 * Kette optionaler Parameter, deren Reihenfolge man an der Aufrufstelle nicht mehr
 * sieht. Leeres Objekt = frische Generierung.
 */
interface LaufOptionen {
  modifier?: SkillModifierKey;
  kontext?: KorrekturKontext;
  /** Freie Überarbeitungs-Anweisung des Bearbeiters („Bearbeiten mit KI"). */
  anweisung?: string;
  /** Erzwungene interne KI („Zweitfassung mit der anderen KI"); sonst globale Präferenz. */
  ziel?: BridgeZiel;
  /** Erzwungene Temperatur („Zweitfassung mit anderer Einstellung"); sonst Standard. */
  temperatur?: number;
}

/**
 * Was die Prompt-Ansicht eines Abschnitts zeigt: die Vorschau des nächsten Laufs
 * und die Prompts des letzten. Beide kommen aus derselben Kette wie der echte
 * Lauf — `baueSkillEingabe` → `renderSkillPrompt` — damit die Ansicht nicht neben
 * dem Gesendeten herlaufen kann.
 */
export interface PromptAnsichtDaten {
  skill: SkillRecord;
  regeln: QualitaetsRegel[];
  eingabe: SkillRunInput;
  vorschau: RenderedSkillPrompt;
  /** Zeichen-Cap des aktuell gewählten Ziels. */
  cap: number;
  /** Der Schritt nutzt die Relevanz-Map — die Vorschau zeigt trotzdem den Volltext. */
  relevanzOffen: boolean;
  /**
   * In wie viele Teil-Läufe dieser Abschnitt zerfällt; fehlt = ein Lauf. Die
   * Vorschau zeigt dann den ERSTEN Teil (siehe `promptAnsichtFuer`).
   */
  teilAnzahl?: number;
  /** Prompts des letzten Laufs (mehrere bei Teil-Generierung); leer vor dem ersten Lauf. */
  gesendet: GesendeterPrompt[];
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
  /** Welches Bein der Lauf-Kette läuft (Generierung hängt den Feinschliff an). */
  streamPhase: LaufPhase;
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
  /**
   * Freie, einmalige Überarbeitungs-Anweisung des Bearbeiters („Bearbeiten mit KI"):
   * derselbe Lauf wie ein Modifier, nur mit selbst formuliertem Auftrag am bestehenden
   * Text. Leere Anweisung → No-op (kein Lauf, keine Fehlermeldung).
   */
  ueberarbeiten: (stepId: StepId, anweisung: string) => void;
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
  /**
   * Denselben Abschnitt noch einmal erzeugen — über die Bridge mit der ANDEREN
   * internen KI, an einer direkt angebundenen KI mit anderer Einstellung
   * (`bestimmeZweitfassung`). Die bisherige Fassung wandert dabei wie bei jeder
   * Re-Generierung in den Verlauf; verglichen und zurückgeholt wird dort
   * (Diff + „Diese Fassung übernehmen").
   */
  zweitfassungArt: ZweitfassungArt;
  zweitfassung: (stepId: StepId) => void;
  /**
   * Grundlage der Prompt-Ansicht („was geht wirklich an die KI?"). `null`, solange
   * Run oder Skill fehlen. Wird beim Öffnen des Dialogs gerufen, nicht memoisiert —
   * die Vorschau soll den Stand des Klicks zeigen (Ziel-Umschalter, Tweak, Korpus).
   */
  /** Datengrundlage der Prompt-Ansicht. Mit `entwurf` gegen einen ungespeicherten
   *  Skill-Stand aus der Werkstatt statt gegen den gespeicherten. */
  promptAnsichtFuer: (stepId: StepId, entwurf?: SkillRecord) => PromptAnsichtDaten | null;
}

export function useGutachtenWorkflow(ctx: KurzfassungContext): GutachtenWorkflowController {
  const storage = useStorage();
  const bridge = useAIBridge();
  // Live-Verbindungsstatus der internen KI (Heartbeat-Store, treibt auch „● KI"-Anzeige):
  // Übergang → 'connected' triggert unten eine erneute Erreichbarkeits-Probe.
  const bridgeStatus = useBridgeStatus(s => s.status);
  const meinKuerzel = useMeinKuerzel();
  const key = ctx.key;
  // Was eine „Zweitfassung" hier variiert: über die Bridge den Tab (andere KI),
  // an einer direkt angebundenen KI die Sampling-Temperatur — dort gibt es nur ein
  // Modell, aber sehr wohl eine zweite Einstellung (`zweitfassung.ts`).
  const kiZiel = useKiZiel(s => s.ziel);
  const zweitfassungArt = bestimmeZweitfassung(bridge.istBridgeAktiv(), kiZiel);

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
  // Was für einen Abschnitt zuletzt WIRKLICH gesendet wurde (Prompt-Ansicht).
  // Session-lokal in einer Ref: der Text trägt Dokumentinhalt und wird weder
  // persistiert noch in den Snapshot/Personal-Mirror geschrieben. Ein Reload
  // leert ihn bewusst — dann bleibt die Vorschau.
  const gesendetRef = useRef<Map<StepId, GesendeterPrompt[]>>(new Map());
  // `erlaubeEntwuerfe` ist ein Build-Konstant (dev → true), daher render-stabil.
  const erlaubeEntwuerfe = erlaubeWorkflowEntwuerfe();
  // Welche Workflow-Definition gerade gilt (Skills, Schritte, QS-Ziele, dev-Testwahl):
  // eigener Hook, eigener Auslöser — siehe workflow-hooks.ts.
  const registry = useWorkflowRegistry(storage, erlaubeEntwuerfe);
  const {
    skillMap, steps, qsZiele, relevanzSkill, lektorSkill,
    testWorkflowId, setTestWorkflowId, verfuegbar, activeWorkflowId, applyRegistry, reloadRegistry,
  } = registry;

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
    // Der Verbund wechselt — alles Sitzungs-Lokale, das sich auf den VORIGEN
    // bezieht, muss weg. Die Prompt-Ansicht ist nur nach Abschnittsbuchstabe
    // gekeyt: ohne dieses Leeren zeigte „Zuletzt gesendet" für Abschnitt A des
    // neuen Vorhabens System-Prompt, User-Prompt und die vollständige
    // Vorhabensbeschreibung des vorigen — und der Hinweis „Noch kein Lauf in
    // dieser Sitzung", der genau das benennen würde, blieb aus. Dasselbe galt
    // für das rote Fehlerbanner und die Retry-Notiz (v4.124).
    gesendetRef.current.clear();
    setError(null);
    setRetryNote(null);
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
      // Die Erreichbarkeits-Probe der internen KI läuft in einem eigenen Hook (unten),
      // damit sie nicht nur einmal beim Mount, sondern auch bei jedem Schrittwechsel greift.
    })();
    return () => { cancelled = true; };
    // testWorkflowId in den Deps: Wechsel lädt Run/Steps/SkillMap des gewählten Workflows neu.
  }, [key, storage.idb, testWorkflowId, erlaubeEntwuerfe]);

  // Erreichbarkeit der internen KI + Tweak des aktiven Skills: eigene Hooks
  // (workflow-hooks.ts). Die Setter bleiben hier greifbar — die Generierungs-Läufe
  // und `saveTweak`/`removeTweak` schreiben ebenfalls hinein.
  const [llmAvailable, setLlmAvailable] = useLlmErreichbarkeit({
    bridge,
    bridgeStatus,
    busy,
    aktiverSchritt,
    vbVorhanden: vb != null,
    aktiverSchrittFreigegeben: run?.schritte[aktiverSchritt]?.status === 'freigegeben',
  });
  const [tweak, setTweak] = useSkillTweak(storage.idb, activeSkillId);

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

  /**
   * Der aktuellste Run — auch INNERHALB eines laufenden `async`-Blocks.
   *
   * `setRun` erzeugt zwar einen neuen Render, eine schon laufende Schleife hält
   * aber weiter ihre alte Closure. Der Auto-Retry ruft `runGeneration` mehrfach
   * hintereinander: Versuch 2 baute damit auf dem Stand VOR Versuch 1 auf — der
   * Kürzen-Auftrag ging ohne den zu kürzenden Text los, und der Entwurf aus
   * Versuch 1 fiel aus dem Versionsverlauf, weil `applyGeneration` den Verlauf
   * des alten Standes anhängte (v4.124). Der Bulk-Lauf löst dasselbe Problem
   * seit je, indem er den Run lokal durchreicht.
   */
  const runRef = useRef<WorkflowRun | null>(null);
  runRef.current = run;

  const persistRoh = makePersist(storage.idb, setRun);
  const persist = async (next: WorkflowRun): Promise<void> => {
    runRef.current = next;
    await persistRoh(next);
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
    merkeGesendet: (stepId, prompts) => { gesendetRef.current.set(stepId, prompts); },
  });

  /**
   * Datengrundlage der Prompt-Ansicht: die VORSCHAU einer frischen Generierung
   * (über dieselbe `baueSkillEingabe`/`renderSkillPrompt`-Kette wie der Lauf) plus
   * das, was zuletzt tatsächlich gesendet wurde.
   *
   * Die Vorschau lässt `vbRelevant` bewusst weg — die Relevanz-Map entsteht erst im
   * Lauf (ein eigener LLM-Aufruf). Trägt der Schritt `kontextBedarf: 'relevant'`,
   * sagt `relevanzOffen` das an, statt eine Genauigkeit vorzutäuschen.
   */
  const promptAnsichtFuer = (stepId: StepId, entwurf?: SkillRecord): PromptAnsichtDaten | null => {
    const sc = skillMap.get(stepId);
    if (!sc || !run) return null;
    // `entwurf` = der ungespeicherte Stand aus der offenen Werkstatt. Dann werden
    // auch seine Regeln frisch aufgelöst — der Bearbeiter kann eine Regel gerade
    // an- oder abgewählt haben, und genau deren Vorgaben-Block will er sehen.
    const basis: SkillCtx = (entwurf && registry.regFile)
      ? { skill: entwurf, regeln: resolveRegeln(registry.regFile, entwurf) }
      : sc;
    const ziel = aktivesZielFuerLauf();
    // Wird dieser Abschnitt in TEILEN erzeugt, sendet der Lauf mehrere Prompts —
    // jeden mit Teil-Vorgabe und OHNE die Regeltypen `wortanzahl`/`absatz_min`.
    // Die Vorschau zeigte bis v4.122 einen einzelnen Prompt mit vollem Regelsatz
    // und behauptete in der Baustein-Liste aktiv „Teil-Vorgabe: nicht enthalten",
    // während der Reiter „Zuletzt gesendet" daneben zwei Prompts mit Teil-Vorgabe
    // führte. Gezeigt wird jetzt der ERSTE Teil, und die Zahl steht dabei.
    const teilPlan = getTeilPlan(basis.skill.id);
    const regeln = teilPlan ? teilRegeln(regelnFuer(basis, tweak)) : regelnFuer(basis, tweak);
    const eingabe = baueSkillEingabe({
      ctx,
      korpusMd,
      vbCharCap: getVbCharCap(kontextZielFuer(bridge, ziel)),
      thinkingBudget,
      ziel,
      vorherigeAbschnitte: buildVorherigeAbschnitte(run, stepId, steps, 2000, 'freigegeben'),
      ...(teilPlan?.[0] ? { teilAufgabe: teilAufgabe(teilPlan[0], '') } : {}),
      ...(tweakWirktAuf(basis.skill.id, tweak) ? { tweak, tweakWirksam: true } : {}),
    });
    return {
      skill: basis.skill,
      regeln,
      eingabe,
      vorschau: renderSkillPrompt(basis.skill, regeln, eingabe),
      cap: getVbCharCap(kontextZielFuer(bridge, ziel)),
      relevanzOffen: steps.find(s => s.id === stepId)?.kontextBedarf === 'relevant' && !forceFullContext,
      ...(teilPlan ? { teilAnzahl: teilPlan.length } : {}),
      gesendet: gesendetRef.current.get(stepId) ?? [],
    };
  };

  /**
   * Eine Generierung (optional mit Modifier, regel-gebundenem Korrektur-Kontext
   * oder freier Überarbeitungs-Anweisung). Liefert die berechneten Checks zurück
   * (für den Auto-Retry-Orchestrator), `null` bei Bail/Transport-weg/Abbruch/Fehler
   * — dann beendet der Orchestrator den Loop sofort (STOPP).
   */
  const runGeneration = async (stepId: StepId, o: LaufOptionen = {}): Promise<CheckResult[] | null> => {
    const { modifier, kontext, anweisung, ziel, temperatur } = o;
    if (!vb || busy || !run || !skillMap.get(stepId)) return null;
    setBusy(true);
    setError(null);
    setRetryNote(null);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      // Der FRISCHE Stand, nicht der aus der Render-Closure (siehe `runRef`).
      const res = await generateInto(runRef.current ?? run, stepId, {
        quelle: 'freigegeben', tweak, signal: abort.signal,
        ...(modifier ? { modifier } : {}),
        ...(anweisung ? { anweisung } : {}),
        ...(ziel ? { ziel } : {}),
        ...(temperatur !== undefined ? { temperatur } : {}),
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
      checks = await runGeneration(stepId, { modifier: mod });
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
    // Den geladenen Tweak SPREADEN, nicht neu bauen: `saveSkillTweak` ersetzt
    // den Datensatz, und der Stil-Dialog kennt nur drei seiner Felder. Ein
    // Speichern löschte damit still die persönlich verschobenen Kurator-Vorgaben
    // (`vorgabenOverride`) — genau die Werte, die derselbe Dialog als
    // „unveränderlich · wird geprüft" bezeichnet. Der Abschnitt meldete danach
    // „zu viele Sätze" für eine Länge, die der Nutzer selbst eingestellt hatte
    // (v4.124).
    const vorhanden = tweak?.skillId === activeCtx.skill.id ? tweak : null;
    const next: SkillTweak = {
      ...(vorhanden ?? {}),
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
    streamPhase: stream.phase,
    steps,
    testWorkflowId,
    setTestWorkflowId,
    verfuegbareWorkflows: verfuegbar,
    activeWorkflowId,
    reloadRegistry,
    aktiverSchritt,
    activeSkill: activeCtx?.skill ?? null,
    // Die WIRKSAME Regelliste — mit persönlichem Override, wie der Lauf sie
    // nimmt (`regelnFuer`). Die rohe Team-Liste durchzureichen hieß, dass die
    // „Technische Ansicht" des Stil-Dialogs unter „unveränderlich, wird geprüft"
    // den Team-Wert nannte, während Prompt und Prüfung mit dem persönlich
    // verschobenen liefen — und die Skill-Verwaltung daneben die andere Zahl
    // zeigte (v4.124).
    regeln: activeCtx ? regelnFuer(activeCtx, tweak) : [],
    tweak,
    generate: (id) => { void runGenerateMitRetry(id); },
    alleGenerieren: () => { void generiereAlle(); },
    modify: (id, m, kontext) => { void runGeneration(id, { modifier: m, ...(kontext ? { kontext } : {}) }); },
    ueberarbeiten: (id, anweisung) => {
      const text = anweisung.trim();
      if (text) void runGeneration(id, { anweisung: text });
    },
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
    promptAnsichtFuer,
    zweitfassungArt,
    zweitfassung: (id) => {
      void runGeneration(id, zweitfassungArt.art === 'ki'
        ? { ziel: zweitfassungArt.ziel }
        : { temperatur: zweitfassungArt.temperatur });
    },
  };
}
