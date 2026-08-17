/**
 * **Klärfragen** — Befunde aus dem Bestand, die eine fachliche Antwort brauchen
 * und keine im Code haben.
 *
 * **Nicht zu verwechseln mit dem Modul „Zu klären"** (`src/plugins/zu-klaeren/`,
 * Pitfall #49). Das ist ein *Fragebogen*: feste Punkte, das Team antwortet in
 * der App, die Antworten liegen je Autor auf dem Share. Hier entsteht das
 * Gegenstück — eine *Ableitung*: der Code rechnet aus, was offen ist, und gibt
 * es als Datei heraus. Kein Rückweg, keine Zustandsverwaltung, kein Schreibpfad.
 * Die Antworten kommen zunächst außerhalb der App zurück.
 *
 * **Wiederholbar, nicht gepflegt.** Bis v3.23 standen die Zahlen zu diesen
 * Befunden ausschließlich in `vorgangssystem.md` — Einmal-Handmessungen aus
 * einer Konsolensitzung. Sie veralten mit jedem Nacht-Export, und niemand
 * konnte sie nachrechnen. Jede Frage hier wird bei jedem Lauf neu aus dem
 * Bestand abgeleitet; nichts wird abgeschrieben.
 *
 * Rein und deterministisch: keine IO, keine Uhr. Der Bestand kommt als
 * Parameter ({@link KlaerfragenBestand}), gemessen in `bestand.ts`.
 */
import type { Projektform, UneinigesKuerzel } from '../kuerzel-katalog';

/**
 * Woher ein Befund stammt — zugleich die Zuständigkeit: die Datei geht reihum,
 * und jede Person filtert auf ihre Herkunft.
 *
 * **Die drei Wert-Herkünfte sind bewusst geordnet und disjunkt.** Derselbe
 * Rohstatus fiele sonst in mehrere Töpfe und würde in einer nach `vorkommen`
 * sortierten Liste mehrfach gewogen. Die Reihenfolge geht vom Grundsätzlichen
 * zum Kosmetischen: kennt die Fassung den Wert überhaupt (`wert-nicht-in-fassung`)
 * → lässt er sich einem amtlichen Code zuordnen (`wert-ohne-code`) → trägt er
 * eine Kurzform (`kurzlabel`). Der erste Treffer gewinnt.
 */
export type Herkunft =
  /** Zwei Projektformen sagen Verschiedenes, schon NW gegen FuE. Katalogfrage. */
  | 'bedeutung-nw-fue'
  /** DS leiht eine Bezeichnung aus einer Form, der eine andere widerspricht. */
  | 'bedeutung-ds-anleihe'
  /** Für Durchführbarkeitsstudien gibt es gar keine Kürzel-Quelle. */
  | 'ds-ohne-quelle'
  /** Ein K/T-Kürzelpaar widerspricht der Konvention — Verdacht, keine Korrektur. */
  | 'kt-konvention'
  /** Die Fassung führt diesen Rohstatus nicht, obwohl er im Bestand steht. */
  | 'wert-nicht-in-fassung'
  /** Die Fassung führt ihn, aber kein amtlicher Code lässt sich zuordnen. */
  | 'wert-ohne-code'
  /** Code bekannt, aber keine Kurzform greift — im Band sichtbar unfertig. */
  | 'kurzlabel'
  /** Der Katalog weicht von einem fachlich bestätigten Wortlaut ab. */
  | 'bezeichnung-weicht-ab';

/**
 * Herkünfte, die es gab und die **entschieden** sind. Ihre Id-Präfixe bleiben
 * vergeben und werden nie neu belegt — sie stehen in einer Datei, die zurückkam.
 *
 * - `amtlicher-text-klein` — zwölf Codes beginnen kleingeschrieben, alle zwölf
 *   als amtlich korrekt bestätigt. Damit ist nicht eine Liste abgearbeitet,
 *   sondern die **Frageklasse** beantwortet: der amtliche Text ist Fremddatum
 *   und wird nie korrigiert, auch nicht bei künftigen Fällen, die falsch
 *   aussehen (CLAUDE.md, Pitfall #43). Eine wachsende Bestätigungsliste wäre
 *   Buchhaltung ohne Entscheidung.
 * - `strittig-marker` — blieb unbeantwortet und wurde als **Vorgabe**
 *   entschieden: `bedeutungsdivergenz` steht jetzt neben `strittig`, zwei
 *   Marker für zwei Aussagen. Die Frage weiter zu stellen, nachdem ihre
 *   Antwort implementiert ist, wäre Theater.
 */
