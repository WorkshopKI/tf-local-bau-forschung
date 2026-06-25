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
 * Wählt die geordneten Schritte des besten verfügbaren Workflows eines Typs.
 * Kandidaten: gleicher `artefaktTyp` (fehlt → `'ga'`), nicht deaktiviert
 * (`aktiv !== false`) und durch das reine Freigabe-Gate `istWorkflowVerfuegbar`.
 * Tie-Break: freigegeben vor Entwurf, dann höchste `version`. Kein Treffer für
 * `'ga'` (oder leere Schritte) → Seed `ZIM_EP_DEF.steps`. REIN — der Flag kommt
 * als Arg (Ableitung nur am Aufrufer-Rand).
 */
export function resolveWorkflowSteps(
  file: SkillRegistryFile,
  artefaktTyp: ArtefaktTyp,
  { erlaubeEntwuerfe }: { erlaubeEntwuerfe: boolean },
): WorkflowStep[] {
  const kandidaten = (file.workflows ?? []).filter(w =>
    (w.artefaktTyp ?? 'ga') === artefaktTyp
    && w.aktiv !== false
    && istWorkflowVerfuegbar(w, { erlaubeEntwuerfe }),
  );
  kandidaten.sort((a, b) => {
    const ea = a.freigabe === 'entwurf' ? 1 : 0;
    const eb = b.freigabe === 'entwurf' ? 1 : 0;
    if (ea !== eb) return ea - eb;              // freigegeben (0) vor Entwurf (1)
    return (b.version ?? 0) - (a.version ?? 0); // höchste Version zuerst
  });
  const best: WorkflowDef | undefined = kandidaten[0];
  const steps = best && best.steps.length > 0
    ? best.steps
    : (artefaktTyp === 'ga' ? ZIM_EP_DEF.steps : (best?.steps ?? []));
  return flattenStepsTopological(steps);
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
