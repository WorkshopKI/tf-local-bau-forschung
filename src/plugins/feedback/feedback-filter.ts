// Geteiltes Filter-Prädikat + Facetten-Zähler für die Kurator-Ticket-Liste.
//
// Warum: Die Liste (FeedbackAdminPage `filteredTickets`) blendet Archivierte
// standardmäßig aus, die Chip-Zähler zählten aber über ALLE Tickets → "Bug 5"
// bei nur 1 sichtbaren Bug. Beide Seiten leiten jetzt aus DEMSELBEN Prädikat ab,
// damit die ausgewählte Chip-Zahl == Anzahl der angezeigten Listen-Elemente ist
// (Facetten-Zählung: eine Facette schränkt sich nicht selbst ein).

import type { FeedbackCategory, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { istArchiviert } from '@/core/services/feedback/feedback-status';

export interface FeedbackFilterState {
  category: FeedbackCategory | '';
  status: FeedbackStatus | '';
  area: string;
  showArchived: boolean;
}

/**
 * Ist `t` unter dem Filter-Zustand `f` sichtbar? Einzige Quelle der Wahrheit für
 * Liste UND Zähler.
 *
 * - Expliziter Status (inkl. „Archiviert") gewinnt exakt — die showArchived-
 *   Checkbox ist dann irrelevant.
 * - Ohne Status-Filter werden Archivierte nur bei showArchived eingeblendet.
 */
export function matchesFeedbackFilters(t: FeedbackItem, f: FeedbackFilterState): boolean {
  if (f.category && t.category !== f.category) return false;
  if (f.area && t.context?.page !== f.area) return false;
  if (f.status) return t.kurator_status === f.status;
  if (istArchiviert(t.kurator_status) && !f.showArchived) return false;
  return true;
}

// Facetten-Zähler: „wie viele Tickets zeigt die Liste, wenn ich DIESE Facette auf
// <value> setze und die anderen aktiven Filter beibehalte?" Das eigene Facetten-
// Feld wird überschrieben (eine Facette filtert sich nicht selbst).

export function countForCategory(tickets: FeedbackItem[], f: FeedbackFilterState, category: FeedbackCategory | ''): number {
  return tickets.filter(t => matchesFeedbackFilters(t, { ...f, category })).length;
}

export function countForStatus(tickets: FeedbackItem[], f: FeedbackFilterState, status: FeedbackStatus | ''): number {
  return tickets.filter(t => matchesFeedbackFilters(t, { ...f, status })).length;
}

export function countForArea(tickets: FeedbackItem[], f: FeedbackFilterState, area: string): number {
  return tickets.filter(t => matchesFeedbackFilters(t, { ...f, area })).length;
}
