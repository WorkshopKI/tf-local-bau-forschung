/**
 * Gerätelokaler „gelesen bis"-Stand der Kommentare — die reine Rechnung, ohne
 * React und ohne localStorage (der Hook useUnreadComments hängt beides an).
 *
 * Warum ein ZÄHLER je Ticket und kein Hash und keine Id-Menge: Kommentare sind
 * append-only und werden union-by-`id` gemerged, die Anzahl ist also monoton —
 * eine Differenz genügt. Eine Id-Menge wüchse unbegrenzt im localStorage; eine
 * Signatur sagte nur „geändert", nicht „wie viele neu" (und ein zweites djb2
 * verbietet der Guard `djb2-single-source` ohnehin).
 *
 * Gezählt werden nur FREMDE Kommentare: `markSeen` läuft beim ÖFFNEN eines
 * Tickets, der eigene Kommentar entsteht danach — sonst markierte sich das
 * eigene Ticket unmittelbar nach dem eigenen Beitrag als „neu".
 *
 * Der Kern (übernommen von `ergaenzeUnbekannte` im Neuigkeiten-Widget): ein
 * FEHLENDER Eintrag heißt „noch nie beobachtet", nicht „alles neu". Sonst
 * leuchtete beim ersten Start schlagartig jedes Bestands-Ticket auf.
 */
import type { FeedbackItem } from '@/core/types/feedback';

/** ticketId → Anzahl fremder Kommentare beim letzten Ansehen. */
export type KommentarStand = Record<string, number>;

/** Kommentare anderer Leute an diesem Ticket. */
export function zaehleFremdKommentare(t: FeedbackItem, meId: string | undefined): number {
  const comments = t.comments ?? [];
  if (!meId) return comments.length;
  return comments.filter(c => c.user_id !== meId).length;
}

/**
 * Zuwachs seit dem gemerkten Stand. Unbekanntes Ticket → 0 („noch nie
 * beobachtet"); ein Stand über dem aktuellen Wert (theoretisch bei gelöschten
 * Kommentaren) → ebenfalls 0, nie ein Negativwert.
 */
export function zaehleNeueKommentare(
  t: FeedbackItem,
  stand: KommentarStand,
  meId: string | undefined,
): number {
  if (!meId) return 0;
  const gemerkt = stand[t.id];
  if (gemerkt === undefined) return 0;
  return Math.max(0, zaehleFremdKommentare(t, meId) - gemerkt);
}

/**
 * Trägt für noch nie beobachtete Tickets den AKTUELLEN Wert als Vorwert nach —
 * auch für Tickets ohne Kommentare (Eintrag `0`), sonst wäre der erste
 * Kommentar eines bisher stillen Tickets nicht als neu erkennbar.
 *
 * `null` = nichts zu tun. Der Aufrufer gibt dann denselben Stand zurück (gleiche
 * Referenz → React bricht ab, kein Render-Karussell) und schreibt nichts.
 */
export function ergaenzeKommentarStand(
  stand: KommentarStand,
  items: readonly FeedbackItem[],
  meId: string | undefined,
): KommentarStand | null {
  if (!meId) return null;
  const zusatz: KommentarStand = {};
  for (const t of items) {
    if (stand[t.id] !== undefined) continue;
    zusatz[t.id] = zaehleFremdKommentare(t, meId);
  }
  if (Object.keys(zusatz).length === 0) return null;
  return { ...stand, ...zusatz };
}

/** Kern von `markSeen`. `null` = der Stand ist schon aktuell (kein Write). */
export function standNach(
  stand: KommentarStand,
  t: FeedbackItem,
  meId: string | undefined,
): KommentarStand | null {
  if (!meId) return null;
  const jetzt = zaehleFremdKommentare(t, meId);
  if (stand[t.id] === jetzt) return null;
  return { ...stand, [t.id]: jetzt };
}
