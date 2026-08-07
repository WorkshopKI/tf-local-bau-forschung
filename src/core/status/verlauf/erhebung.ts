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

/**
 * **Warum** ein Abschnitt „Dauer unsicher" trägt — vier Fälle, die in einer Zahl
 * stecken und Verschiedenes bedeuten.
 *
 * `dauerUnsicher` ist `dauerTage === null || dauerTage <= 1` (`segmente.ts`).
 * Zusammengezählt ergibt das am Bestand zwei Drittel aller Abschnitte, und
 * daraus liest sich „die Verweildauern sind wertlos". Das stimmt nur für den
 * letzten Fall: eine **offene Grenze** heißt „wir wissen nicht, wann es anfing",
 * nicht „es dauerte einen Tag". Für die Frage, ob eine dauerskalierte Bahn
 * trägt, ist das der Unterschied zwischen Rauschen und fehlender Achse.
 *
 * Die vier Fälle sind **disjunkt** (in dieser Priorität geprüft); ihre Summe ist
 * exakt `segmenteUnsicher` — ein Test hält das fest.
 */
export interface UnsicherAufschluesselung {
  /** `vonDatum === null` — kein belegter Wechsel, oder der nachgeschobene
   *  Abschnitt des importierten Status im Abweichungsfall. */
  ohneAnfang: number;
  /** `bisDatum === null` — nur der Abweichungsfall: die abgeleitete Strecke
   *  bekommt ein offenes Ende, weil der Export etwas anderes sagt. */
  ohneEnde: number;
  /** Beide Grenzen gesetzt, `tageZwischen` liefert trotzdem nichts — ein
   *  unlesbares Datum. Bisher von den anderen Fällen nicht unterscheidbar. */
  unlesbar: number;
  /** Beide Grenzen gesetzt, Differenz 0 oder 1 Tag. Der EINZIGE Fall, in dem
   *  „unsicher" wirklich eine gemessene Verweildauer meint. */
  kurz: number;
}

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
  /** Woran die unsichere Dauer liegt — siehe {@link UnsicherAufschluesselung}. */
  unsicher: UnsicherAufschluesselung;
  /**
   * Abschnitte mit **negativer** Dauer: ein Termin liegt nach dem
   * Bezugszeitpunkt. `tageZwischen` hat keine Untergrenze, solche Abschnitte
   * fallen deshalb stillschweigend in denselben Topf wie „stand einen Tag".
   * Nicht disjunkt zu {@link UnsicherAufschluesselung.kurz} — ein eigener
   * Befund, kein Teil der Aufteilung.
   */
  segmenteRueckwaerts: number;
  /**
   * Verteilung der **messbaren** Dauern: Tage → Anzahl Abschnitte, über alle
   * Segmente mit gesetzten Grenzen und `dauerTage >= 0`.
   *
   * Ein Histogramm statt eines Arrays über 45 000 Zahlen — der Modulkopf
   * verbietet das Sammeln aus gutem Grund, und für Median, Quartile und
   * „über 30 Tage" reicht die Verteilung exakt aus.
   */
  dauerHistogramm: Map<number, number>;
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

/**
 * Obergrenze des Histogramms in Tagen (~27 Jahre). Alles darüber landet in
 * diesem Eimer — ein Datum jenseits davon ist ein Tippfehler im Export, kein
 * Verlauf, und soll die Verteilung nicht in die Länge ziehen.
 */
export const DAUER_HIST_MAX = 10_000;

export function leereBefunde(): VerlaufsBefunde {
  return {
    teilvorhaben: 0, verbuende: 0,
    zustaendeTv: leererZaehler(ZUSTAENDE), zustaendeVb: leererZaehler(ZUSTAENDE),
    uebergaenge: 0, konfidenz: leererZaehler(KONFIDENZEN),
    ohneZielcode: 0, scopeUnbestimmt: 0, historischeKuerzel: 0,
    aggregationNichtErfuellt: 0, aggregationNichtPruefbar: 0,
    segmente: 0, segmenteUnsicher: 0, segmenteMehrdeutig: 0,
    unsicher: { ohneAnfang: 0, ohneEnde: 0, unlesbar: 0, kurz: 0 },
    segmenteRueckwaerts: 0, dauerHistogramm: new Map(),
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
      if (s.mehrdeutig) b.segmenteMehrdeutig++;
      if (s.dauerTage !== null && s.dauerTage < 0) b.segmenteRueckwaerts++;
      if (s.dauerUnsicher) {
        b.segmenteUnsicher++;
        // Reihenfolge ist die Aussage: eine offene Grenze schlägt jede
        // Tages-Differenz, weil sie eine andere Frage beantwortet.
        if (s.vonDatum === null) b.unsicher.ohneAnfang++;
        else if (s.bisDatum === null) b.unsicher.ohneEnde++;
        else if (s.dauerTage === null) b.unsicher.unlesbar++;
        else b.unsicher.kurz++;
      }
      if (s.dauerTage !== null && s.dauerTage >= 0) {
        const k = Math.min(s.dauerTage, DAUER_HIST_MAX);
        b.dauerHistogramm.set(k, (b.dauerHistogramm.get(k) ?? 0) + 1);
      }
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

/** Wie viele Abschnitte das Histogramm insgesamt zählt. */
export function histogrammSumme(hist: ReadonlyMap<number, number>): number {
  let n = 0;
  for (const anzahl of hist.values()) n += anzahl;
  return n;
}

/**
 * Quantil aus dem Histogramm nach der **nächsten Rangzahl** (nearest rank):
 * der kleinste Wert, unter dem mindestens `p` der Beobachtungen liegen.
 *
 * Keine Interpolation — Tage sind ganzzahlig, und ein interpolierter „Median von
 * 12,5 Tagen" behauptete eine Genauigkeit, die die Tagesgranularität nicht
 * hergibt. `null` bei leerem Histogramm.
 */
export function quantilAusHistogramm(
  hist: ReadonlyMap<number, number>, p: number,
): number | null {
  const n = histogrammSumme(hist);
  if (n === 0) return null;
  const rang = Math.max(1, Math.ceil(p * n));
  let kumuliert = 0;
  for (const tage of [...hist.keys()].sort((a, b) => a - b)) {
    kumuliert += hist.get(tage) ?? 0;
    if (kumuliert >= rang) return tage;
  }
  return null;
}

/** Beobachtungen mit mehr als `grenze` Tagen. */
export function histogrammUeber(
  hist: ReadonlyMap<number, number>, grenze: number,
): number {
  let n = 0;
  for (const [tage, anzahl] of hist) if (tage > grenze) n += anzahl;
  return n;
}
