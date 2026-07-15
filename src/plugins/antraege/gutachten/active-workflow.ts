/**
 * Adapter: liefert die geordnete Schrittliste eines Workflows je `artefaktTyp`
 * aus der geladenen Registry — unter dem Freigabe/Variant-Gate. Fehlt ein
 * verfügbarer GA-Workflow (oder ist er leer), fällt die Laufzeit auf den Seed
 * `ZIM_EP_DEF` zurück, so bleibt das Verhalten für zim-ep identisch zur früheren
 * Hartverdrahtung — auch bevor der Seed-on-open die Definition auf den Share
 * geschrieben hat.
 *
 * Die eine Unterschritt-Ebene wird topologisch flachgeklappt (Parent vor Kindern)
 * → die Laufzeit (Runner, Stepper, Batch) iteriert eine flache, korrekt geordnete
 * Liste. Für die flache zim-ep-Def ist das die Identität.
 */
import {
  ZIM_EP_DEF, flattenStepsTopological, istWorkflowVerfuegbar,
  type ArtefaktTyp, type SkillRegistryFile, type WorkflowDef, type WorkflowStep,
} from '@/core/services/skills';
import { erlaubeWorkflowEntwuerfe } from '@/config/feature-flags';

/** ID des Default-GA-Workflows (Seed-Fallback). */
export const ACTIVE_WORKFLOW_ID = 'zim-ep';

/**
 * Kandidaten-Prädikat (EINE Quelle): ein Workflow ist wählbar, wenn er den
 * gesuchten `artefaktTyp` trägt (fehlt → `'ga'`), nicht deaktiviert ist
 * (`aktiv !== false`) und das reine Freigabe-Gate `istWorkflowVerfuegbar` erfüllt.
 * Geteilt von `resolveWorkflowSteps` (Tie-Break + explizite Wahl) und
 * `verfuegbareWorkflows` (Dropdown) — kein zweiter Filter.
 */
function istWorkflowKandidat(w: WorkflowDef, artefaktTyp: ArtefaktTyp, erlaubeEntwuerfe: boolean): boolean {
  return (w.artefaktTyp ?? 'ga') === artefaktTyp
    && w.aktiv !== false
    && istWorkflowVerfuegbar(w, { erlaubeEntwuerfe });
}

/**
 * Alle wählbaren Workflows eines Typs (für das dev-Test-Dropdown), sortiert
 * freigegeben-zuerst, dann nach Name. Rein — Flag als Arg.
 */
export function verfuegbareWorkflows(
  file: SkillRegistryFile,
  artefaktTyp: ArtefaktTyp,
  { erlaubeEntwuerfe }: { erlaubeEntwuerfe: boolean },
): WorkflowDef[] {
  return (file.workflows ?? [])
    .filter(w => istWorkflowKandidat(w, artefaktTyp, erlaubeEntwuerfe))
    .sort((a, b) => {
      const ea = a.freigabe === 'entwurf' ? 1 : 0;
      const eb = b.freigabe === 'entwurf' ? 1 : 0;
      if (ea !== eb) return ea - eb;       // freigegeben zuerst
      return a.name.localeCompare(b.name); // dann alphabetisch
    });
}

/**
 * Bester Kandidat eines Typs (EINE Quelle für Schritte + ID). Eine **explizite**
 * `workflowId` (dev-Test) gewinnt, wenn der Workflow existiert, den Kandidaten-
 * Test erfüllt und Schritte hat. Sonst der beste Kandidat per Tie-Break
 * (freigegeben vor Entwurf, dann höchste `version`). `undefined`, wenn es keinen
 * kuratierten Kandidaten gibt (Aufrufer entscheidet den Seed-Fallback). REIN.
 */
function besterKandidat(
  file: SkillRegistryFile,
  artefaktTyp: ArtefaktTyp,
  erlaubeEntwuerfe: boolean,
  workflowId?: string,
): WorkflowDef | undefined {
  if (workflowId) {
    const gewaehlt = (file.workflows ?? []).find(w => w.id === workflowId);
    if (gewaehlt && gewaehlt.steps.length > 0 && istWorkflowKandidat(gewaehlt, artefaktTyp, erlaubeEntwuerfe)) {
      return gewaehlt;
    }
  }
  const kandidaten = (file.workflows ?? []).filter(w => istWorkflowKandidat(w, artefaktTyp, erlaubeEntwuerfe));
  kandidaten.sort((a, b) => {
    const ea = a.freigabe === 'entwurf' ? 1 : 0;
    const eb = b.freigabe === 'entwurf' ? 1 : 0;
    if (ea !== eb) return ea - eb;              // freigegeben (0) vor Entwurf (1)
    return (b.version ?? 0) - (a.version ?? 0); // höchste Version zuerst
  });
  return kandidaten[0];
}

/**
 * Wählt die geordneten Schritte eines Workflows eines Typs (über `besterKandidat`).
 * Kein Treffer für `'ga'` (oder leere Schritte) → Seed `ZIM_EP_DEF.steps`. REIN —
 * der Flag kommt als Arg (Ableitung nur am Aufrufer-Rand).
 */
export function resolveWorkflowSteps(
  file: SkillRegistryFile,
  artefaktTyp: ArtefaktTyp,
  { erlaubeEntwuerfe, workflowId }: { erlaubeEntwuerfe: boolean; workflowId?: string },
): WorkflowStep[] {
  const best = besterKandidat(file, artefaktTyp, erlaubeEntwuerfe, workflowId);
  const steps = best && best.steps.length > 0
    ? best.steps
    : (artefaktTyp === 'ga' ? ZIM_EP_DEF.steps : (best?.steps ?? []));
  return flattenStepsTopological(steps);
}

/**
 * ID des aktiven Workflows (gleiche Wahl-Logik wie `resolveWorkflowSteps`) — für
 * den dev-Inline-Editor, der die tatsächlich laufende Def bearbeiten muss. Fällt
 * für `'ga'` auf `ACTIVE_WORKFLOW_ID` (Seed `zim-ep`) zurück, wenn kein kuratierter
 * Kandidat mit Schritten existiert. REIN.
 */
export function resolveWorkflowDefId(
  file: SkillRegistryFile,
  artefaktTyp: ArtefaktTyp,
  { erlaubeEntwuerfe, workflowId }: { erlaubeEntwuerfe: boolean; workflowId?: string },
): string {
  const best = besterKandidat(file, artefaktTyp, erlaubeEntwuerfe, workflowId);
  if (best && best.steps.length > 0) return best.id;
  return artefaktTyp === 'ga' ? ACTIVE_WORKFLOW_ID : (best?.id ?? ACTIVE_WORKFLOW_ID);
}

/**
 * Topologisch geordnete Schritte des aktiven GA-Workflows (Default-Pfad; Aufrufer:
 * `skill-context`, `useGutachtenWorkflow`, `useBatchJob`). Dünner Wrapper über
 * `resolveWorkflowSteps('ga', …)`; der `erlaubeEntwuerfe`-Flag wird am Aufrufer-
 * Rand aus der Variant-Config abgeleitet (`erlaubeWorkflowEntwuerfe`). GA
 * byte-identisch — zim-ep ist der einzige freigegebene `ga`.
 */
export function resolveActiveWorkflow(file: SkillRegistryFile): WorkflowStep[] {
  return resolveWorkflowSteps(file, 'ga', { erlaubeEntwuerfe: erlaubeWorkflowEntwuerfe() });
}
