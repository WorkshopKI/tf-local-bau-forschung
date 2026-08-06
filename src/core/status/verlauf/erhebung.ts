/**
 * Was die Verlaufsableitung am **Bestand** ergibt — die Zahlen, die entscheiden,
 * ob das Band trägt.
 *
 * Reine Aggregation: der Lauf über die Vorgänge liegt im Cockpit-Hook, hier
 * steht nur, was gezählt wird. Ein **Akkumulator statt Rückgabewert**, weil über
 * 14 000 Vorgänge sonst 14 000 Zwischenobjekte entstünden — dieselbe Bauart wie
 * `ladeVorkommen`.
 *
 * **Jede Zahl trägt ihre Grundgesamtheit.** Die Spurzustände zählen Spuren (eine
 * je Teilvorhaben plus eine je Verbund), die Übergänge zählen Termine, die
 * Segmente zählen Abschnitte. Ohne diese Trennung liest sich „92,7 %" als
 * Aussage über Vorgänge, obwohl sie eine über Termine ist.
 */
import type { Konfidenz, SpurArt, SpurZustand, VerlaufsSpur } from './typen';

const ZUSTAENDE: readonly SpurZustand[] =
  ['verlauf', 'kein_bearbeitungsstand', 'kein_wert_im_csv', 'nicht_beobachtet'];
const KONFIDENZEN: readonly Konfidenz[] =
  ['trigger_bestaetigt', 'zeitliche_naehe', 'kein_kuerzel'];

export type ZustandsZaehler = Record<SpurZustand, number>;
export type KonfidenzZaehler = Record<Konfidenz, number>;

/** Die größte Spur — sie sagt, womit die Anzeige im schlimmsten Fall rechnet. */
export interface LaengsteSpur {
  id: string;
  art: SpurArt;
  uebergaenge: number;
  segmente: number;
}

export interface VerlaufsBefunde {
  /** Gerechnete Teilvorhaben bzw. Verbünde. */
  teilvorhaben: number;
  verbuende: number;
  zustaendeTv: ZustandsZaehler;
  zustaendeVb: ZustandsZaehler;
  /** Termine über alle Spuren. */
  uebergaenge: number;
  konfidenz: KonfidenzZaehler;
  /** Übergänge mit Regel, deren Zielstatus nicht auf einen Code auflöst. */
  ohneZielcode: number;
  /** Übergänge, deren Regel die Ebene offenlässt (`scope: null`). */
  scopeUnbestimmt: number;
  /** Übergänge, die ein umbenanntes Kürzel tragen. */
  historischeKuerzel: number;
  /** Übergänge aus einer Aggregationsregel, deren Bedingung heute nicht trägt. */
  aggregationNichtErfuellt: number;
  aggregationNichtPruefbar: number;
  segmente: number;
  segmenteUnsicher: number;
  segmenteMehrdeutig: number;
  /**
   * Abweichungen, nach Art getrennt. Zusammengezählt wären sie eine große Zahl,
   * die nichts sagt: `nichtAbleitbar` heißt „kein Regelwerk führt dorthin"
   * (etwa `Schlussvermerk`, 48 % des Bestands), `widerspruch` heißt „es gäbe
   * eine Regel, sie ist nur nicht belegt".
   */
  abweichungNichtAbleitbar: number;
  abweichungWiderspruch: number;
  /**
   * Verbünde, deren Verbundspur einen belegten **Statuswechsel** trägt.
   *
   * Nicht „mindestens einen Übergang": ein Verbund-Termin ohne Regel ist ein
   * Ereignis, aber kein Abschnittswechsel. Zwischen beiden liegt am Bestand der
   * Unterschied zwischen 91 % und 23 % — die zweite Zahl ist die, die zählt.
   */
  verbuendeMitStatuswechsel: number;
  /** Verbünde mit mindestens einem Termin auf der Verbundbahn — die Obermenge. */
  verbuendeMitTermin: number;
  laengsteSpur: LaengsteSpur | null;
  /** Verteilung der Projektform-Lage über die Verbünde. */
  projektform: Map<string, number>;
  /**
   * Nur **gezählt**, nicht abgeleitet: was die importierte C16-Trigger-Tabelle
   * zusätzlich erklären würde. Entscheidungsgrundlage für Phase 2/3 — ein
   * zweiter Ableitungspfad wäre eine zweite Wahrheit.
   */
  c16TvUebergaenge: number;
  c16VerbuendeMitVbUebergang: number;
}

