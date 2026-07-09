// Feedback-Status → Fortschritts-Stepper-Position (Redesign v2.208).
//
// Reine Ableitung der 4-Stationen-Pipeline-Position aus dem Feedback-`kurator_status`.
// `abgelehnt` ist KEINE Pipeline-Station, sondern ein Seitenpfad (Neu → ✕ Abgelehnt).
// Vergleiche laufen über die `FEEDBACK_STATUS`-Konstante (Pitfall #21, Convention-Test
// `no-direct-feedback-status-compare`), nie gegen String-Literale. Analog zu
// `src/plugins/antraege/statusZuStepperPosition.ts` (amtlicher Antrags-Status).

import type { FeedbackStatus } from '@/core/types/feedback';
import { FEEDBACK_STATUS } from './feedback-status';

/** Die vier Pipeline-Stationen (Reihenfolge = Fortschritt). `abgelehnt`/`archiviert`
 *  sind bewusst NICHT enthalten (Seitenpfad bzw. ausgeblendet). */
export const FEEDBACK_PIPELINE: readonly FeedbackStatus[] = [
  FEEDBACK_STATUS.neu,
  FEEDBACK_STATUS.geplant,
  FEEDBACK_STATUS.in_bearbeitung,
  FEEDBACK_STATUS.umgesetzt,
];

export interface FeedbackStepperPosition {
  /** 0-basierter Index in `FEEDBACK_PIPELINE` (bei `rejected`: 0 = Startknoten „Neu"). */
  index: number;
  /** Seitenpfad: Neu → ✕ Abgelehnt (statt der geraden Pipeline). */
  rejected: boolean;
}

/**
 * Bildet einen Feedback-Status auf die Stepper-Position ab.
 * - `abgelehnt` → `{ index: 0, rejected: true }` (Seitenpfad).
 * - `archiviert` → wie `umgesetzt` (letzte Station; wird i.d.R. gar nicht angezeigt,
 *   da die Board-Basis Archiviertes ausblendet).
 * - sonst → 0-basierter Index in der Pipeline (unbekannt/nicht gefunden → 0).
 */
export function feedbackStepperPosition(status: FeedbackStatus): FeedbackStepperPosition {
  if (status === FEEDBACK_STATUS.abgelehnt) return { index: 0, rejected: true };
  if (status === FEEDBACK_STATUS.archiviert) {
    return { index: FEEDBACK_PIPELINE.length - 1, rejected: false };
  }
  const index = FEEDBACK_PIPELINE.indexOf(status);
  return { index: index < 0 ? 0 : index, rejected: false };
}
