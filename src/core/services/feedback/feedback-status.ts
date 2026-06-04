// Feedback-Status-Helper (CLAUDE.md Pitfall #21).
//
// Direkter Literal-Vergleich `item.kurator_status === 'geplant'` ist refactor-
// fragil (Tippfehler, IDE-Rename-Luecke, Status-Rename uebersieht Stellen) und
// wird vom Convention-Test `no-direct-feedback-status-compare` verboten. Statt-
// dessen die Konstante `FEEDBACK_STATUS` (Einzelwert-Vergleich) oder die seman-
// tischen Praedikate unten nutzen. Analog zu status-canonical.ts (Antrag-Status,
// Pitfall #12).

import type { FeedbackStatus } from '@/core/types/feedback';

/**
 * Kanonische Feedback-Status-Werte als benannte Konstanten (statt String-
 * Literale). Der `Record<FeedbackStatus, …>`-Typ erzwingt Vollstaendigkeit:
 * ein neuer Status (siehe docs/agents/add-feedback-status.md) muss hier ergaenzt
 * werden, sonst Compile-Fehler.
 */
export const FEEDBACK_STATUS: Record<FeedbackStatus, FeedbackStatus> = {
  neu: 'neu',
  geplant: 'geplant',
  in_bearbeitung: 'in_bearbeitung',
  umgesetzt: 'umgesetzt',
  abgelehnt: 'abgelehnt',
  archiviert: 'archiviert',
};

/** „Offen" im Board-Sinn: neu / geplant / in Bearbeitung (noch nicht umgesetzt). */
export function istOffen(status: FeedbackStatus): boolean {
  return (
    status === FEEDBACK_STATUS.neu ||
    status === FEEDBACK_STATUS.geplant ||
    status === FEEDBACK_STATUS.in_bearbeitung
  );
}

/** Umgesetzt (= „Done" im Board-Filter). */
export function istUmgesetzt(status: FeedbackStatus): boolean {
  return status === FEEDBACK_STATUS.umgesetzt;
}

/** Archiviert (wird aus Board-/Listen-Basis ausgeblendet). */
export function istArchiviert(status: FeedbackStatus): boolean {
  return status === FEEDBACK_STATUS.archiviert;
}
