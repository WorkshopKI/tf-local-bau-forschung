/**
 * Der Generierungs-Kern des Gutachten-Workflows — ohne React.
 *
 * `useGutachtenWorkflow` mischte vier Verantwortungen in 870 Zeilen: Registry laden,
 * persistieren, generieren und die Schritt-/Neben-Aktionen. Der Generierungsteil war
 * der größte und zugleich der einzige, der nichts von React braucht: er bekommt einen
 * Run herein, fährt Transport + Skill und gibt einen neuen Run zurück. Genau das
 * steht hier — der Hook bleibt die dünne Bindung (busy/abort/persist/Fehlerbanner).
 *
 * Alle Abhängigkeiten kommen als **explizites** `deps`-Objekt herein. Das ist
 * absichtlich unbequem: jede Zeile, die etwas Neues braucht, muss es hier deklarieren,
 * statt es sich still aus einer Closure zu nehmen.
 *
 * Invarianten, die beim Verschieben NICHT verrutschen durften:
 *  - Transport IMMER über `bridge.getTransportForSkillRun(skill)` (Pitfall #30/#35).
 *  - `runSkill` resettet den Chat vor dem Submit (Pitfall #36) — das liegt im Runner.
 *  - Die drei `korpusMd`-Stellen in einem Lauf MÜSSEN dieselbe Zeichenkette sehen
 *    (siehe Kommentar an der Relevanz-Map unten).
 */
import type { AIBridge } from '@/core/services/ai/bridge';
import type { IDBStore } from '@/core/services/storage/idb-store';
import {
  runSkill, runRegelChecks,
  type CheckResult, type SkillModifierKey, type QualitaetsRegel, type SkillRecord,
  type SkillTweak, type WorkflowStep,
} from '@/core/services/skills';
import { aktivesZielFuerLauf, kontextZielFuerLauf } from '@/core/services/ai/ki-ziel';
import { getVbCharCap } from '@/core/services/ai/llm-context';
import type { ThinkingBudget } from '@/core/services/ai/llm-thinking';
import { kiVerbindungBereit } from '@/core/services/ai/ki-guard';
import { buildStammdaten, type SkillCtx } from './skill-context';
import type { KurzfassungContext } from '../kurzfassung/types';
import { buildVorherigeAbschnitte, buildVbRelevant } from './context-provider';
import { getTeilPlan, teilAufgabe, teilRegeln, mergeTeile, type TeilErgebnis } from './teilGenerierung';
import { getOrComputeRelevanzMap, vbBrauchtRelevanzMap, type RelevanzAbschnitt } from './relevanz-map';
import { applyGeneration, applyLektorat, applyQsHinweise, type GenerationInput } from './runner';
import { istVerdaechtigGekuerzt } from './lektorat';
import { parseQsBefunde } from './qs';
import type { StepId, WorkflowRun } from './types';

/** Die Streaming-Senke eines Laufs (aus `useStreamingBuffer`). */
export interface StreamSenke {
  reset: () => void;
  onContentDelta: (text: string) => void;
  onThinkingDelta: (text: string) => void;
}

/**
 * Alles, was ein Lauf aus der Umgebung braucht. Bewusst EIN Objekt statt vierzehn
 * Parameter — und bewusst vollständig, damit hier nichts implizit aus einer
 * React-Closure kommt.
 */
