/**
 * Was die **Klärrunde** zu den Kürzeln entschieden hat.
 *
 * **Warum das eine eigene Datei ist.** `kuerzel-katalog.data.ts` ist generiert
 * (`npm run gen:kuerzel-katalog`) und wird von der nächsten Zuarbeit
 * überschrieben. Eine Antwort, die dort hineingeschrieben würde, wäre beim
 * nächsten Lauf weg. Dieselbe Trennung wie `seed-codes.ts` neben
 * `seed-codes.data.ts` (Pitfall #43): Fremddaten drüben, unsere Kuration hier.
 *
 * **Rein und deterministisch**: keine IO, keine Uhr. Gelesen wird ausschließlich
 * über {@link kuerzelAuskunft} in `kuerzel-katalog.ts` — die eine Tür
 * (Konventionstest `kuerzel-nie-flach`).
 *
 * ## Die vier Listen sagen vier verschiedene Dinge
 *
 * - {@link QUELLKORREKTUREN} — die Zuarbeit ist an dieser Stelle **belegt
 *   falsch**. Wirkt vor allem anderen, damit auch die Sammelregel und die
 *   DS-Kuration den richtigen Wortlaut lesen.
 * - {@link VEREINHEITLICHT} — die Formen widersprachen sich, und **ein**
 *   Wortlaut gilt für alle. Der Widerspruch war ein Katalogproblem.
 * - {@link DIVERGENZ_BESTAETIGT} — die Formen widersprechen sich, und **das ist
 *   richtig so**: die Bedeutung hängt an der Projektform. Kein Wortlaut ändert
 *   sich; der Fall gilt als geklärt und wird nicht erneut gefragt.
 * - {@link DS_BEDEUTUNG} — was für Durchführbarkeitsstudien gilt, **wo die
 *   Einzelantwort der Sammelregel widerspricht**.
 *
 * ## Die Sammelregel steht NICHT in diesen Listen
 *
 * Die Antwort auf `ds-ohne-quelle` lautet: „Die Kürzel für DS sind die gleichen
 * wie für FuE. Keine eigene Quelle nötig." Das ist eine **Regel**, kein
 * Katalog — sie lebt als Auflösungsreihenfolge in `kuerzel-katalog.ts`, nicht
 * als 130 kopierte Einträge. Ein pauschaler Alias DS → FuE als Daten würde die
 * acht Einträge in {@link DS_BEDEUTUNG} überschreiben, sobald ihn jemand scharf
 * schaltet; als Reihenfolge kann er das strukturell nicht.
 *
 * Gemessen: 25 Einzelfragen zu DS, 17 davon wortgleich mit FuE — die
 * Sammelregel ist **bestätigend, nicht korrigierend** (sie ändert keine einzige
 * Anzeige, weil die erstgeführte Form dort ohnehin FuE entspricht).
 *
 * ## `bestaetigung_offen` heißt: wirkt, aber nicht gegengezeichnet
 *
 * Zehn Einträge tragen den Stand. Sie werden **angezeigt und nicht erneut
 * gefragt** — eine zweite Runde derselben Frage bekäme dieselbe Antwort und
 * beantwortete den Zweifel nicht. Sie stehen stattdessen in
 * [vorgangssystem.md](../../../docs/architecture/vorgangssystem.md) als offener
 * Punkt für die Gegenzeichnung:
 *
 * - **acht DS-Einträge**, deren Einzelantwort der Sammelregel widerspricht.
 *   Sechs folgen DL, zwei EP — beides Einzelvorhabenformen, und eine
 *   Durchführbarkeitsstudie ist ebenfalls ein Einzelvorhaben. Offen ist damit
 *   die Grundregel: gilt „DS = FuE mit acht Ausnahmen", oder wäre „DS = DL" die
 *   bessere Grundregel?
 * - **`ÄZX`** — gewählt ist „Bewilligung ohne Bescheid" (NW und DL sagen das),
 *   verworfen sind FuE „Ablehnung des Änderungsantrags an ZE" und EP
 *   „Aktennotiz zur Ablehnung des Änderungsantrages an EN". Das ist eine
 *   Umkehrung, kein Schreibunterschied — zwei Formen sagen Bewilligung, zwei
 *   sagen Ablehnung.
 * - **`ÄZ`** — die Vereinheitlichung auf „Änderungsbescheid an ZE" löscht das
 *   EP-Muster „Aktennotiz … an EuroNorm", das EP auch bei `LZ` und `ÄZX` führt.
 */