export const STILLGELEGTE_HERKUENFTE: readonly string[] = [
  'amtlicher-text-klein', 'strittig-marker',
];

/** Reihenfolge im Export und in der Anzeige — vom Fachlichen zum Kuratorischen. */
export const HERKUENFTE: readonly Herkunft[] = [
  'bedeutung-nw-fue', 'bedeutung-ds-anleihe', 'ds-ohne-quelle',
  'kt-konvention', 'wert-nicht-in-fassung', 'wert-ohne-code', 'kurzlabel',
  'bezeichnung-weicht-ab',
];

export const HERKUNFT_LABEL: Readonly<Record<Herkunft, string>> = {
  'bedeutung-nw-fue': 'Bedeutung widersprüchlich (NW/FuE)',
  'bedeutung-ds-anleihe': 'Bedeutung geliehen (DS)',
  'ds-ohne-quelle': 'DS ohne Kürzel-Quelle',
  'kt-konvention': 'K/T-Paar gegen die Konvention',
  'wert-nicht-in-fassung': 'Statuswert fehlt in der Fassung',
  'wert-ohne-code': 'Statuswert ohne amtlichen Code',
  'kurzlabel': 'Kurzlabel fehlt',
  'bezeichnung-weicht-ab': 'Bezeichnung weicht von der Fachaussage ab',
};

/** Wer die Herkunft beantwortet — steht im Blatt „Hinweise". */
export const HERKUNFT_ADRESSAT: Readonly<Record<Herkunft, string>> = {
  'bedeutung-nw-fue': 'Fachbereich (Kürzelkatalog)',
  'bedeutung-ds-anleihe': 'Fachbereich (Kürzelkatalog)',
  'ds-ohne-quelle': 'Fachbereich / Leitung',
  'kt-konvention': 'Fachbereich (Kürzelkatalog)',
  'wert-nicht-in-fassung': 'Kuration (PL)',
  'wert-ohne-code': 'Kuration (PL)',
  'kurzlabel': 'Kuration (PL)',
  'bezeichnung-weicht-ab': 'Kuration (PL)',
};

/** Ein Befund, der eine Antwort braucht. */
export interface Klaerfrage {
  /**
   * Stabil und aus **Daten** gebildet (`kurzlabel:code-59`), nie aus einer
   * Position. Die Id steht in einer Datei, die Wochen unterwegs ist und
   * zurückkommt; ein eingeschobener Befund verschöbe sonst alle Antworten
   * dahinter — lautlos. Dieselbe Zusage wie in `zu-klaeren` (`no-index-punkt-id`).
   */
  id: string;
  herkunft: Herkunft;
  /** Worum es geht: Kürzel, Code oder Rohwert. Kurz genug für eine Spalte. */
  betrifft: string;
  /** Die Frage selbst — beantwortbar, ohne den Rest der Zeile zu kennen. */
  frage: string;
  /** Was man wissen muss, um zu antworten. Steht mit im Export. */
  kontext: string;
  /**
   * Vorgegebene Antworten. Reduziert Freitext, den später niemand zuordnen
   * kann. Der Export hängt sie als Datenvalidierung an die Antwortspalte.
   */
  optionen?: readonly string[];
  /**
   * Wie schwer der Befund wiegt — **Vorgänge**, ganzer Bestand, ohne
   * Betrachtungsbereich (Pitfall #46). Eine Einheit für alle Herkünfte, sonst
   * sortiert die Liste Äpfel gegen Birnen. `null` = nicht zählbar.
   */
  vorkommen: number | null;
}

