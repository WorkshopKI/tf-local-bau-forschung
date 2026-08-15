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
  ['trigger_bestaetigt', 'trigger_bedingt', 'zeitliche_naehe', 'kein_kuerzel'];

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

/**
 * Bis zu drei Belege je Auffälligkeit — damit ein Fall von Hand nachsehbar ist
 * und eine Zahl nicht allein im Raum steht.
 *
 * **Gedeckelt, und das ist der Punkt.** Der Modulkopf verbietet das Sammeln über
 * den Bestand aus gutem Grund; drei feste Plätze je Auffälligkeit sind kein
 * Sammeln, sondern eine Stichprobe mit Obergrenze. Doppelte bleiben draußen —
 * `MVA→ÄA` dreimal ist kein Beleg, sondern eine Zeile.
 */
export interface VerlaufsBeispiel {
  /** Was dasteht: `VV → 47`, `MVA→ÄA`, `16KN084044`. */
  text: string;
  /**
   * Das Kürzel darin — Sprungziel für die Kürzel-Tabelle. Getrennt geführt statt
   * aus `text` zurückgeparst: das Anzeigeformat darf sich ändern, ohne dass ein
   * Filter stillschweigend ins Leere zeigt.
   */
  kuerzel?: string;
}

export interface VerlaufsBeispiele {
  /** `VV → 47` — Kürzel und der rohe Zielcode, den der Katalog nicht beschriftet. */
  zielCodeUnbekannt: VerlaufsBeispiel[];
  /** `MVA→ÄA` — Export-Form und heutige Form, Notation wie in §14.3. */
  historischeKuerzel: VerlaufsBeispiel[];
  /** Kürzel, deren geliehene Bezeichnung sich zwischen den Formen widerspricht. */
  geliehenStrittig: VerlaufsBeispiel[];
  /** Spur-Ids (Aktenzeichen bzw. Verbund) mit einem Widerspruch. */
  widerspruch: VerlaufsBeispiel[];
  /** Spur-Ids mit einem Abschnitt negativer Dauer. */
  rueckwaerts: VerlaufsBeispiel[];
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
  /**
   * Übergänge, deren Zielcode der Statuskatalog nicht beschriftet.
   *
   * Nachfolger von `ohneZielcode`: die Zuarbeit führte einen **Wortlaut**, der
   * manchmal nicht auf einen Code auflöste (285 Verbünde). C16 führt Zahlen —
   * der Code ist immer da, aber nicht jeder steht im Katalog. Erkennbar daran,
   * dass die Beschriftung auf die nackte Zahl zurückfällt.
   */
  zielCodeUnbekannt: number;
  /** Übergänge, die ein umbenanntes Kürzel tragen. */
  historischeKuerzel: number;
  /**
   * Wie die Vorbedingungen der C16-Zeilen ausgegangen sind — die drei Zahlen,
   * die den Unterschied zwischen Obergrenze und Deckung ausmachen.
   *
   * `verletzt` heißt „die Regel griff damals nicht" und setzt keinen Status;
   * `unpruefbar` heißt „wir können es nicht lesen" und setzt ihn trotzdem, nur
   * mit gesenkter Konfidenz. Zusammengezählt wären beide eine Zahl, die zwei
   * Dinge mischt — genau der Fehler aus v3.20.
   */
  bedingungErfuellt: number;
  bedingungVerletzt: number;
  bedingungUnpruefbar: number;
  /**
   * Übergänge, deren Bezeichnung aus einer FREMDEN Projektform geliehen ist —
   * der Katalog kennt das Kürzel, aber nicht für die Form dieses Vorgangs.
   *
   * `geliehenUneindeutig` ist die Teilmenge, in der die Formen sich auch noch
   * widersprechen: dort gilt die angezeigte Bedeutung für diesen Vorgang **nicht
   * sicher**. Für DS ist das der Regelfall, weil die Projektform mit der
   * Richtlinie 2020 kam und in der Zuarbeit fehlt (§14.7).
   */
  bezeichnungGeliehen: number;
  bezeichnungGeliehenUneindeutig: number;
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
   * Die **Obergrenze**: für wie viele Termine die C16-Tabelle überhaupt eine
   * Zeile führt — Bedingungen ignoriert, Schlüssel `Programm|Kürzel`.
   *
   * Bis v3.22 war das die Vergleichszahl neben einer anderen Quelle. Seit v3.23
   * ist C16 die Regelquelle selbst, und die Zählung misst nun etwas anderes,
   * aber nicht weniger Nützliches: was das Regelwerk hergibt, gegen das, was die
   * Ableitung daraus tatsächlich belegt. Die Differenz sind die Bedingungen.
   */
  c16TvUebergaenge: number;
  c16VerbuendeMitVbUebergang: number;
  /** Nachsehbare Fälle zu den Auffälligkeiten — siehe {@link VerlaufsBeispiele}. */
  beispiele: VerlaufsBeispiele;
}

