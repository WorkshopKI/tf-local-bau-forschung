/**
 * Wem gehört ein Feedback-Ticket? (v3.7)
 *
 * Der Schreibpfad und der Lesepfad kannten bis hierher zwei verschiedene
 * Identitäten: erfasst wurde ein Ticket unter `profile.name` („TH PL"),
 * verglichen wurde gegen `useMeinKuerzel() ?? profile.name` — also gegen das
 * Bearbeiter-Kürzel („THÜ"), sobald eines im Profil steht (Normalfall in pl).
 * Damit war JEDES eigene Ticket fremd: „Von mir" leer, kein „Du", keine Glocke,
 * kein „Antwort"-Marker und kein „Ergänzen".
 *
 * Auflösung, bewusst asymmetrisch:
 *  - **Schreiben** trägt GENAU EINE kanonische Id (`schreibId`) — sonst
 *    verdoppeln sich Stimmen, Kommentare und Sponsoren-Einträge, die alle
 *    per `user_id` unioniert werden (`unionMergeVotes` & Co.).
 *  - **Lesen** ist tolerant (`leseIds`) — Bestandsdaten tragen die alte
 *    Schreibweise und sollen weiter mir gehören. Eine Migration der geteilten
 *    `feedback.json` wäre der falsche Hebel: sie kennt nicht, wer hinter einem
 *    fremden Namen steckt.
 *
 * Rein und node-testbar (kein React, kein Storage) — der Hook dazu ist
 * `useMeineFeedbackIdentitaet`.
 */

import type { FeedbackItem } from '@/core/types/feedback';

export interface MeineIdentitaet {
  /** Kanonische Id für NEUE Einträge (Ticket, Stimme, Kommentar, Sponsoring). */
  schreibId: string | undefined;
  /** Alle Schreibweisen, unter denen ältere Einträge von mir stehen können. */
  leseIds: readonly string[];
}

/** Niemand — für Aufrufer ohne bekannte Identität (anonym, Profil noch nicht geladen). */
export const KEINE_IDENTITAET: MeineIdentitaet = { schreibId: undefined, leseIds: [] };

/**
 * Vergleichsform einer Identität: NFC-normalisiert (Pitfall #22 — „THÜ" kommt
 * je nach Quelle als NFC oder NFD), getrimmt, kleingeschrieben. Nur für den
 * VERGLEICH — gespeichert wird immer die Originalschreibweise.
 */
function vergleichsform(wert: string): string {
  return wert.normalize('NFC').trim().toLowerCase();
}

/**
 * Baut eine Identität aus beliebig vielen Kandidaten (erste nicht-leere gewinnt
 * als `schreibId`). `'anonymous'` zählt nicht als Identität — sonst gehörte
 * jedem anonymen Nutzer jedes anonyme Ticket.
 */
export function baueIdentitaet(...kandidaten: (string | undefined | null)[]): MeineIdentitaet {
  const gesehen = new Set<string>();
  const leseIds: string[] = [];
  for (const k of kandidaten) {
    const wert = k?.trim();
    if (!wert || wert === 'anonymous') continue;
    const form = vergleichsform(wert);
    if (gesehen.has(form)) continue;
    gesehen.add(form);
    leseIds.push(wert);
  }
  return { schreibId: leseIds[0], leseIds };
}

/** Gehört ein Eintrag mit dieser `user_id` mir? Ohne Identität immer `false`. */
export function istMeineId(userId: string | undefined, ich: MeineIdentitaet): boolean {
  const wert = userId?.trim();
  if (!wert) return false;
  const form = vergleichsform(wert);
  return ich.leseIds.some(id => vergleichsform(id) === form);
}

/** Gehört das Ticket mir? (Die Form, die die UI-Stellen brauchen.) */
export function istMeinTicket(
  ticket: Pick<FeedbackItem, 'user_id'> | undefined,
  ich: MeineIdentitaet,
): boolean {
  return istMeineId(ticket?.user_id, ich);
}
