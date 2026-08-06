/**
 * Bucketing der Board-Spalten (v3.12) — welche Karte steht in welcher Spalte,
 * und was sagt die Summenzeile darunter.
 *
 * Rein: kein React, kein Storage. Löst `buildBoardColumns` aus der bisherigen
 * `FeedbackKanban.tsx` ab.
 *
 * Eine bewusste Änderung gegenüber v3.11: **Lob erscheint jetzt auch auf dem
 * Board.** Bis dahin wurde `category === 'praise'` herausgefiltert („Lob hat
 * keinen Workflow"). Mit der Facetten-Leiste wird das zur Falle: die Typ-Facette
 * verspräche „6 Lob", und ein Klick darauf zeigte ein leeres Board. Eine
 * Facettenzahl ist eine Zusage — also steht Lob in der Spalte seines Status.
 */
import type { FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import type { FeedbackLane } from '@/components/feedback/feedbackLanes';
import { spaltenSumme, type SpaltenSumme } from './boardZahlen';

export interface BoardSpalte {
  status: FeedbackStatus;
  spalten: 1 | 2;
  tickets: FeedbackItem[];
  summe: SpaltenSumme;
}

/**
 * Verteilt die (bereits gefilterten und sortierten) Tickets auf die
 * konfigurierten Lanes. Die Eingabereihenfolge bleibt je Spalte erhalten — die
 * Sortierung hat die Toolbar entschieden, hier wird nicht nachsortiert.
 *
 * Tickets in einem Status ohne sichtbare Lane fallen heraus; das ist die
 * gewollte Wirkung der Lane-Auswahl. Sichtbar bleibt der Bestand in der Liste.
 */
export function baueSpalten(
  tickets: readonly FeedbackItem[],
  lanes: readonly FeedbackLane[],
): BoardSpalte[] {
  const proStatus = new Map<FeedbackStatus, FeedbackItem[]>();
  for (const t of tickets) {
    const vorhanden = proStatus.get(t.kurator_status);
    if (vorhanden) vorhanden.push(t);
    else proStatus.set(t.kurator_status, [t]);
  }
  return lanes.map(lane => {
    const eigene = proStatus.get(lane.status) ?? [];
    return {
      status: lane.status,
      spalten: lane.spalten,
      tickets: eigene,
      summe: spaltenSumme(eigene),
    };
  });
}
