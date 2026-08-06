/**
 * Reine Filter- + Sortier-Logik des Feedback-Boards — herausgezogen aus
 * FeedbackBoardPage (v2.364), damit sie node-testbar ist (Vorbild: die pure
 * `buildBoardColumns` des Kanbans und der Neuigkeiten-Selektor `feedbackNews.ts`).
 *
 * Kein React, kein Storage: Tickets + Filterzustand rein, gefilterte und
 * sortierte Liste raus. `getSponsoringProgress` wird als Wert-Funktion genutzt
 * (deterministisch aus Ticket + Config).
 */
import { getSponsoringProgress, istMeinTicket } from '@/core/services/feedback';
import type { MeineIdentitaet } from '@/core/services/feedback';
import { feedbackTitle } from '@/components/feedback/feedbackUi';
import type { FeedbackSort } from '@/components/feedback/FeedbackSortSelect';
import type { FeedbackStatusFilter } from '@/components/feedback/FeedbackStatusSelect';
import type { FeedbackCategory, FeedbackConfig, FeedbackItem } from '@/core/types/feedback';

/** Listen-Sicht: alle / eigene / fremde. */
export type BoardScope = 'alle' | 'mir' | 'team';

export interface BoardFilterState {
  scope: BoardScope;
  /**
   * Eigene Identität (Kürzel UND Profilname, siehe `feedbackIdentitaet`); ohne
   * sie greifen die Scopes nicht. Bewusst die ganze Identität statt einer Id:
   * Bestands-Tickets tragen die frühere Schreibweise.
   */
  ich: MeineIdentitaet;
  kategorie: FeedbackCategory | '';
  status: FeedbackStatusFilter;
  /** Freitext-Suche (wird getrimmt + kleingeschrieben). */
  query: string;
  sort: FeedbackSort;
}

/** Passt ein Ticket auf den Filterzustand? */
export function matchesBoardFilter(t: FeedbackItem, f: BoardFilterState): boolean {
  const { scope, ich } = f;
  const mein = istMeinTicket(t, ich);
  if (scope === 'mir' && !mein) return false;
  if (scope === 'team' && mein) return false;
  if (f.kategorie && t.category !== f.kategorie) return false;
  if (f.status !== 'alle') {
    if (f.status === 'lob') {
      if (t.category !== 'praise') return false;
    } else if (t.kurator_status !== f.status) return false;
  }
  const q = f.query.trim().toLowerCase();
  if (q) {
    // Voller Titel (Infinity) — sonst wäre bei langen Titeln das Ende nicht suchbar.
    // Die Team-Antwort zählt mit (v3.7): sie ist öffentlich und steht seit dem
    // Board-Marker sichtbar an der Karte — wonach man sieht, muss man suchen können.
    const hay = `${feedbackTitle(t, Infinity)} ${t.text} ${t.context?.page ?? ''} ${t.kurator_response ?? ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

/** Nähe zum Sponsoring-Ziel (0 = kein Ziel oder schon erreicht → sinkt nach unten). */
function nearGoal(t: FeedbackItem, config: FeedbackConfig): number {
  const p = getSponsoringProgress(t, config);
  if (p.threshold <= 0) return 0;
  const ratio = p.combinedPoints / p.threshold;
  return ratio >= 1 ? 0 : ratio;
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

/** Filtern + sortieren in einem Schritt (die Eingabeliste bleibt unberührt). */
export function filterAndSortBoard(
  tickets: readonly FeedbackItem[],
  f: BoardFilterState,
  config: FeedbackConfig,
): FeedbackItem[] {
  return tickets
    .filter(t => matchesBoardFilter(t, f))
    .sort((a, b) => compareBoardTickets(a, b, f.sort, config));
}
