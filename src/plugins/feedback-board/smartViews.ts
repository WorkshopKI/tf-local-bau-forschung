/**
 * Smart Views des Feedback-Boards (v3.12, Handoff feedback-redesign).
 *
 * Der übliche Einstieg soll nie „alle 500" sein: statt eines Scope-Umschalters
 * (Alle/Von mir/Vom Team) trägt der Kopf eine rollenabhängige Pillen-Leiste mit
 * Trefferzahlen. Die Sichten sind reine Prädikate — kein React, kein Storage,
 * kein Datum aus `Date.now()`: „heute" und „ist ungelesen" kommen als Kontext
 * herein, damit beides testbar bleibt und der ungelesen-Marker (gerätelokal,
 * drei getrennte localStorage-Speicher) hier nicht nachgebaut wird.
 *
 * Eigentümerschaft IMMER über `istMeinTicket` (tolerante Leseform, v3.7) —
 * Bestandstickets tragen die jeweils andere Schreibweise. Zuweisung dagegen
 * gegen die EINE kanonische `schreibId`, denn `assignee` wird von uns geschrieben.
 */
import type { FeedbackItem } from '@/core/types/feedback';
import {
  FEEDBACK_STATUS,
  istMeineId,
  istMeinTicket,
  istOffen,
  istRueckfrage,
  istUmgesetzt,
  type MeineIdentitaet,
} from '@/core/services/feedback';
import type { FeedbackSort } from '@/components/feedback/FeedbackSortSelect';

/** Welche Sichten und Karteninhalte gelten — abgeleitet aus `canManageFeedback`,
 *  für Verwalter per Vorschau-Umschalter auf `'nutzer'` stellbar. */
export type BoardRolle = 'nutzer' | 'entwickler';

export interface SmartViewKontext {
  /** Kürzel UND Profilname (siehe `feedbackIdentitaet`). */
  ich: MeineIdentitaet;
  /** Heutiges Datum als ISO-String — explizit, damit „Neu diese Woche" testbar ist. */
  heute: string;
  /** Ungelesene Team-Antwort oder neue Kommentare? Kommt aus den gerätelokalen
   *  Hooks der Seite; hier nur ein Prädikat, damit dieses Modul rein bleibt. */
  istUngelesen: (t: FeedbackItem) => boolean;
}

export interface SmartView {
  key: string;
  label: string;
  passt: (t: FeedbackItem, ctx: SmartViewKontext) => boolean;
  /** Zählt in den roten Punkt an der Pille (nur wo er etwas bedeutet). */
  alert?: (t: FeedbackItem, ctx: SmartViewKontext) => boolean;
  /** Erzwingt eine Ordnung — die Sicht bringt ihre eigene Frage mit. */
  sort?: FeedbackSort;
}

/** Alter in Tagen, positiv = Vergangenheit. Rein über die ISO-Präfixe zu rechnen
 *  wäre falsch (Monatsgrenzen), deshalb echte Daten — aber beide von außen. */
function tageSeit(iso: string, heute: string): number {
  const a = new Date(iso).getTime();
  const b = new Date(heute).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return (b - a) / 86_400_000;
}

/** Anzahl budgetfreier Stimmen — das `↑ n` auf der Karte. */
export function stimmenZahl(t: FeedbackItem): number {
  return t.votes?.length ?? 0;
}

/** Mindestens ein Element — damit `views[0]` als Fallback ohne Undefined-Zweig
 *  auskommt (die Leerliste gäbe es sowieso nie, der Typ sagt es jetzt auch). */
type Sichten = readonly [SmartView, ...SmartView[]];

export const SMART_VIEWS_NUTZER: Sichten = [
  { key: 'alle', label: 'Alles', passt: () => true },
  {
    key: 'meine',
    label: 'Meine Tickets',
    passt: (t, ctx) => istMeinTicket(t, ctx.ich),
    alert: (t, ctx) => ctx.istUngelesen(t),
  },
  {
    key: 'wartet',
    label: 'Wartet auf mich',
    passt: (t, ctx) => istMeinTicket(t, ctx.ich) && istRueckfrage(t.kurator_status),
  },
  {
    key: 'neu7',
    label: 'Neu diese Woche',
    passt: (t, ctx) => tageSeit(t.created_at, ctx.heute) <= 7,
  },
  {
    key: 'fertig',
    label: 'Zuletzt umgesetzt',
    passt: t => istUmgesetzt(t.kurator_status),
    sort: 'bewegt',
  },
];

export const SMART_VIEWS_ENTWICKLER: Sichten = [
  { key: 'offen', label: 'Alles offen', passt: t => istOffen(t.kurator_status) },
  {
    key: 'mir',
    label: 'Mir zugewiesen',
    passt: (t, ctx) => !!t.assignee && istMeineId(t.assignee, ctx.ich),
  },
  {
    key: 'triage',
    label: 'Triage · ungeschätzt',
    passt: t => !t.effort_estimate && t.kurator_status === FEEDBACK_STATUS.neu,
  },
  {
    key: 'rueck',
    label: 'Rückfragen offen',
    passt: t => istRueckfrage(t.kurator_status),
  },
  {
    // Bewusst „hat überhaupt Zuspruch" statt einer Zahlenschwelle: bei fünf bis
    // fünfzehn Nutzern wäre jede Schwelle > 1 dauerhaft leer.
    key: 'top',
    label: 'Meiste Unterstützer',
    passt: t => stimmenZahl(t) > 0,
    sort: 'stimmen',
  },
  { key: 'alle', label: 'Alles', passt: () => true },
];

export function viewsFuerRolle(rolle: BoardRolle): Sichten {
  return rolle === 'entwickler' ? SMART_VIEWS_ENTWICKLER : SMART_VIEWS_NUTZER;
}

/** Startsicht je Rolle: der Nutzer will sein eigenes Ticket, der Entwickler den Vorrat. */
export function startViewKey(rolle: BoardRolle): string {
  return rolle === 'entwickler' ? 'offen' : 'meine';
}

/** Sicht per Schlüssel; unbekannt (Rollenwechsel, alter localStorage-Wert) → die erste. */
export function findeView(rolle: BoardRolle, key: string): SmartView {
  const views = viewsFuerRolle(rolle);
  return views.find(v => v.key === key) ?? views[0];
}
