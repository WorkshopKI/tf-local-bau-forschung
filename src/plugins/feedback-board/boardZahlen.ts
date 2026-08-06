/**
 * Abgeleitete Zahlen der Board-Oberfläche (v3.12): die Trefferzahlen der
 * Facetten-Leiste und die Summenzeile unter jedem Spaltenkopf.
 *
 * Beides in EINEM Durchlauf je Aufgabe statt — wie bis v3.11 — mit einem
 * `filter()` je Zähler. Bei 500 Tickets und drei Facettengruppen waren das
 * knapp zwanzig Läufe über dieselbe Liste, bei jedem Tastendruck im Suchfeld.
 *
 * Rein: kein React, kein Storage, keine Uhr.
 */
import type { FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { EFFORT_HOURS } from '@/core/types/feedback';
import { FEEDBACK_STATUS } from '@/core/services/feedback';
import { ticketBereich } from '@/components/feedback/feedbackUi';

/** Schlüssel der Typ-Facette für Tickets ohne Kategorie (LLM lief nicht / Alt-Ticket). */
export const TYP_UNKLASSIFIZIERT = 'unklassifiziert';

export interface FacettenZaehler {
  /** `FeedbackCategory` oder `TYP_UNKLASSIFIZIERT`. */
  typ: Record<string, number>;
  status: Record<FeedbackStatus | string, number>;
  /** `TEAMFLOW_AREAS.ref` (siehe `ticketBereich`). */
  bereich: Record<string, number>;
}

/**
 * Zählt alle drei Facettengruppen in einem Durchlauf. Gezählt wird auf der
 * Menge, die die aktive Smart View übrig lässt — nicht auf dem Vollbestand:
 * eine Facettenzahl ist eine Zusage („so viele bekommst du, wenn du klickst"),
 * und die gilt nur innerhalb der aktuellen Sicht.
 */
export function zaehleFacetten(tickets: readonly FeedbackItem[]): FacettenZaehler {
  const typ: Record<string, number> = {};
  const status: Record<string, number> = {};
  const bereich: Record<string, number> = {};
  for (const t of tickets) {
    const k = t.category ?? TYP_UNKLASSIFIZIERT;
    typ[k] = (typ[k] ?? 0) + 1;
    status[t.kurator_status] = (status[t.kurator_status] ?? 0) + 1;
    const b = ticketBereich(t);
    bereich[b] = (bereich[b] ?? 0) + 1;
  }
  return { typ, status, bereich };
}

export interface SpaltenSumme {
  /** Summe der Stunden-Äquivalente aller geschätzten Tickets der Spalte. */
  stunden: number;
  /** Wie viele Tickets der Spalte noch keine Schätzung tragen. */
  ungeschaetzt: number;
}

/**
 * Summenzeile eines Board-Spaltenkopfs („384 h geschätzt · 44 ungeschätzt") —
 * der Triage-Blick, ohne eine einzige Karte aufzuklappen. Die Stunden kommen aus
 * `EFFORT_HOURS`, damit Schätzung und Anzeige nicht auseinanderlaufen können.
 */
export function spaltenSumme(tickets: readonly FeedbackItem[]): SpaltenSumme {
  let stunden = 0;
  let ungeschaetzt = 0;
  for (const t of tickets) {
    if (t.effort_estimate) stunden += EFFORT_HOURS[t.effort_estimate] ?? 0;
    else ungeschaetzt += 1;
  }
  return { stunden, ungeschaetzt };
}

/** Zahl für den Seitenkopf: `neu` allein wäre irreführend, sobald es
 *  `rueckfrage` gibt — beides ist „liegt beim Team bzw. beim Melder". */
export interface KopfZaehler {
  gesamt: number;
  neu: number;
  inArbeit: number;
}

export function kopfZaehler(tickets: readonly FeedbackItem[]): KopfZaehler {
  let neu = 0;
  let inArbeit = 0;
  for (const t of tickets) {
    if (t.kurator_status === FEEDBACK_STATUS.neu) neu += 1;
    else if (t.kurator_status === FEEDBACK_STATUS.in_bearbeitung) inArbeit += 1;
  }
  return { gesamt: tickets.length, neu, inArbeit };
}