// Der Typ kommt durch die TÜR, nicht an ihr vorbei (`kuerzel-nie-flach`).
// `kuerzel-katalog.ts` importiert diese Datei seinerseits — als reiner
// Typ-Import ist das keine Laufzeit-Kante und für `npm run cycles` unsichtbar.
import type { Projektform } from './kuerzel-katalog';

/**
 * Woher eine Entscheidung kommt.
 *
 * `frageId` ist der Rückweg zur Frage: sie muss eine Id sein, die die
 * Klärfragen-Ableitung **ohne** Kuration wirklich erzeugt (Test
 * `kuerzel-kuration`). Ohne diese Bindung verwaiste eine Entscheidung
 * lautlos, sobald der Generator seine Fragen umbaut.
 */
export interface KurationsBeleg {
  /** Welche Runde. */
  quelle: string;
  /** Spalte „Name" der Antwortmappe. */
  name: string;
  /** Spalte „Datum", ISO-Tag. */
  datum: string;
  /** Die Klärfrage, auf die geantwortet wurde. */
  frageId: string;
}

/**
 * Ist die Entscheidung gegengezeichnet?
 *
 * `bestaetigung_offen` heißt **nicht** „gilt nicht" — sie wirkt. Es heißt: sie
 * weicht vom Erwarteten ab und steht auf der Liste für den nächsten Termin.
 */
export type KurationsStand = 'bestaetigt' | 'bestaetigung_offen';

/** Ein Wortlaut, der künftig für ALLE Projektformen gilt. */
export interface VereinheitlichteBedeutung {
  kuerzel: string;
  bezeichnung: string;
  /**
   * Die Form, deren Wortlaut gewählt wurde. Nur für das Drift-Gatter: bricht
   * eine neue Zuarbeit den Wortlaut, fällt es auf, statt still durchzuschlagen.
   */
  ausForm: Projektform;
  stand: KurationsStand;
  beleg: KurationsBeleg;
}

/** Ein Kürzel, dessen Bedeutung je Projektform verschieden ist — bestätigt. */
export interface BestaetigteDivergenz {
  kuerzel: string;
  beleg: KurationsBeleg;
}

/** Was für DS gilt, wo die Einzelantwort der Sammelregel widerspricht. */
export interface DsBedeutung {
  kuerzel: string;
  bezeichnung: string;
  /** Welche Form denselben Wortlaut führt — Drift-Gatter und Beleg zugleich. */
  entsprichtForm: Projektform;
  stand: KurationsStand;
  beleg: KurationsBeleg;
}

/**
 * Ein **belegter** Erfassungsfehler in der Zuarbeit.
 *
 * Kein Sammelbecken für Schönheitskorrekturen: Bezeichnungen sind Fremddaten
 * und stehen wortgetreu. Hier steht nur, was jemand belegt hat — `XVK`/`XVT`
 * über die Antwort plus die K/T-Konvention, die drei Rechtschreibfehler über
 * die Antwort, die den Fehler aus dem angebotenen Kontext mitkopiert hat.
 *
 * `falsch` steht wortgetreu dabei, damit die Korrektur **nachprüfbar** bleibt:
 * trifft sie nichts mehr, ist sie veraltet und der Test schlägt an.
 */
export interface Quellkorrektur {
  kuerzel: string;
  formen: readonly Projektform[];
  falsch: string;
  richtig: string;
  begruendung: string;
  beleg: KurationsBeleg;
}

// --- Daten ----------------------------------------------------------------
// Reihenfolge wie in der Antwortmappe (nach Vorkommen absteigend), damit sich
// Zeile und Antwort ohne Suchen gegenüberstellen lassen.

