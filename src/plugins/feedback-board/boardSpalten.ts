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
  /**
   * Kann die aktive Sicht diesen Status überhaupt enthalten? `true` heißt: die
   * Bahn ist nicht leer, sondern unerreichbar — ihre „0" wäre eine Falschaussage.
   */
  ausserhalbDerSicht: boolean;
}

/**
 * Verteilt die (bereits gefilterten und sortierten) Tickets auf die
 * konfigurierten Lanes. Die Eingabereihenfolge bleibt je Spalte erhalten — die
 * Sortierung hat die Toolbar entschieden, hier wird nicht nachsortiert.
 *
 * Tickets in einem Status ohne sichtbare Lane fallen heraus; das ist die
 * gewollte Wirkung der Lane-Auswahl. Sichtbar bleibt der Bestand in der Liste.
 *
 * `kannStatus` kommt aus der aktiven Smart View (`sichtKannStatus`): die Lanes
 * bilden die ganze Pipeline ab, die Sicht schneidet sie aber zu. Ohne diese
 * Auskunft sähe eine Bahn, die die Sicht nie füllen kann, exakt so aus wie eine
 * ehrlich leere — der Grund, warum ein auf „umgesetzt" gesetztes Ticket spurlos
 * verschwand (v3.39).
 */
/**
 * Was der Nutzer zuletzt über DIESE Spalte gesagt hat. `auto` heißt „nichts
 * gesagt" — dann entscheidet der Inhalt (voll = Spalte, leer = Schiene).
 *
 * Ein Wunsch statt zweier Booleans: „aufgeklappt" und „eingeklappt" sind keine
 * unabhängigen Schalter, sondern die beiden Richtungen derselben Aussage. Als
 * `entfaltet: boolean` (v3.41.1) ließ sich die zweite gar nicht ausdrücken.
 */
export type SpaltenWunsch = 'auto' | 'offen' | 'zu';

/**
 * Wie eine Spalte dasteht. `leer-offen` und `voll-schiene` entstehen NUR durch
 * eine Geste — und sind damit die Zustände, die einen Weg zurück tragen müssen:
 * bis v3.41 klappte eine leere Bahn auf und blieb es bis zum Neuladen.
 */
export type SpaltenAnsicht = 'voll' | 'schiene' | 'leer-offen' | 'voll-schiene';

export function spaltenAnsicht(spalte: BoardSpalte, wunsch: SpaltenWunsch): SpaltenAnsicht {
  // Eine gefüllte Spalte folgt dem Wunsch — eingeklappt behält sie ihre Zahl
  // und bleibt Drop-Ziel, verliert also nichts außer Breite (v3.43).
  if (spalte.tickets.length > 0) return wunsch === 'zu' ? 'voll-schiene' : 'voll';
  // Eine unerreichbare Bahn bleibt Schiene, auch nach einem Klick: aufgeklappt
  // behauptete sie ein zweites Mal „hier ist nichts" (v3.39).
  if (spalte.ausserhalbDerSicht) return 'schiene';
  return wunsch === 'offen' ? 'leer-offen' : 'schiene';
}

/** Ist diese Ansicht die Schmalschiene? Die beiden Wege dorthin (leer von
 *  selbst, voll von Hand) teilen sich Geometrie, Beschriftung und Drop-Ziel. */
export function istSchiene(ansicht: SpaltenAnsicht): boolean {
  return ansicht === 'schiene' || ansicht === 'voll-schiene';
}

export function baueSpalten(
  tickets: readonly FeedbackItem[],
  lanes: readonly FeedbackLane[],
  kannStatus?: (status: FeedbackStatus) => boolean,
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
      ausserhalbDerSicht: kannStatus ? !kannStatus(lane.status) : false,
    };
  });
}
