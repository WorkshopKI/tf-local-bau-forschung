/**
 * Die Kennzahlen über dem Verlauf: **wie viel** steht hier, über wie viele
 * Träger, in welchem Zeitraum, und was fehlt.
 *
 * Sie steht über beiden Ansichten (Chronik und Zeitstrahl) und ersetzt die alte
 * Zeile „28 Termine aus den Datumsfeldern". Die war nicht falsch, aber
 * mehrdeutig: sie zählte **Ereignisse** und behauptete damit implizit, dass ein
 * Termin, den vier Teilvorhaben tragen, einer ist. Für die Frage „was ist
 * passiert" stimmt das; für „wie viel steht in den Spalten" nicht.
 *
 * Deshalb zwei Zahlen statt einer:
 *
 * - **Schritte** = wie viele verschiedene Kürzel überhaupt vorkommen. Das ist
 *   die Zeilenzahl der Matrix und die Einheit, in der das Team denkt.
 * - **Datumsangaben** = die befüllten Zellen darüber. Vier Teilvorhaben mit
 *   demselben Eingangsdatum sind ein Schritt und vier Datumsangaben.
 *
 * **Lücken zählen nicht mit.** „N Kürzel nicht gesetzt" steht daneben, nicht
 * darin: eine fehlende Seite ist kein Termin, und die Zahl, die den Umfang der
 * Chronik nennt, darf nicht durch Abwesendes wachsen (dieselbe Regel wie bisher
 * bei den fehlenden Gegenstücken).
 *
 * Rein: keine Uhr, kein IDB — die Standzeiten stecken bereits in den Paaren.
 */
import type { ChronikEintrag } from './chronik';
import type { OffenesPaarJeTv } from './waechter';

export interface VerlaufKennzahlen {
  /** Verschiedene Kürzel/Felder mit mindestens einem Termin. */
  schritte: number;
  /** Befüllte Zellen: je Eintrag so viele, wie er Träger hat. */
  datumsangaben: number;
  /** Teilvorhaben des Verbunds — für „(Verbund + 4 TV)". */
  tvAnzahl: number;
  /** Frühester ISO-Tag; `null` = keine Termine. */
  von: string | null;
  /** Spätester ISO-Tag; `null` = keine Termine. */
  bis: string | null;
  /** Halb offene Paare — **nicht** Teil von `datumsangaben`. */
  nichtGesetzt: number;
}

/**
 * Wie viele Zellen ein Eintrag füllt.
 *
 * Ein Eintrag ohne Träger ist **Verbund-Ebene** und füllt genau eine Zelle —
 * leere `tvIds` heißen „der Verbund", nicht „niemand" (`traegerLabel`).
 */
export function zellenJeEintrag(e: ChronikEintrag): number {
  return e.tvIds.length === 0 ? 1 : e.tvIds.length;
}

/** Die Kennzahlen einer bereits gebauten Chronik. Rein. */
export function verlaufKennzahlen(
  chronik: readonly ChronikEintrag[],
  offenePaare: readonly OffenesPaarJeTv[],
  tvAnzahl: number,
): VerlaufKennzahlen {
  const felder = new Set<string>();
  let datumsangaben = 0;
  let von: string | null = null;
  let bis: string | null = null;

  for (const e of chronik) {
    felder.add(e.feld.feldId);
    datumsangaben += zellenJeEintrag(e);
    // ISO-Tage sind lexikalisch = chronologisch; die Chronik kommt sortiert,
    // aber darauf baut hier nichts auf.
    if (von === null || e.tag < von) von = e.tag;
    if (bis === null || e.tag > bis) bis = e.tag;
  }

  return {
    schritte: felder.size,
    datumsangaben,
    tvAnzahl,
    von,
    bis,
    nichtGesetzt: offenePaare.length,
  };
}