export interface GenerierungsDeps {
  idb: IDBStore;
  bridge: AIBridge;
  ctx: KurzfassungContext;
  /** Verbund-Key (Cache-Key der Relevanz-Map). */
  key: string;
  /** Skill + Regeln je Schritt (aus der Registry aufgelöst). */
  skillMap: Map<StepId, SkillCtx>;
  /** Geordnete Generierungs-Schritte des aktiven Workflows. */
  steps: WorkflowStep[];
  /** Der Text, der tatsächlich ins Modell geht (VB oder VB+Korpus-Auswahl). */
  korpusMd: string;
  /** Ist eine maßgebliche VB aufgelöst? Ohne sie wird nicht generiert. */
  vbVorhanden: boolean;
  relevanzSkill: SkillRecord;
  lektorSkill: SkillRecord;
  thinkingBudget: ThinkingBudget;
  /** Pro-Lauf-Override „vollständigen Kontext erzwingen" (ignoriert die Relevanz-Map). */
  forceFullContext: boolean;
  stream: StreamSenke;
  /** Regeln eines Schritts inkl. persönlichem Vorgaben-Override. */
  regelnFuer: (sc: SkillCtx, tw: SkillTweak | null) => QualitaetsRegel[];
  setLlmAvailable: (ok: boolean) => void;
  setError: (msg: string) => void;
}

export interface GenerateIntoOptions {
  modifier?: SkillModifierKey;
  quelle: 'freigegeben' | 'entwurf';
  tweak: SkillTweak | null;
  signal: AbortSignal;
  /** Journey-Paket 3: regel-gebundene Zusatz-Anweisung + auslösende Regel-ID. */
  zusatzAnweisung?: string;
  korrekturRegelId?: string;
}

/**
 * Generierungs-Kern für EINEN Abschnitt — gegen einen ÜBERGEBENEN `base`-Run
 * (kein Closure-Run, damit der Bulk-Lauf den frischen Stand durchreichen kann).
 * Liefert `{ next, checks }` oder `null` (Transport nicht erreichbar → `setError`
 * gerufen). Wirft bei echten Fehlern/Abbruch — der jeweilige Orchestrator im Hook
 * fängt das und besitzt busy/abort/persist. Der Tweak wird ÜBERGEBEN (nicht aus einer
 * Closure), damit der Bulk-Lauf pro Schritt den zum jeweiligen Skill gehörenden nutzt.
 */