/** Wie viele Belege je Auffälligkeit höchstens mitlaufen. */
const BEISPIELE_MAX = 3;

/** Nimmt einen Beleg auf, solange Platz ist und er neu ist. */
function merkeBeispiel(liste: VerlaufsBeispiel[], text: string, kuerzel?: string): void {
  if (liste.length >= BEISPIELE_MAX || liste.some(b => b.text === text)) return;
  liste.push(kuerzel === undefined ? { text } : { text, kuerzel });
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
    zielCodeUnbekannt: 0, historischeKuerzel: 0,
    bedingungErfuellt: 0, bedingungVerletzt: 0, bedingungUnpruefbar: 0,
    bezeichnungGeliehen: 0, bezeichnungGeliehenUneindeutig: 0,
    segmente: 0, segmenteUnsicher: 0, segmenteMehrdeutig: 0,
    unsicher: { ohneAnfang: 0, ohneEnde: 0, unlesbar: 0, kurz: 0 },
    segmenteRueckwaerts: 0, dauerHistogramm: new Map(),
    abweichungNichtAbleitbar: 0, abweichungWiderspruch: 0,
    verbuendeMitStatuswechsel: 0, verbuendeMitTermin: 0, laengsteSpur: null,
    projektform: new Map(),
    c16TvUebergaenge: 0, c16VerbuendeMitVbUebergang: 0,
    beispiele: {
      zielCodeUnbekannt: [], historischeKuerzel: [], geliehenStrittig: [],
      widerspruch: [], rueckwaerts: [],
    },
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
    if (spur.abweichung?.art === 'widerspruch') {
      b.abweichungWiderspruch++;
      merkeBeispiel(b.beispiele.widerspruch, spur.id);
    }

    for (const u of spur.uebergaenge) {
      b.uebergaenge++;
      b.konfidenz[u.konfidenz]++;
      const ziel = u.setztStatus;
      if (ziel && ziel.code !== null && ziel.roh === String(ziel.code)) {
        b.zielCodeUnbekannt++;
        merkeBeispiel(b.beispiele.zielCodeUnbekannt, `${u.kuerzel} → ${ziel.roh}`, u.kuerzel);
      }
      if (u.kuerzelHistorisch) {
        b.historischeKuerzel++;
        merkeBeispiel(
          b.beispiele.historischeKuerzel, `${u.kuerzelHistorisch}→${u.kuerzel}`, u.kuerzel,
        );
      }
      if (u.bedingung?.urteil === 'erfuellt') b.bedingungErfuellt++;
      if (u.bedingung?.urteil === 'verletzt') b.bedingungVerletzt++;
      if (u.bedingung?.urteil === 'unpruefbar') b.bedingungUnpruefbar++;
      // Geliehen heißt: der Katalog kennt das Kürzel, aber nicht für DIESE Form.
      // Ohne Bezeichnung ist etwas anderes (das Kürzel fehlt ganz) und zählt hier
      // nicht mit — sonst stünde eine Lücke neben einer Anleihe unter einer Zahl.
      if (u.bezeichnung !== null && u.bezeichnungQuelle === undefined) {
        b.bezeichnungGeliehen++;
        if (!u.bezeichnungEindeutig) {
          b.bezeichnungGeliehenUneindeutig++;
          merkeBeispiel(b.beispiele.geliehenStrittig, u.kuerzel, u.kuerzel);
        }
      }
    }

    for (const s of spur.segmente) {
      b.segmente++;
      if (s.mehrdeutig) b.segmenteMehrdeutig++;
      if (s.dauerTage !== null && s.dauerTage < 0) {
        b.segmenteRueckwaerts++;
        merkeBeispiel(b.beispiele.rueckwaerts, spur.id);
      }
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

/**
 * Anteil als Prozent-Text mit einer Nachkommastelle; `'—'` ohne Grundgesamtheit.
 *
 * Deutsches Komma wie bei allen anderen Zahlen der Anzeige (`toLocaleString`).
 * `toFixed` lieferte „58.5 %" — in einer Zahlenspalte übersehbar, in einem Satz
 * („58.5 % der Teilvorhaben") nicht.
 */
export function anteil(teil: number, ganzes: number): string {
  if (ganzes === 0) return '—';
  const wert = (100 * teil) / ganzes;
  return `${wert.toLocaleString('de-DE', {
    minimumFractionDigits: 1, maximumFractionDigits: 1,
  })} %`;
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
