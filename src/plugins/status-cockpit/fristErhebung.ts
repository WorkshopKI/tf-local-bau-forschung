/**
 * Die reine Aggregation des Haltedatum-Bestandslaufs.
 *
 * Getrennt vom Hook, damit sie ohne IDB testbar ist — dieselbe Trennung wie
 * `verlauf/erhebung.ts` neben `useVerlaufErhebung`.
 *
 * **Gruppiert wird nach MUSTER, nicht nach Vorgang.** Eine Liste über 6 600
 * Vorhaben ist keine Auskunft; „angehalten|unbekannt → angehalten|
 * verlauf_bestaetigt: 3 214" ist eine. Fünf Beispiele je Muster reichen, um
 * einen davon von Hand nachzusehen.
 */
import type { FristErgebnis, FristZustand } from '@/core/services/csv/frist-ergebnis';
import type { HaltedatumQuelle } from '@/core/status/haltedatum';

/** Ein Übergangsmuster mit Beispielen zum Nachsehen. */
export interface FristMuster {
  /** `angehalten|unbekannt → angehalten|verlauf_bestaetigt` */
  schluessel: string;
  anzahl: number;
  /** Bis zu fünf Verbund-Ids, damit ein Fall von Hand prüfbar ist. */
  beispiele: string[];
  /** Das belegende Kürzel des ersten Beispiels; `null` = kein Verlaufs-Halt. */
  kuerzelBeispiel: string | null;
}

export interface FristBefunde {
  vorgaenge: number;
  /**
   * Zustand vorher → nachher. **Muss diagonal sein** — die neue Quelle wirkt
   * erst, nachdem der Zustand feststeht.
   */
  zustandsMatrix: Map<string, number>;
  /** Wie viele Vorgänge welche Haltedatum-Quelle bekommen (nachher). */
  jeQuelle: Map<HaltedatumQuelle, number>;
  /** Von „unbekannt" auf ein bestimmtes Datum gewechselt. */
  neuDatiert: number;
  /**
   * Vorgänge, die **angehalten** sind und trotzdem kein Haltedatum haben — die
   * einzigen, für die eine weitere Quelle überhaupt etwas ändern könnte.
   *
   * Nicht dasselbe wie `jeQuelle('unbekannt')`: dort stecken auch laufende und
   * nicht berechenbare Vorgänge, die gar kein Haltedatum brauchen. Am Bestand
   * ist der Unterschied 1 030 gegen 42 — die größere Zahl klingt nach einer
   * Lücke, die es nicht gibt.
   */
  angehaltenOhneDatum: number;
  /** Hatten schon eins und bekommen jetzt ein ANDERES — darf nicht vorkommen. */
  umdatiert: number;
  /** Bezugszeitpunkt verschoben (die Achse der Bahn endet woanders). */
  achseVerschoben: number;
  muster: FristMuster[];
}

const BEISPIELE_MAX = 5;

export function leereFristBefunde(): FristBefunde {
  return {
    vorgaenge: 0,
    zustandsMatrix: new Map(),
    jeQuelle: new Map(),
    neuDatiert: 0,
    angehaltenOhneDatum: 0,
    umdatiert: 0,
    achseVerschoben: 0,
    muster: [],
  };
}

function zaehle<K>(m: Map<K, number>, k: K): void {
  m.set(k, (m.get(k) ?? 0) + 1);
}

/** Der Musterschlüssel eines Vorgangs — Zustand und Quelle, vorher wie nachher. */
export function musterSchluessel(vorher: FristErgebnis, nachher: FristErgebnis): string {
  const a = `${vorher.zustand}|${vorher.haltedatumQuelle}`;
  const b = `${nachher.zustand}|${nachher.haltedatumQuelle}`;
  return a === b ? `${a} (unverändert)` : `${a} → ${b}`;
}

/** Nimmt einen Vorgang in die Bilanz. Rein: kein Zustand außerhalb `bilanz`. */
export function nimmFristAuf(
  bilanz: FristBefunde,
  vorher: FristErgebnis, nachher: FristErgebnis,
  id: string, kuerzel: string | null,
): void {
  bilanz.vorgaenge++;
  zaehle(bilanz.zustandsMatrix, `${vorher.zustand}→${nachher.zustand}` as FristZustand & string);
  zaehle(bilanz.jeQuelle, nachher.haltedatumQuelle);

  const vorherDatiert = vorher.haltedatumQuelle !== 'unbekannt';
  const nachherDatiert = nachher.haltedatumQuelle !== 'unbekannt';
  if (!vorherDatiert && nachherDatiert) bilanz.neuDatiert++;
  if (nachher.zustand === 'angehalten' && !nachherDatiert) bilanz.angehaltenOhneDatum++;
  if (vorherDatiert && nachherDatiert && vorher.bezugsZeitpunkt !== nachher.bezugsZeitpunkt) {
    bilanz.umdatiert++;
  }
  if (vorher.bezugsZeitpunkt !== nachher.bezugsZeitpunkt) bilanz.achseVerschoben++;

  const schluessel = musterSchluessel(vorher, nachher);
  const da = bilanz.muster.find(m => m.schluessel === schluessel);
  if (da) {
    da.anzahl++;
    if (da.beispiele.length < BEISPIELE_MAX) da.beispiele.push(id);
    return;
  }
  bilanz.muster.push({ schluessel, anzahl: 1, beispiele: [id], kuerzelBeispiel: kuerzel });
}

/** Ist die Zustandsmatrix diagonal? Die Zusage, die Teil B trägt. */
export function matrixDiagonal(bilanz: FristBefunde): boolean {
  for (const [k, n] of bilanz.zustandsMatrix) {
    const [vorher, nachher] = k.split('→');
    if (vorher !== nachher && n > 0) return false;
  }
  return true;
}

/** Muster nach Gewicht, absteigend — der Bericht arbeitet von oben ab. */
export function musterSortiert(bilanz: FristBefunde): FristMuster[] {
  return [...bilanz.muster].sort((a, b) => b.anzahl - a.anzahl
    || a.schluessel.localeCompare(b.schluessel, 'de'));
}