export async function generateInto(
  base: WorkflowRun,
  stepId: StepId,
  o: GenerateIntoOptions,
  deps: GenerierungsDeps,
): Promise<{ next: WorkflowRun; checks: CheckResult[] } | null> {
  const sc = deps.skillMap.get(stepId);
  if (!sc || !deps.vbVorhanden) return null;
  // KI-Preflight: nicht verbunden → Verbinden-Prompt statt stiller Tab-Öffnung (ping).
  if (!kiVerbindungBereit(deps.bridge)) return null;
  deps.stream.reset();
  const transport = deps.bridge.getTransportForSkillRun(sc.skill);
  const ok = await transport.ping();
  deps.setLlmAvailable(ok);
  if (!ok) { deps.setError('KI nicht erreichbar — Generierung derzeit nicht möglich.'); return null; }
  const tw = o.tweak;
  const scRegeln = deps.regelnFuer(sc, tw);
  const tweakWirksam = !!(tw?.aktiv && tw.skillId === sc.skill.id
    && (tw.stilHinweise.trim() || tw.beispielFormulierungen.trim()));
  const prevText = base.schritte[stepId]?.finalerText;
  // Relevanz-Map: nur wenn der Schritt `kontextBedarf: 'relevant'` trägt UND die
  // VB groß genug ist. JEDER Fehlerpfad (Map leer / Lauf gescheitert) degradiert
  // still zu Volltext — kein `vbRelevant` → der Skill nutzt {{vbMarkdown}} wie bisher.
  let vbRelevant: string | undefined;
  const stepDef = deps.steps.find(s => s.id === stepId);
  // ACHTUNG: die drei `korpusMd`-Stellen hier MÜSSEN dieselbe Zeichenkette sehen.
  // `getOrComputeRelevanzMap` rechnet Heading-SPANS in den übergebenen String, und
  // `buildVbRelevant` sliced später mit genau diesen Offsets. Wer nur einen der
  // Aufrufe umstellt, bekommt keinen Fehler — nur stillschweigend den falschen
  // Textausschnitt im Prompt (siehe korpus-kontext.test.ts).
  if (!deps.forceFullContext && stepDef?.kontextBedarf === 'relevant' && vbBrauchtRelevanzMap(deps.korpusMd)) {
    try {
      const abschnitte: RelevanzAbschnitt[] = deps.steps.map(s => ({ id: s.id, label: s.label }));
      const relevanz = await getOrComputeRelevanzMap(deps.idb, transport, deps.relevanzSkill, deps.key, deps.korpusMd, abschnitte);
      const block = buildVbRelevant(relevanz, deps.korpusMd, stepId, getVbCharCap(kontextZielFuerLauf(deps.bridge)));
      if (block) vbRelevant = block;
    } catch {
      // Relevanz-Lauf gescheitert → Volltext-Fallback (nie scheitern).
    }
  }
  // Teil-Generierung (unsichtbar): B (Hintergrund/Stand der Technik/Lösungsweg,
  // ≥ 750 Wörter) sprengt das feste Output-Budget des internen LLM → der finale Text
  // wird abgeschnitten. Daher B in mehreren kürzeren Läufen erzeugen und zu EINEM
  // Abschnitt zusammenführen. Nur bei frischer Generierung (kein Modifier/Korrektur-
  // Lauf); im Teil-Prompt fallen die Gesamt-Größen-Regeln weg, der finale Check läuft
  // mit dem VOLLEN Regelsatz gegen den gemergten Text.
  const teilPlan = getTeilPlan(sc.skill.id);
  if (teilPlan && !o.modifier) {
    const vorherige = buildVorherigeAbschnitte(base, stepId, deps.steps, 2000, o.quelle);
    const teilRegelSatz = teilRegeln(scRegeln);
    const teilErgebnisse: TeilErgebnis[] = [];
    let letztesResult: Awaited<ReturnType<typeof runSkill>> | null = null;
    let vorText = '';
    for (const teil of teilPlan) {
      const r = await runSkill(transport, sc.skill, teilRegelSatz, {
        ziel: aktivesZielFuerLauf(),
        stammdaten: buildStammdaten(deps.ctx),
        vbMarkdown: deps.korpusMd,
        vbCharCap: getVbCharCap(kontextZielFuerLauf(deps.bridge)),
        thinkingBudget: deps.thinkingBudget,
        erwarteAbschluss: 'Finaler Text',
        onContentDelta: deps.stream.onContentDelta,
        onThinkingDelta: deps.stream.onThinkingDelta,
        vorherigeAbschnitte: vorherige,
        teilAufgabe: teilAufgabe(teil, vorText),
        ...(vbRelevant ? { vbRelevant } : {}),
        ...(tweakWirksam ? { tweak: tw } : {}),
        ...(o.zusatzAnweisung ? { zusatzAnweisung: o.zusatzAnweisung } : {}),
        signal: o.signal,
      });
      teilErgebnisse.push({
        quellenanalyse: r.parsed.quellenanalyse,
        finalerText: r.parsed.finalerText,
        ...(r.thinking ? { thinking: r.thinking } : {}),
        vbGekuerzt: r.vbGekuerzt,
        ...(r.parsed.warnung ? { warnung: r.parsed.warnung } : {}),
      });
      letztesResult = r;
      vorText = [vorText, r.parsed.finalerText].map(t => t.trim()).filter(Boolean).join('\n\n');
    }
    const merged = mergeTeile(teilErgebnisse);
    const checks = runRegelChecks(merged.finalerText, scRegeln);
    const gen: GenerationInput = {
      quellenanalyse: merged.quellenanalyse,
      entwurf: merged.entwurf,
      finalerText: merged.finalerText,
      checks,
      modell: transport.displayName ?? transport.name,
      skillId: sc.skill.id,
      skillVersion: sc.skill.version,
      vbGekuerzt: merged.vbGekuerzt,
      ...(merged.warnung ? { warnung: merged.warnung } : {}),
      ...(letztesResult?.chatResetStatus ? { chatResetStatus: letztesResult.chatResetStatus } : {}),
      ...(tweakWirksam ? { mitTweak: true, tweakGeaendertAm: tw!.geaendert_am } : {}),
      ...(merged.thinking ? { denkprozess: merged.thinking } : {}),
      ...(deps.thinkingBudget !== 'none' ? { denkprozessAngefordert: true } : {}),
    };
    return { next: applyGeneration(base, stepId, gen, new Date().toISOString()), checks };
  }

  const result = await runSkill(transport, sc.skill, scRegeln, {
    ziel: aktivesZielFuerLauf(),
    stammdaten: buildStammdaten(deps.ctx),
    vbMarkdown: deps.korpusMd,
    vbCharCap: getVbCharCap(kontextZielFuerLauf(deps.bridge)),
    thinkingBudget: deps.thinkingBudget,
    // Abschluss-Marker-Schutz: A–G liefern alle „### Finaler Text" als Schluss-
    // Abschnitt. Verhindert, dass die Streamlit-Bridge einen langen Lauf schon nach
    // dem Quellenanalyse-Block finalisiert (auf DirectLLM wirkungslos).
    erwarteAbschluss: 'Finaler Text',
    onContentDelta: deps.stream.onContentDelta,
    onThinkingDelta: deps.stream.onThinkingDelta,
    vorherigeAbschnitte: buildVorherigeAbschnitte(base, stepId, deps.steps, 2000, o.quelle),
    ...(vbRelevant ? { vbRelevant } : {}),
    ...(tweakWirksam ? { tweak: tw } : {}),
    ...(o.modifier ? { modifier: o.modifier } : {}),
    ...(o.modifier && prevText ? { vorherigerText: prevText } : {}),
    ...(o.zusatzAnweisung ? { zusatzAnweisung: o.zusatzAnweisung } : {}),
    signal: o.signal,
  });
  const checks = runRegelChecks(result.parsed.finalerText, scRegeln);
  const gen: GenerationInput = {
    quellenanalyse: result.parsed.quellenanalyse,
    entwurf: result.parsed.entwurf,
    finalerText: result.parsed.finalerText,
    ...(result.parsed.teile?.length ? { teile: result.parsed.teile } : {}),
    ...(result.parsed.belege?.length ? { belege: result.parsed.belege } : {}),
    checks,
    modell: transport.displayName ?? transport.name,
    skillId: sc.skill.id,
    skillVersion: sc.skill.version,
    vbGekuerzt: result.vbGekuerzt,
    ...(result.parsed.warnung ? { warnung: result.parsed.warnung } : {}),
    ...(result.chatResetStatus ? { chatResetStatus: result.chatResetStatus } : {}),
    ...(o.modifier ? { modifier: o.modifier } : {}),
    ...(o.korrekturRegelId ? { korrekturRegelId: o.korrekturRegelId } : {}),
    ...(tweakWirksam ? { mitTweak: true, tweakGeaendertAm: tw!.geaendert_am } : {}),
    ...(result.thinking ? { denkprozess: result.thinking } : {}),
    ...(deps.thinkingBudget !== 'none' ? { denkprozessAngefordert: true } : {}),
  };
  return { next: applyGeneration(base, stepId, gen, new Date().toISOString()), checks };
}