/** Was ein Bestandslauf für die Ableitung einsammelt. */
export interface KlaerfragenBestand {
  /**
   * Vorgänge je rohem Statuswert — **entdoppelt** über den eigenen Status und
   * den seines Verbunds. Ein Vorgang, dessen TV- und Verbundstatus denselben
   * Wert tragen, zählt einmal; sonst wöge ein doppelt geführter Wert schwerer
   * als ein einfach geführter (dieselbe Regel wie `kuerzelEinesVorgangs`).
   */
  rohStatus: ReadonlyMap<string, number>;
  /**
   * Verbünde je rohem Verbundstatus. **Andere Einheit**, deshalb ein eigenes
   * Feld: sie steht nur im Kontexttext („7 Zeilen / 5 Verbünde"), nie in der
   * Spalte, nach der sortiert wird.
   */
  rohStatusVerbuende: ReadonlyMap<string, number>;
  /** Vorgänge, die das Kürzel gesetzt tragen — ganzer Bestand. */
  proKuerzel: ReadonlyMap<string, number>;
  /** Dieselbe Zählung, beschränkt auf Vorgänge der Projektform DS. */
  proKuerzelDs: ReadonlyMap<string, number>;
  /** Verbünde mit `vb_phase` = DS. */
  dsVerbuende: number;
  /** Vorgänge mit `vb_phase` = DS. */
  dsVorgaenge: number;
  gesamtVorgaenge: number;
  /** ISO-Zeitpunkt des jüngsten CSV-Imports; `null` wenn unbekannt. */
  importiertAm: string | null;
}

/**
 * Alles, was {@link baueKlaerfragen} braucht.
 *
 * Beschriftungen stehen **nicht** hier drin: `statusLabel`/`statusKurzLabelMit`
 * lesen den Katalog-Snapshot der laufenden Fassung selbst, und genau deren
 * Ergebnis steht in der Oberfläche. Sie hier noch einmal hereinzureichen wäre
 * eine zweite Auflösung derselben Frage (`status-kurzlabel-single-source`).
 */
export interface KlaerfragenEingabe {
  bestand: KlaerfragenBestand;
  /**
   * Die Rohwerte, die die geladene Katalog-Fassung führt (normalisiert).
   * `null` = keine Fassung geladen; dann entfällt die Herkunft
   * `wert-nicht-in-fassung`, statt „die Fassung kennt nichts davon" zu
   * behaupten — „nichts zu melden" und „nicht geprüft" sind zwei Aussagen.
   */
  fassungsWerte: ReadonlySet<string> | null;
  /**
   * Uneinige Kürzel ohne Antwort. Fehlt = aus dem Katalog abgeleitet
   * (`offeneBedeutungen()`). Ausschliesslich der Gegenprobe wegen ein
   * Parameter: die Menge geht am heutigen Katalog leer aus, und eine
   * Ableitung, die immer nichts liefert, ist ohne Positivkontrolle nicht von
   * einer kaputten zu unterscheiden.
   */
  offeneBedeutungen?: readonly UneinigesKuerzel[];
  /**
   * Kürzel, die **ruhen** — sie stellen keine Frage mehr.
   *
   * Gemeint sind die Codes ohne jede CSV-Spalte und die von der PL ruhend
   * gestellten (`ruhende-kuerzel.ts`). Über sie lässt sich am Bestand nichts
   * belegen und nichts entscheiden; sie in den Bogen zu schreiben verbrauchte
   * Termin-Zeit für Kürzel, deren Antwort nirgends ankommt.
   *
   * Fehlt = **nichts ruht**. Kein Zugriff auf die Fassung von hier aus: dieses
   * Modul ist rein, und der Aufrufer soll sehen, was er ausblendet.
   */
  ruhendeCodes?: ReadonlySet<string>;
}

/** Eine Bedeutung samt Herkunftsform — für die Kontextspalte. */
export interface BedeutungsZeile {
  form: Projektform;
  bezeichnung: string;
}
