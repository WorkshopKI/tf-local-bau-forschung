import { Navigate } from 'react-router-dom';

/**
 * @deprecated Die Feedback-Kuration ist seit v2.364 kein eigener Menüpunkt mehr.
 * Ticket-Arbeit (Status, Antwort, Löschen) passiert direkt am Ticket im
 * Feedback-Board ([FeedbackVerwaltungBlock](../../components/feedback/FeedbackVerwaltungBlock.tsx)),
 * die ticket-freien Aufgaben im Verwaltungs-Dialog des Boards
 * ([FeedbackVerwaltungDialog](../feedback-board/verwaltung/FeedbackVerwaltungDialog.tsx)).
 *
 * Die Route `/kuration/feedback` bleibt für alte Feld-Bookmarks bestehen und
 * leitet aufs Board um. NICHT löschen.
 */
export function FeedbackKurationRedirect(): React.ReactElement {
  return <Navigate to="/feedback-board" replace />;
}
