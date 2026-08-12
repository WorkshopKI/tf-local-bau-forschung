/**
 * Geteilte Lane-Definition der Feedback-Kanbans — genutzt vom Feedback-BOARD
 * (src/plugins/feedback-board) und vom Home-WIDGET
 * (src/plugins/home/widgets/feedbackKanbanLanes.ts).
 *
 * Lanes binden an Feedback-STATUS (FEEDBACK_STATUS, Pitfall #21 — nie
 * Roh-Literale). Archiviert erscheint nie als Spalte.
 *
 * Lob (`category === 'praise'`) behandeln die beiden Aufrufer UNTERSCHIEDLICH,
 * und das ist Absicht: das Home-Widget filtert es heraus (kein Workflow), das
 * BOARD zeigt es seit v3.12 in der Spalte seines Status — sonst verspräche die
 * Typ-Facette „6 Lob" und ein Klick darauf zeigte ein leeres Board (Begründung
 * in `boardSpalten.ts`). Eine Facettenzahl ist eine Zusage; ein Widget-Ausschnitt
 * ist keine.
 *
 * Liegt bewusst unter src/components/: src/components/feedback darf nicht in
 * src/plugins/ importieren (Schichtung + Laufzeit-Zyklen).
 */
import type { FeedbackStatus } from '@/core/types/feedback';
import { FEEDBACK_STATUS } from '@/core/services/feedback/feedback-status';
import { monoLaneAccent, type LaneFarbmodus } from '@/components/kanban/laneAccent';
import { STATUS_LANE_ACCENT } from './constants';

/**
 * Wählbare Feedback-Lanes in Design-Reihenfolge — die Spalten laufen von links
 * nach rechts mit dem Fortschritt, Abgelehnt steht als Endzustand ganz rechts
 * (Handoff feedback-redesign; bis v3.11 saß es an Position 2). `rueckfrage`
 * folgt direkt auf `neu`: dort landen Tickets, die nach der Sichtung
 * zurückgestellt wurden. Explizit statt aus FEEDBACK_PIPELINE abgeleitet, weil
 * die Pipeline die beiden Seitenzustände nicht kennt.
 * Gleichzeitig die Default-Spaltenfolge des Boards.
 */
export const FEEDBACK_LANE_STATUS: readonly FeedbackStatus[] = [
  FEEDBACK_STATUS.neu,
  FEEDBACK_STATUS.rueckfrage,
  FEEDBACK_STATUS.geplant,
  FEEDBACK_STATUS.in_bearbeitung,
  FEEDBACK_STATUS.umgesetzt,
  FEEDBACK_STATUS.abgelehnt,
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
