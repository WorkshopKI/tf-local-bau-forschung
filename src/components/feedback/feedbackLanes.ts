/**
 * Geteilte Lane-Definition der Feedback-Kanbans — genutzt vom Feedback-BOARD
 * (src/plugins/feedback-board) und vom Home-WIDGET
 * (src/plugins/home/widgets/feedbackKanbanLanes.ts).
 *
 * Lanes binden an Feedback-STATUS (FEEDBACK_STATUS, Pitfall #21 — nie
 * Roh-Literale). Archiviert erscheint nie als Spalte; Lob (`category ===
 * 'praise'`) hat keinen Workflow und wird von den Aufrufern herausgefiltert.
 *
 * Liegt bewusst unter src/components/: src/components/feedback darf nicht in
 * src/plugins/ importieren (Schichtung + Laufzeit-Zyklen).
 */
import type { FeedbackStatus } from '@/core/types/feedback';
import { FEEDBACK_STATUS } from '@/core/services/feedback/feedback-status';
import { monoLaneAccent, type LaneFarbmodus } from '@/components/kanban/laneAccent';
import { STATUS_LANE_ACCENT } from './constants';

/**
 * Wählbare Feedback-Lanes in Design-Reihenfolge: Abgelehnt steht bewusst an
 * Position 2 (daher explizit statt aus FEEDBACK_PIPELINE abgeleitet).
 * Gleichzeitig die Default-Spaltenfolge des Boards.
 */
export const FEEDBACK_LANE_STATUS: readonly FeedbackStatus[] = [
  FEEDBACK_STATUS.neu,
  FEEDBACK_STATUS.abgelehnt,
  FEEDBACK_STATUS.geplant,
  FEEDBACK_STATUS.in_bearbeitung,
  FEEDBACK_STATUS.umgesetzt,
];

/** Eine konfigurierte Lane: welcher Status, wie viele Kartenspalten. */
export interface FeedbackLane {
  status: FeedbackStatus;
  spalten: 1 | 2;
}

const FEEDBACK_LANE_FALLBACK = 'var(--tf-text-tertiary)';

/** Lane-Akzent: bunt = Status-Token (STATUS_LANE_ACCENT), monochrom = Primär-Hue
 *  zyklisch nach Index (geteilt mit dem Anträge-Kanban). Kein Hex. */
export function feedbackLaneAccent(
  farbmodus: LaneFarbmodus,
  status: FeedbackStatus,
  laneIndex: number,
): string {
  if (farbmodus === 'monochrom') return monoLaneAccent(laneIndex);
  return STATUS_LANE_ACCENT[status] ?? FEEDBACK_LANE_FALLBACK;
}
