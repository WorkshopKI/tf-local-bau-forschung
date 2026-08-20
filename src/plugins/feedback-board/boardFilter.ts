/**
 * Reine Filter- + Sortier-Logik des Feedback-Boards — kein React, kein Storage:
 * Tickets + Filterzustand rein, gefilterte und sortierte Liste raus.
 *
 * Zwei Stufen, bewusst getrennt (v3.12):
 * 1. Die **Smart View** schneidet den Arbeitsvorrat zu („Meine Tickets",
 *    „Rückfragen offen"). Sie ist die Frage, mit der man auf die Seite kommt.
 * 2. Die **Facetten** (Typ · Status · Bereich) und die Suche grenzen INNERHALB
 *    dieser Sicht ein. Deshalb zählt `zaehleFacetten` auch auf der
 *    View-Menge, nicht auf dem Vollbestand — sonst verspräche eine Facettenzahl
 *    Treffer, die die Sicht gar nicht enthält.
 *
 * `getSponsoringProgress` wird als Wert-Funktion genutzt (deterministisch aus
 * Ticket + Config).
 */
import { getSponsoringProgress } from '@/core/services/feedback';
import { feedbackAuthorLabel, feedbackNummer, feedbackTitle, ticketBereich } from '@/components/feedback/feedbackUi';
import type { FeedbackSort } from '@/components/feedback/FeedbackSortSelect';
import { EFFORT_HOURS, type FeedbackCategory, type FeedbackConfig, type FeedbackItem, type FeedbackStatus } from '@/core/types/feedback';
import { TYP_UNKLASSIFIZIERT } from './boardZahlen';
import type { SmartView, SmartViewKontext } from './smartViews';

export interface BoardFilterState {
  view: SmartView;
  ctx: SmartViewKontext;
  /** Facette Typ: `FeedbackCategory`, `TYP_UNKLASSIFIZIERT` oder `''` = alle. */
  typ: FeedbackCategory | typeof TYP_UNKLASSIFIZIERT | '';
  /** Facette Status; `''` = alle. */
  status: FeedbackStatus | '';
  /** Facette Bereich (`TEAMFLOW_AREAS.ref`); `''` = alle. */
  bereich: string;
  /** Freitext-Suche (wird getrimmt + kleingeschrieben). */
  query: string;
  sort: FeedbackSort;
}

/** Der durchsuchbare Text eines Tickets. Regel: wonach man auf der Karte SIEHT,
 *  muss man auch suchen können — Titel, Text, Team-Antwort, Bereich, Autor und
 *  das Kurz-Handle (mit und ohne `#`, siehe `feedbackNummer`). */
export function suchHeuhaufen(t: FeedbackItem): string {
  return [
    // Voller Titel (Infinity) — sonst wäre bei langen Titeln das Ende nicht suchbar.
    feedbackTitle(t, Infinity),
    t.text,
    t.kurator_response ?? '',
    t.context?.page ?? '',
    feedbackAuthorLabel(t) ?? '',
    t.assignee ?? '',
    feedbackNummer(t),
  ].join(' ').toLowerCase();
}

/**
 * Trifft die Freitext-Suche? EINE Implementierung für den Filter und für die
 * Facettenzahlen (`zaehleFacetten`) — zwei Fassungen liefen genau dann
 * auseinander, wenn eine von beiden eine Schreibweise dazulernt.
 */
export function sucheTrifft(t: FeedbackItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  // Führendes `#` abstreifen: „#A7K2" und „a7k2" sollen dasselbe finden.
  const gesucht = q.startsWith('#') ? q.slice(1) : q;
  return suchHeuhaufen(t).includes(gesucht);
}

/** Passt ein Ticket auf Sicht, Facetten und Suche? */
export function matchesBoardFilter(t: FeedbackItem, f: BoardFilterState): boolean {
  if (!f.view.passt(t, f.ctx)) return false;
  if (f.typ) {
    const typ = t.category ?? TYP_UNKLASSIFIZIERT;
    if (typ !== f.typ) return false;
  }
  if (f.status && t.kurator_status !== f.status) return false;
  if (f.bereich && ticketBereich(t) !== f.bereich) return false;
  if (!sucheTrifft(t, f.query)) return false;
  return true;
}

