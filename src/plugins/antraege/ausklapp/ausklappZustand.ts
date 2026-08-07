/**
 * Der Zustand des aufgeklappten Bereichs — als reine Funktion, damit die eine
 * Stelle mit echter Logik prüfbar bleibt.
 *
 * **Drei Regeln, die zusammen ein Akkordeon ergeben:**
 *
 * 1. Dieselbe Zelle noch einmal → zu. Ein Schalter, der nur aufgeht, ist keiner.
 * 2. Die andere Zelle derselben Zeile → **Reiter umschalten**, nicht stapeln.
 *    Wer bei offenem Verlauf auf die Frist klickt, will die Frist sehen — nicht
 *    einen zweiten Bereich darunter.
 * 3. Eine andere Zeile → dort auf, hier zu. Höchstens eine Zeile ist offen;
 *    sonst schöbe eine Liste mit zwanzig geöffneten Bereichen die Tabelle
 *    auseinander, ohne dass jemand sie wieder zusammenbekäme.
 *
 * Kein `localStorage`, keine Persistenz über die Navigation hinaus (Phase-2-
 * Vorgabe): ein Bereich ist eine Nachfrage, kein Zustand des Vorgangs.
 */

/** Welcher Reiter des Bereichs vorgewählt ist. */
export type ReiterId = 'verlauf' | 'fristen';

export interface AusklappZustand {
  /** Zeilenschlüssel — das Aktenzeichen der Zeile (bei Verbund-Körnung das des
   *  Lead-Teilvorhabens). Genau deshalb schließt der Bereich beim Achsenwechsel. */
  key: string;
  reiter: ReiterId;
}

/**
 * Was ein Klick auf die Zelle `key` mit Reiter `reiter` aus dem aktuellen
 * Zustand macht. `null` = nichts offen.
 */
export function naechsterZustand(
  aktuell: AusklappZustand | null, key: string, reiter: ReiterId,
): AusklappZustand | null {
  if (aktuell === null || aktuell.key !== key) return { key, reiter };
  if (aktuell.reiter === reiter) return null;
  return { key, reiter };
}

/** Ist der Bereich dieser Zeile offen? */
export function istOffen(aktuell: AusklappZustand | null, key: string): boolean {
  return aktuell !== null && aktuell.key === key;
}

/** Die `id` des Bereichs — Ziel von `aria-controls` an der Zelle. */
export function bereichsId(key: string): string {
  return `zeilen-bereich-${key.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}