function leererZaehler<T extends string>(schluessel: readonly T[]): Record<T, number> {
  return Object.fromEntries(schluessel.map(k => [k, 0])) as Record<T, number>;
}

export function leereBefunde(): VerlaufsBefunde {
  return {
    teilvorhaben: 0, verbuende: 0,
    zustaendeTv: leererZaehler(ZUSTAENDE), zustaendeVb: leererZaehler(ZUSTAENDE),
    uebergaenge: 0, konfidenz: leererZaehler(KONFIDENZEN),
    ohneZielcode: 0, scopeUnbestimmt: 0, historischeKuerzel: 0,
    aggregationNichtErfuellt: 0, aggregationNichtPruefbar: 0,
    segmente: 0, segmenteUnsicher: 0, segmenteMehrdeutig: 0,
    abweichungNichtAbleitbar: 0, abweichungWiderspruch: 0,
    verbuendeMitStatuswechsel: 0, verbuendeMitTermin: 0, laengsteSpur: null,
    projektform: new Map(),
    c16TvUebergaenge: 0, c16VerbuendeMitVbUebergang: 0,
  };
}

/** Wie die Projektform-Lage in der Bilanz heißt. */
function lageLabel(spur: VerlaufsSpur): string {
  const p = spur.projektform;
  if (p.art === 'bekannt') return p.form;
  return p.art === 'unbekannt' ? 'unbekannt' : `${p.art}: ${p.label}`;
}

/** Nimmt die Spuren EINES Vorhabens auf. Mutiert den Akkumulator. */
export function nimmAuf(b: VerlaufsBefunde, spuren: readonly VerlaufsSpur[]): void {
  for (const spur of spuren) {
    if (spur.art === 'tv') {
      b.teilvorhaben++;
      b.zustaendeTv[spur.zustand]++;
    } else {
      b.verbuende++;
      b.zustaendeVb[spur.zustand]++;
      if (spur.uebergaenge.length > 0) b.verbuendeMitTermin++;
      if (spur.zustand === 'verlauf') b.verbuendeMitStatuswechsel++;
      const label = lageLabel(spur);
      b.projektform.set(label, (b.projektform.get(label) ?? 0) + 1);
    }
    if (spur.abweichung?.art === 'nicht_ableitbar') b.abweichungNichtAbleitbar++;
    if (spur.abweichung?.art === 'widerspruch') b.abweichungWiderspruch++;

    for (const u of spur.uebergaenge) {
      b.uebergaenge++;
      b.konfidenz[u.konfidenz]++;
      if (u.setztStatus && u.setztStatus.code === null) b.ohneZielcode++;
      if (u.scopeUnbestimmt) b.scopeUnbestimmt++;
      if (u.kuerzelHistorisch) b.historischeKuerzel++;
      if (u.ausAggregation?.erfuellt === false) b.aggregationNichtErfuellt++;
      if (u.ausAggregation?.erfuellt === null) b.aggregationNichtPruefbar++;
    }

    for (const s of spur.segmente) {
      b.segmente++;
      if (s.dauerUnsicher) b.segmenteUnsicher++;
      if (s.mehrdeutig) b.segmenteMehrdeutig++;
    }

    if (b.laengsteSpur === null || spur.uebergaenge.length > b.laengsteSpur.uebergaenge) {
      b.laengsteSpur = {
        id: spur.id, art: spur.art,
        uebergaenge: spur.uebergaenge.length, segmente: spur.segmente.length,
      };
    }
  }
}

/**
 * Wie viele Termine eines Vorgangs die C16-Tabelle erklären würde.
 *
 * Der Schlüssel ist `(Programm, Kürzel)` — die C16-Tabelle ist je Richtlinie
 * geführt, die Zuarbeit je Projektform. Genau deshalb sind es zwei Quellen und
 * nicht eine mit zwei Lesarten.
 */
export function c16Treffer(
  codes: Iterable<string>, programm: string,
  tvIndex: ReadonlySet<string>, vbIndex: ReadonlySet<string>,
): { tv: number; vb: number } {
  let tv = 0;
  let vb = 0;
  for (const code of codes) {
    const k = `${programm}|${code.normalize('NFC').toUpperCase()}`;
    if (tvIndex.has(k)) tv++;
    if (vbIndex.has(k)) vb++;
  }
  return { tv, vb };
}

/** Anteil als Prozent-Text mit einer Nachkommastelle; `'—'` ohne Grundgesamtheit. */
export function anteil(teil: number, ganzes: number): string {
  return ganzes === 0 ? '—' : `${((100 * teil) / ganzes).toFixed(1)} %`;
}
