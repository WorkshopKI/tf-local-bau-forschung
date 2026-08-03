/**
 * Datenmodell des **Import-Diff-Journals**.
 *
 * Der Nacht-Export wird auf dem Share überschrieben; eine `D_`-Setzung, die im
 * Foyer korrigiert oder erneut gesetzt wird, ist danach spurlos. Verifikation V9
 * hat es bestätigt: die Spalte trägt das **zuletzt** gesetzte Datum. Das Journal
 * hält fest, was sich zwischen zwei Exporten geändert hat — ab dem Tag seiner
 * Einführung ist der Verlauf belegt statt genähert.
 *
 * **Es kann nicht aus einer Dateireihe abgeleitet werden.** Alte Exporte gibt es
 * nicht, also führt das Journal einen eigenen Stand mit: `stand.json` ist die
 * Kopie der letzten Projektion, gegen die der nächste Export verglichen wird.
 *
 * **Keine Personen-Achse.** Bearbeiter-Kürzel werden nicht journalisiert, und
 * keine Ansicht darf nach ihnen gruppieren oder filtern. Sonst entstünde ein
 * personenbezogenes Aktivitätsprotokoll — Leistungs- und Verhaltenskontrolle,
 * mitbestimmungspflichtig. Das ist eine bewusste Gestaltungsentscheidung, kein
 * Versehen; `JOURNAL_AUSGESCHLOSSEN` und ein Konventionstest halten sie.
 */

/** Der Wert eines journalisierten Feldes: Datum als `YYYYMMDD`, sonst Text. */
export type JournalWert = number | string;

/** Die Projektion eines Exports: je Antrag die gesetzten Journal-Felder.
 *  Leere Werte fehlen als Schlüssel — das hält die Datei klein. */
export type JournalWerte = Record<string, Record<string, JournalWert>>;

/** Woher ein Diff stammt: welcher Export, von wann. */
export interface Stempel {
  /** Erste 12 Hex-Stellen von SHA-256 über die Bytes des Exports. */
  id: string;
  /** ISO-Tag aus `file.lastModified`. */
  datum: string;
}

/** Was mit einem Feld (bzw. einem Antrag) passiert ist. */
export type EintragsArt =
  /** leer → Wert. */
  | 'gesetzt'
  /** Wert → anderer Wert. */
  | 'geaendert'
  /** Wert → leer. Typischerweise eine Korrektur im Foyer, heute unsichtbar. */
  | 'geleert'
  /** Antrag erstmals im Export — EIN Eintrag je Antrag, nicht je Feld. */
  | 'antrag-neu'
  /** Antrag nicht mehr im Export. Festhalten, nichts löschen: kann ein
   *  Exportfehler sein, und ein stilles Verschwinden wäre die schlechteste
   *  aller Antworten. */
  | 'antrag-fehlt';

export interface JournalEintrag {
  /** Der Export, bei dem der Eintrag entstand. Teil des Dedupe-Schlüssels. */
  stempel: string;
  /** Aktenzeichen. */
  antragId: string;
  art: EintragsArt;
  /** Fehlt bei `antrag-neu` / `antrag-fehlt`. */
  feld?: string;
  von?: JournalWert;
  nach?: JournalWert;
  /** Export-Datum (ISO-Tag). */
  datum: string;
  /**
   * Zwischen den beiden Exporten liegt mehr als ein Tag — die Änderung wird als
   * **Zeitraum** ausgewiesen, nicht als Datum behauptet. Ein Wochenende oder ein
   * Urlaub reicht dafür schon.
   */
  unscharf?: true;
  vonDatum?: string;
  bisDatum?: string;
}

/** Der mitgeführte Stand, gegen den der nächste Export verglichen wird. */
export interface JournalStand {
  schema: 1;
  /**
   * Ab wann das Journal Aussagen macht (ISO-Tag des Baseline-Laufs). **Der
   * Nullpunkt muss überall dabeistehen**, sonst wird eine unvollständige
   * Chronik als vollständige gelesen.
   */
  journalAb: string;
  letzterStempel: Stempel;
  /** Ringpuffer verarbeiteter Stempel — die Idempotenz-Grundlage. */
  verarbeitet: string[];
  /**
   * Die Programm-Liste, mit der dieser Stand gebaut wurde.
   *
   * Das Journal folgt dem Betrachtungsbereich (bewusste Abweichung von
   * Pitfall #46, siehe `vorgangssystem.md`). Ändert sich der Bereich, bekämen
   * die neu hinzugekommenen Anträge sonst tausend Phantom-`antrag-neu`-Einträge;
   * mit dieser Liste erkennt der Lauf den Wechsel und legt für sie eine
   * **Baseline** an.
   */
  bereich: string[];
  werte: JournalWerte;
}

/** Wie viele Stempel der Ringpuffer hält. */
export const VERARBEITET_MAX = 400;