/** Nähe zum Sponsoring-Ziel (0 = kein Ziel oder schon erreicht → sinkt nach unten). */
function nearGoal(t: FeedbackItem, config: FeedbackConfig): number {
  const p = getSponsoringProgress(t, config);
  if (p.threshold <= 0) return 0;
  const ratio = p.combinedPoints / p.threshold;
  return ratio >= 1 ? 0 : ratio;
}

/** Letzte Bewegung: die Nutzer-Bearbeitung, sonst das Anlegen. Ein Statuswechsel
 *  setzt `updated_at` NICHT (das Feld trägt die Merge-Precedence des Nutzertexts,
 *  siehe `mergeItems`) — „bewegt" heißt hier also „am Text bewegt". */
function bewegtAm(t: FeedbackItem): string {
  return t.updated_at ?? t.created_at;
}

/** Stunden-Äquivalent der Schätzung; ungeschätzte Tickets sortieren ans Ende. */
function aufwandStunden(t: FeedbackItem): number {
  return t.effort_estimate ? (EFFORT_HOURS[t.effort_estimate] ?? 0) : Number.POSITIVE_INFINITY;
}

/** Vergleichsfunktion je Ordnung; Gleichstand entscheidet immer „neueste zuerst". */
export function compareBoardTickets(
  a: FeedbackItem,
  b: FeedbackItem,
  sort: FeedbackSort,
  config: FeedbackConfig,
): number {
  const neueste = (): number => b.created_at.localeCompare(a.created_at);
  switch (sort) {
    case 'bewegt': {
      const d = bewegtAm(b).localeCompare(bewegtAm(a));
      return d !== 0 ? d : neueste();
    }
    case 'stimmen': {
      const d = (b.votes?.length ?? 0) - (a.votes?.length ?? 0);
      return d !== 0 ? d : neueste();
    }
    case 'aufwand': {
      const d = aufwandStunden(a) - aufwandStunden(b);
      // Nur `Infinity - Infinity` (= NaN, beide ungeschätzt) ist ein Gleichstand.
      // `32 - Infinity` ist -Infinity und damit eine gültige Aussage: geschätzt
      // vor ungeschätzt. Rückgabe als Vorzeichen, weil ±Infinity als
      // Vergleichswert unnötig fragil ist.
      if (Number.isNaN(d) || d === 0) return neueste();
      return d < 0 ? -1 : 1;
    }
    case 'pkt': {
      const d = getSponsoringProgress(b, config).combinedPoints - getSponsoringProgress(a, config).combinedPoints;
      return d !== 0 ? d : neueste();
    }
    case 'naht': {
      const d = nearGoal(b, config) - nearGoal(a, config);
      if (d !== 0) return d;
      return getSponsoringProgress(b, config).combinedPoints - getSponsoringProgress(a, config).combinedPoints;
    }
    case 'sup': {
      const d = getSponsoringProgress(b, config).sponsorCount - getSponsoringProgress(a, config).sponsorCount;
      return d !== 0 ? d : neueste();
    }
    case 'kmt': {
      const d = (b.comments?.length ?? 0) - (a.comments?.length ?? 0);
      return d !== 0 ? d : neueste();
    }
    default:
      return neueste();
  }
}

/**
 * Nur die Smart View anwenden — das ist die Menge, auf der die Facettenzahlen
 * gezählt werden und auf der der Ergebniszähler „24 von 312" das „312" nimmt.
 */
export function scopeBoard(
  tickets: readonly FeedbackItem[],
  view: SmartView,
  ctx: SmartViewKontext,
): FeedbackItem[] {
  return tickets.filter(t => view.passt(t, ctx));
}

/** Filtern + sortieren in einem Schritt (die Eingabeliste bleibt unberührt). */
export function filterAndSortBoard(
  tickets: readonly FeedbackItem[],
  f: BoardFilterState,
  config: FeedbackConfig,
): FeedbackItem[] {
  // Die Sicht darf eine Ordnung erzwingen ("Meiste Unterstützer" wäre ohne sie
  // sinnlos) — sonst gilt die Wahl aus der Toolbar.
  const sort = f.view.sort ?? f.sort;
  return tickets
    .filter(t => matchesBoardFilter(t, f))
    .sort((a, b) => compareBoardTickets(a, b, sort, config));
}
