/**
 * Datenmodell der **Verlaufsableitung**: aus welchen Statusabschnitten ein
 * Vorgang besteht, wie lange er in jedem stand, welches Kürzel den Wechsel
 * ausgelöst hat.
 *
 * **Abgeleitet, nicht beobachtet.** Das Import-Diff-Journal (§12) beginnt erst
 * am 05.08.2026; gemessen hatten 12 356 von 12 356 Anträgen ihren letzten
 * Statuswechsel davor. Eine Spur, die nur beobachten kann, sagt bei jedem
 * Vorgang „nicht beobachtet" und erklärt damit nur ihre eigene Blindheit. Also
 * rekonstruiert die App den Weg aus den `D_`-Datumsspalten und den
 * Statuswechsel-Regeln der **C16-Trigger-Tabelle** — und schreibt an jede Spur,
 * woher sie kommt.
 *
 * **Das ändert nichts an Pitfall #44.** Die App leitet keinen *geltenden* Status
 * ab: das letzte Segment jeder Spur trägt immer den **importierten** Wert. Weicht
 * die Rekonstruktion davon ab, ist das ein Befund ({@link VerlaufsSpur.abweichung}),
 * nie ein Überschreiben.
 *
 * Rein und deterministisch: keine IO, keine Uhr — Stichtag, Journal und
 * Trigger-Regeln reicht der Aufrufer herein.
 */
import type { Rolle } from '../typen';
import type { BedingungsUrteil } from '../trigger-bedingung';
import type { Projektform, ProjektformLage } from '../kuerzel-katalog';
import type { LabelHerkunft } from '@/core/utils/status-wert-labels';

/** Ebene, über die eine Spur spricht. */
export type SpurArt = 'tv' | 'verbund';

/**
 * Vier Aussagen, die nicht zu einer leeren Zeile verschmelzen dürfen.
 *
 * - `verlauf` — mindestens ein Übergang belegt einen Statuswechsel.
 * - `kein_bearbeitungsstand` — der Statuswert ist ein Marker bzw. eine Rolle im
 *   Verbund (29/88/93/94). Solche Zeilen haben keinen Verlauf und keine Frist;
 *   sie bekommen keine Bahn, verschwinden aber auch nicht stillschweigend.
 * - `kein_wert_im_csv` — die Ebene führt gar keinen Statuswert.
 * - `nicht_beobachtet` — es gibt einen Status, aber kein Übergang erklärt ihn.
 *   Der Normalfall für handgesetzte Verbundstatus; ein Befund, kein Loch.
 */
export type SpurZustand =
  | 'verlauf' | 'kein_bearbeitungsstand' | 'kein_wert_im_csv' | 'nicht_beobachtet';

/** Woher die Spur weiß, was sie sagt. Heute überall `abgeleitet`. */
export type SpurHerkunft = 'abgeleitet' | 'beobachtet';

/**
 * Wie sicher ein Übergang einen Statuswechsel belegt.
 *
 * - `trigger_bestaetigt` — eine C16-Zeile des Programms greift, und **alle**
 *   ihre Vorbedingungen waren zum Zeitpunkt des Kürzels erfüllt.
 * - `trigger_bedingt` — die Zeile greift, mindestens eine ihrer Vorbedingungen
 *   liess sich aber nicht auswerten (Status am Kettenanfang unbekannt, Kürzel
 *   nicht im Katalog, ungedeutetes Argument). Der Termin steht in den Daten, das
 *   Kürzel WURDE gesetzt — ihm den Wechsel abzusprechen, weil wir eine Bedingung
 *   nicht lesen können, wäre eine Behauptung über die Vergangenheit. Ihn als
 *   bestätigt zu führen wäre die andere.
 * - `zeitliche_naehe` — das Journal belegt einen Wechsel in der Nähe des Termins.
 *   Erst ab dem Journal-Nullpunkt möglich.
 * - `kein_kuerzel` — kein Statuswechsel belegt. Gemessen am Bestand ist das mit
 *   92,7 % der **Normalfall**, nicht die Ausnahme.
 */
export type Konfidenz =
  | 'trigger_bestaetigt' | 'trigger_bedingt' | 'zeitliche_naehe' | 'kein_kuerzel';