/**
 * Beratende LLM-QS über den FINALEN Text eines Generierungs-Schritts. Nutzt
 * denselben (internen) Transport + Runner wie die Generierung; die Befunde landen
 * via `applyQsHinweise` am Ziel-Schritt (kein Text-Overwrite). Transport weg → `null`
 * (Fehler ist gesetzt), sonst der neue Run.
 */
export async function laufQs(
  run: WorkflowRun,
  zielStepId: StepId,
  qsCtx: SkillCtx,
  signal: AbortSignal,
  deps: GenerierungsDeps,
): Promise<WorkflowRun | null> {
  const zielStep = run.schritte[zielStepId];
  if (!zielStep) return null;
  deps.stream.reset();
  const transport = deps.bridge.getTransportForSkillRun(qsCtx.skill);
  const ok = await transport.ping();
  deps.setLlmAvailable(ok);
  if (!ok) { deps.setError('KI nicht erreichbar — QS derzeit nicht möglich.'); return null; }
  const zielDef = deps.steps.find(s => s.id === zielStepId);
  const result = await runSkill(transport, qsCtx.skill, qsCtx.regeln, {
    ziel: aktivesZielFuerLauf(),
    stammdaten: buildStammdaten(deps.ctx),
    vbMarkdown: deps.korpusMd,
    vbCharCap: getVbCharCap(kontextZielFuerLauf(deps.bridge)),
    thinkingBudget: deps.thinkingBudget,
    onContentDelta: deps.stream.onContentDelta,
    onThinkingDelta: deps.stream.onThinkingDelta,
    zielText: zielStep.finalerText,
    abschnittszweck: zielDef?.label ?? zielStepId,
    signal,
  });
  return applyQsHinweise(run, zielStepId, parseQsBefunde(result.raw), new Date().toISOString());
}