export const VEREINHEITLICHT: readonly VereinheitlichteBedeutung[] = [
  { kuerzel: 'AK4', bezeichnung: 'Gutachten kaufmännisch fertig', ausForm: 'FuE', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:AK4' } },
  { kuerzel: 'VZE', bezeichnung: 'Eingang VN-Zahl', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:VZE' } },
  { kuerzel: 'GL', bezeichnung: 'Nachlieferung zur ZA', ausForm: 'FuE', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:GL' } },
  { kuerzel: 'SK', bezeichnung: 'kaufm. Bearbeitung Entsperrung erledigt', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:SK' } },
  { kuerzel: 'ST', bezeichnung: 'techn. Bearbeitung Entsperrung erledigt', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:ST' } },
  { kuerzel: 'MVZ', bezeichnung: 'Änderungsbescheid Mittelverschiebung an ZE', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:MVZ' } },
  { kuerzel: 'VN', bezeichnung: 'Nachforderung/Rückfragen zum VN', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:VN' } },
  { kuerzel: 'ÄT', bezeichnung: 'Änderung techn. bearbeitet', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:ÄT' } },
  { kuerzel: 'ÄK', bezeichnung: 'Änderung kaufm. bearbeitet', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:ÄK' } },
  // Überschreibt das EP-Muster „Aktennotiz … an EuroNorm" — Gegenzeichnung offen.
  { kuerzel: 'ÄZ', bezeichnung: 'Änderungsbescheid an ZE', ausForm: 'FuE', stand: 'bestaetigung_offen',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:ÄZ' } },
  { kuerzel: 'LT', bezeichnung: 'Laufzeitänderung techn. bearbeitet', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:LT' } },
  { kuerzel: 'LK', bezeichnung: 'Laufzeitänderung kaufm. bearbeitet', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:LK' } },
  { kuerzel: 'SL', bezeichnung: 'Eingang Nachlieferung zur Entsperrung', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:SL' } },
  { kuerzel: 'SN', bezeichnung: 'Nachforderung/Rückfragen zur Entsperrung', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:SN' } },
  { kuerzel: 'ÄL', bezeichnung: 'Nachlieferung zum Änderungsantrag', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:ÄL' } },
  { kuerzel: 'ÄN', bezeichnung: 'Nachforderung/Rückfragen zum Änderungsantrag', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:ÄN' } },
  // Kehrt die Bedeutung für FuE und EP um (Ablehnung → Bewilligung) — offen.
  { kuerzel: 'ÄZX', bezeichnung: 'Bewilligung ohne Bescheid', ausForm: 'NW', stand: 'bestaetigung_offen',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:ÄZX' } },
  { kuerzel: 'LN', bezeichnung: 'Nachforderung/Rückfragen zur Laufzeitänderung', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:LN' } },
  { kuerzel: 'LL', bezeichnung: 'Nachlieferung zur Laufzeitänderung', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:LL' } },
  { kuerzel: 'XHSP', bezeichnung: 'Bewilligung ausgesetzt wegen Haushalt', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:XHSP' } },
  { kuerzel: 'ÄAZ', bezeichnung: 'Ablehnung des Änderungsantrags an ZE', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:ÄAZ' } },
  { kuerzel: 'ZBK', bezeichnung: 'kaufm. Prüfung Zwischenbericht erledigt', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:ZBK' } },
  { kuerzel: 'ZBT', bezeichnung: 'techn. Prüfung Zwischenbericht erledigt', ausForm: 'NW', stand: 'bestaetigt',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:ZBT' } },
];

/**
 * `XVK` und `XVT` stehen hier **und** in {@link QUELLKORREKTUREN}: die Antwort
 * bestätigt beides in einem Satz — „beide gelten je Projektform verschieden,
 * **aber immer kaufmännisch, nicht technisch**". Das Erste ist die Divergenz,
 * das Zweite der Beleg für die Vertauschung.
 */
export const DIVERGENZ_BESTAETIGT: readonly BestaetigteDivergenz[] = [
  { kuerzel: 'DMB', beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:DMB' } },
  { kuerzel: 'YW', beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:YW' } },
  { kuerzel: 'GZX', beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:GZX' } },
  { kuerzel: 'XVK', beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:XVK' } },
  { kuerzel: 'XVT', beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:XVT' } },
  { kuerzel: 'XVU', beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:XVU' } },
];

/** Sechs folgen DL, zwei EP. Alle acht sind noch nicht gegengezeichnet. */
export const DS_BEDEUTUNG: readonly DsBedeutung[] = [
  { kuerzel: 'AB', bezeichnung: 'Bewilligungsempfehlung durch Haushaltsbeauftrage/Titelverantwortliche', entsprichtForm: 'DL', stand: 'bestaetigung_offen',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-ds-anleihe:AB' } },
  { kuerzel: 'ALSB', bezeichnung: 'BB ohne (weitere) Nachforderungen', entsprichtForm: 'DL', stand: 'bestaetigung_offen',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-ds-anleihe:ALSB' } },
  { kuerzel: 'ALS', bezeichnung: 'TB ohne (weitere) Nachforderungen', entsprichtForm: 'DL', stand: 'bestaetigung_offen',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-ds-anleihe:ALS' } },
  { kuerzel: 'ABE', bezeichnung: 'Eingang Empfangsbestätigung', entsprichtForm: 'DL', stand: 'bestaetigung_offen',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-ds-anleihe:ABE' } },
  { kuerzel: 'GN', bezeichnung: 'Nachforderung/Rückfragen zur ZA', entsprichtForm: 'DL', stand: 'bestaetigung_offen',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-ds-anleihe:GN' } },
  { kuerzel: 'ARR', bezeichnung: 'Termin Rücknahmeempfehlung rechtskräftig', entsprichtForm: 'EP', stand: 'bestaetigung_offen',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-ds-anleihe:ARR' } },
  { kuerzel: 'LZ', bezeichnung: 'Änderungsbescheid Laufzeit an ZE', entsprichtForm: 'DL', stand: 'bestaetigung_offen',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-ds-anleihe:LZ' } },
  // Die Antwort trug „Widerufsbescheid an ZE"; hier steht der korrigierte
  // Wortlaut, weil die Quellkorrektur vor der Übernahme wirkt.
  { kuerzel: 'WRZ', bezeichnung: 'Widerrufsbescheid an ZE', entsprichtForm: 'EP', stand: 'bestaetigung_offen',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-ds-anleihe:WRZ' } },
];

export const QUELLKORREKTUREN: readonly Quellkorrektur[] = [
  {
    kuerzel: 'XVK', formen: ['NW'],
    falsch: 'Netzwerkvereinbarung technisch geprüft',
    richtig: 'Netzwerkvereinbarung kaufmännisch geprüft',
    begruendung: 'K/T-Konvention über 19 Paare; FuE führt dasselbe Paar richtig herum.',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:XVK' },
  },
  {
    kuerzel: 'XVT', formen: ['NW'],
    falsch: 'Netzwerkvereinbarung kaufmännisch geprüft',
    richtig: 'Netzwerkvereinbarung technisch geprüft',
    begruendung: 'K/T-Konvention über 19 Paare; FuE führt dasselbe Paar richtig herum.',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-nw-fue:XVT' },
  },
  {
    kuerzel: 'ABLK', formen: ['NW', 'FuE', 'DL'],
    falsch: 'Ablehnung adm. erstellt/ergänzt/keine Eränzung',
    richtig: 'Ablehnung adm. erstellt/ergänzt/keine Ergänzung',
    begruendung: 'Rechtschreibung. Steht so in der Zuarbeit; die Antwort hat den Fehler aus dem angebotenen Kontext mitkopiert.',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-ds-anleihe:ABLK' },
  },
  {
    kuerzel: 'ABLT', formen: ['NW', 'FuE', 'DL'],
    falsch: 'Ablehnung tech. erstellt/ergänzt/keine Eränzung',
    richtig: 'Ablehnung tech. erstellt/ergänzt/keine Ergänzung',
    begruendung: 'Rechtschreibung. Steht so in der Zuarbeit; die Antwort hat den Fehler aus dem angebotenen Kontext mitkopiert.',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-ds-anleihe:ABLT' },
  },
  {
    kuerzel: 'WRZ', formen: ['EP'],
    falsch: 'Widerufsbescheid an ZE',
    richtig: 'Widerrufsbescheid an ZE',
    begruendung: 'Rechtschreibung. Steht so in der Zuarbeit; die Antwort hat den Fehler aus dem angebotenen Kontext mitkopiert.',
    beleg: { quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'bedeutung-ds-anleihe:WRZ' },
  },
];

// --- Nachschlagen ---------------------------------------------------------

const VEREINHEITLICHT_INDEX: ReadonlyMap<string, VereinheitlichteBedeutung> = new Map(
  VEREINHEITLICHT.map(v => [v.kuerzel.toUpperCase(), v]),
);
const DIVERGENZ_INDEX: ReadonlyMap<string, BestaetigteDivergenz> = new Map(
  DIVERGENZ_BESTAETIGT.map(d => [d.kuerzel.toUpperCase(), d]),
);
const DS_INDEX: ReadonlyMap<string, DsBedeutung> = new Map(
  DS_BEDEUTUNG.map(d => [d.kuerzel.toUpperCase(), d]),
);

export function vereinheitlichtFuer(kuerzel: string): VereinheitlichteBedeutung | null {
  return VEREINHEITLICHT_INDEX.get(kuerzel.trim().toUpperCase()) ?? null;
}

/** Ist der Bedeutungsunterschied dieses Kürzels bestätigt? */
export function divergenzBestaetigt(kuerzel: string): BestaetigteDivergenz | null {
  return DIVERGENZ_INDEX.get(kuerzel.trim().toUpperCase()) ?? null;
}

export function dsBedeutungFuer(kuerzel: string): DsBedeutung | null {
  return DS_INDEX.get(kuerzel.trim().toUpperCase()) ?? null;
}

/**
 * Beleg in einer Zeile — für Popover, Glossar und den Übernahme-Bericht.
 * `„Antwortrunde 1 · AnMa · 07.08.2026"`
 */
export function belegText(b: KurationsBeleg): string {
  const [jahr, monat, tag] = b.datum.split('-');
  return `${b.quelle} · ${b.name} · ${tag}.${monat}.${jahr}`;
}