/**
 * Warum ein Übergang keine Rolle nennt — `neutral` und `unbekannt` sähen als
 * leeres Array gleich aus, sind aber verschiedene Auskünfte (Pitfall #43).
 *
 * - `benannt` — der Katalog nennt Rollen.
 * - `neutral` — der Katalog sagt ausdrücklich „jeder darf setzen".
 * - `unbekannt` — das Kürzel steht nicht im Katalog, oder die Projektformen
 *   widersprechen sich (`KuerzelAuskunft.eindeutig === false`).
 */
export type RollenLage = 'benannt' | 'neutral' | 'unbekannt';

/**
 * Ein Statuswert samt Beschriftung. `kurz`/`lang` kommen über
 * `statusKurzLabelMit`/`statusLabel` — die eine Quelle (Pitfall #50); die
 * Auflösungsstufe wird mitgeführt, damit das Popover sie benennen kann.
 */
export interface StatusRef {
  /** Wortlaut, wie er im Export bzw. in der Regel steht. */
  roh: string;
  /** Amtlicher Code; `null`, wenn der Text nicht auflösbar war. */
  code: number | null;
  kurz: string;
  lang: string;
  labelHerkunft: LabelHerkunft;
}

/** Ein Statusabschnitt der Bahn. */
export interface VerlaufsSegment {
  /** `null` nur bei {@link VerlaufsSegment.mehrdeutig} — dann stehen die
   *  konkurrierenden Werte in `kandidaten`. */
  statusRef: StatusRef | null;
  /** ISO-Tag. `null` = Anfang unbekannt (vor dem ersten Beleg). */
  vonDatum: string | null;
  /** ISO-Tag. Das letzte Segment endet am Bezugszeitpunkt. */
  bisDatum: string | null;
  /** `null`, wo eine Grenze fehlt. */
  dauerTage: number | null;
  /**
   * Ein Tag oder weniger — bzw. eine offene Grenze. „Stand einen Tag auf X" ist
   * nicht unterscheidbar von „wurde nur durchlaufen".
   */
  dauerUnsicher: boolean;
  /** Mehrere Kürzel am selben Tag mit verschiedenem Zielstatus. */
  mehrdeutig?: true;
  /** Nur bei `mehrdeutig`: die konkurrierenden Werte, unsortiert. */
  kandidaten?: StatusRef[];
}

/** Ein gesetztes Kürzel — der Punkt zwischen zwei Abschnitten. */
export interface VerlaufsUebergang {
  /** Die heutige Form des Kürzels — stabiler Schlüssel für Nachschlag und
   *  Gruppierung. */
  kuerzel: string;
  /** Die Form, wie sie im Export steht — nur gesetzt, wenn sie abweicht.
   *  Angezeigt wird „AAW (heute ARW)", nie stillschweigend ersetzt. */
  kuerzelHistorisch?: string;
  /** ISO-Tag. Tagesgranularität; eine Uhrzeit führt der Export nicht. */
  datum: string;
  /** Leer bei `rollenLage !== 'benannt'` — nie mit einer Vermutung gefüllt. */
  rollen: readonly Rolle[];
  rollenLage: RollenLage;
  konfidenz: Konfidenz;
  /** `null` = der Katalog kennt das Kürzel nicht. */
  bezeichnung: string | null;
  /** `false` = die Projektformen sagen Verschiedenes; dann gilt die Bezeichnung
   *  nicht sicher für diesen Vorgang. */
  bezeichnungEindeutig: boolean;
  /**
   * Aus WELCHER Projektform die Bezeichnung stammt — gesetzt nur, wenn der
   * Katalog die Form des Vorgangs selbst führt.
   *
   * Fehlt sie, ist die Bezeichnung **geliehen**: der Katalog kennt das Kürzel,
   * aber nicht für diese Form, und `kuerzelAuskunft` nimmt die erste geführte
   * (`kuerzel-katalog.ts`, Stufe 3). Für DS ist das der Regelfall — die
   * Projektform kam mit der Richtlinie 2020 und steht in der Zuarbeit nicht.
   * Zusammen mit `bezeichnungEindeutig: false` heisst das: die angezeigte
   * Bedeutung gilt für diesen Vorgang nicht sicher.
   */
  bezeichnungQuelle?: Projektform;
  /** Der Statuswechsel, den die Regel setzt. Fehlt bei `kein_kuerzel`. */
  setztStatus?: StatusRef;
  /**
   * Wie die Vorbedingungen der greifenden C16-Zeile ausgegangen sind. Fehlt,
   * wenn C16 für dieses Kürzel auf dieser Ebene gar keine Zeile führt — „keine
   * Regel" und „Regel, aber Bedingung verletzt" sind zwei Aussagen.
   *
   * Geprüft wird gegen den Stand **am Tag des Kürzels**, nicht gegen heute
   * (`uebergaenge.ts`). Ein `verletzt` heisst deshalb wirklich „die Regel griff
   * damals nicht" — und dann setzt das Kürzel auch keinen Status.
   */
  bedingung?: { urteil: BedingungsUrteil; gruende: string[] };
}

