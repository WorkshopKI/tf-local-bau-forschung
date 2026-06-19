/**
 * Adapter: liefert die geordnete Schrittliste des AKTIVEN Gutachten-Workflows aus
 * der geladenen Registry. Heute genau eine Definition (`zim-ep`). Fehlt sie (oder
 * ist sie leer), fällt die Laufzeit auf den Seed `ZIM_EP_DEF` zurück — so bleibt
 * das Verhalten für zim-ep identisch zur früheren Hartverdrahtung, auch bevor der
 * Seed-on-open die Definition auf den Share geschrieben hat.
 *
 * (Phase 5 schaltet hier zusätzlich die topologische Flachklappung der einen
 * Unterschritt-Ebene davor.)
 */
import { ZIM_EP_DEF, type SkillRegistryFile, type WorkflowStep } from '@/core/services/skills';

/** ID des aktiven Workflows (v1: nur ZIM-EP). */
export const ACTIVE_WORKFLOW_ID = 'zim-ep';

/** Geordnete Schritte des aktiven Workflows (Fallback: Seed `ZIM_EP_DEF`). */
export function resolveActiveWorkflow(file: SkillRegistryFile): WorkflowStep[] {
  const def = file.workflows?.find(w => w.id === ACTIVE_WORKFLOW_ID);
  return def && def.steps.length > 0 ? def.steps : ZIM_EP_DEF.steps;
}