/**
 * Sprachlicher Feinschliff eines Entwurfs (Lektor-Skill). Bewusst KEIN
 * Generierungs-Lauf: der Prompt trägt nur den Abschnittstext (`zielText`) +
 * den Abschnittszweck — die Vorhabensbeschreibung bleibt draußen, damit der
 * Lauf strukturell nichts hinzuerfinden kann. Geprüft wird danach mit den
 * Regeln DES ABSCHNITTS (Umfang bleibt die maßgebliche Instanz).
 *
 * Zwei Abbruch-Tore VOR dem Schreiben: leeres Ergebnis und
 * `istVerdaechtigGekuerzt` (abgeschnittene Antwort) → Fehlermeldung, Abschnitt
 * bleibt unverändert (`null` zurück). Transport intern-pflichtig über
 * `getTransportForSkillRun` (Pitfall #30).
 */
export async function laufLektorat(
  run: WorkflowRun,
  stepId: StepId,
  sc: SkillCtx,
  tweak: SkillTweak | null,
  signal: AbortSignal,
  deps: GenerierungsDeps,
): Promise<WorkflowRun | null> {
  const step = run.schritte[stepId];
  if (!step) return null;
  deps.stream.reset();
  const transport = deps.bridge.getTransportForSkillRun(deps.lektorSkill);
  const ok = await transport.ping();
  deps.setLlmAvailable(ok);
  if (!ok) { deps.setError('KI nicht erreichbar — Feinschliff derzeit nicht möglich.'); return null; }
  const zielDef = deps.steps.find(s => s.id === stepId);
  const result = await runSkill(transport, deps.lektorSkill, [], {
    ziel: aktivesZielFuerLauf(),
    stammdaten: '',
    vbMarkdown: '',
    thinkingBudget: deps.thinkingBudget,
    erwarteAbschluss: 'Finaler Text',
    onContentDelta: deps.stream.onContentDelta,
    onThinkingDelta: deps.stream.onThinkingDelta,
    zielText: step.finalerText,
    abschnittszweck: zielDef?.label ?? stepId,
    signal,
  });
  const text = result.parsed.finalerText.trim();
  if (!text) {
    deps.setError('Der Feinschliff lieferte keinen Text — der Abschnitt bleibt unverändert.');
    return null;
  }
  if (istVerdaechtigGekuerzt(step.finalerText, text)) {
    deps.setError('Der Feinschliff wirkt abgeschnitten (deutlich kürzer als der Abschnitt) — der Abschnitt bleibt unverändert. Bitte erneut versuchen.');
    return null;
  }
  return applyLektorat(run, stepId, {
    finalerText: text,
    checks: runRegelChecks(text, deps.regelnFuer(sc, tweak)),
    modell: transport.displayName ?? transport.name,
    ...(result.chatResetStatus ? { chatResetStatus: result.chatResetStatus } : {}),
  }, new Date().toISOString());
}