/**
 * Warum Ableitung und Export auseinanderliegen — zwei sehr verschiedene Fälle,
 * und der häufigere ist der harmlose.
 *
 * - `nicht_ableitbar` — **keine** Regel dieser Projektform setzt den
 *   importierten Status. Die Ableitung konnte ihn gar nicht erreichen; sie ist
 *   unvollständig, nicht falsch. Gemessen der Normalfall: `Schlussvermerk` (99)
 *   trägt 48 % des Bestands, und die Zuarbeit führt für ihn keinen auflösbaren
 *   Zielstatus.
 * - `widerspruch` — es gäbe eine Regel, die diesen Status setzt; sie ist an
 *   diesem Vorgang nur nicht belegt. Das ist der Fall, der jemanden interessiert.
 *
 * Ohne diese Unterscheidung stünden beide unter einer Zahl, und die wäre so groß,
 * dass niemand hinsieht.
 */
export type AbweichungsArt = 'nicht_ableitbar' | 'widerspruch';

/** Die Ableitung endet woanders als der Export. Befund, kein Ersatz. */
export interface VerlaufsAbweichung {
  art: AbweichungsArt;
  /** Worauf die Ableitung zuletzt kam; `null`, wenn sie gar nichts sagte. */
  erwartet: StatusRef | null;
  /** Der importierte Wert — er gilt. */
  beobachtet: string;
  /** ISO-Tag, an dem die Abweichung festgestellt wurde (= Bezugszeitpunkt). */
  datum: string;
}

/** Eine Bahn: eine Ebene, ein Vorgang, ein Verlauf. */
export interface VerlaufsSpur {
  art: SpurArt;
  /** Aktenzeichen (`tv`) bzw. Verbund-Id (`verbund`). */
  id: string;
  zustand: SpurZustand;
  herkunft: SpurHerkunft;
  segmente: VerlaufsSegment[];
  uebergaenge: VerlaufsUebergang[];
  /** Klartext, warum der Zustand nicht `verlauf` ist. Nie Schweigen. */
  begruendung?: string;
  /** Termine, die es gibt, die aber keine Bahn tragen (`kein_bearbeitungsstand`). */
  verworfeneTermine?: number;
  /**
   * Nullpunkt des Import-Diff-Journals; `null` = kein Journal geführt. **Gehört
   * an jede Anzeige** — ohne ihn wird eine unvollständige Chronik als
   * vollständige gelesen (§12.2).
   */
  journalAb: string | null;
  abweichung?: VerlaufsAbweichung;
  /** Warum der Kürzel-Nachschlag eindeutig ist (oder nicht). */
  projektform: ProjektformLage;
  /**
   * Fehlt der Bahn die REGELQUELLE (Richtlinie unbekannt oder von C16 nicht
   * geführt)? Nur gesetzt, wenn das der Grund für die fehlende Bahn ist.
   *
   * Bis v3.26 stand die Lage ausschließlich als Klartext in `begruendung`. Eine
   * Bahn muss „für diese Richtlinie gibt es keine Regeln" aber anders zeichnen
   * als „dieser Vorgang trägt keinen Bearbeitungsstand" — beides sind leere
   * Spuren, und beide zu einer grauen Zeile zu verschmelzen wäre der stille
   * Fallback, den das Modul nirgends macht. Prosa dafür zu parsen wäre die
   * schlechtere Kopplung.
   */
  regelLage?: 'programm-unbekannt' | 'programm-ohne-regeln';
}
