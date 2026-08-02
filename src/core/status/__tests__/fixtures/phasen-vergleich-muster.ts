/**
 * Die eingefrorene Muster-Bilanz des Phasen-Vergleichs — **das Abnahme-Kriterium
 * des Rückbaus (P6)**.
 *
 * Der Vergleich stellt die alte, aus Rängen abgeleitete Spine-Phase der neuen,
 * am Status-Code hängenden ZAH-Phase gegenüber. Null Abweichungen ist **nicht**
 * das Ziel und war es nie: die Abweichungen sind die beabsichtigte
 * Verhaltensänderung. Das Kriterium lautet **null UNERKLÄRTE Abweichungen** —
 * jede muss einem der hier geführten Muster zuzuordnen sein.
 *
 * **Die Zählungen sind ein PROTOKOLL, kein Rechenergebnis.** Sie stammen aus
 * einem Diagnose-Lauf über den echten Bestand (siehe {@link BESTAND_STAND}) und
 * werden hier von Hand geführt. Der Golden Test erzeugt aus ihnen einen
 * synthetischen Korpus und zählt nach — er kann damit die **Mechanik** belegen
 * und ein 13. Muster auffliegen lassen, aber nicht die Zahl selbst prüfen. Was
 * er beweist und was nicht, steht im Kopf von `phasen-vergleich-golden.test.ts`.
 *
 * **Abweichende Zählungen bei gleichen Mustern sind kein Befund** — ein neuerer
 * CSV-Stand oder eine andere Katalog-Fassung verschiebt sie. Ein NEUES Muster
 * ist einer und bekommt hier eine Zeile, statt dass eine bestehende überschrieben
 * wird.
 *
 * Lebensdauer: **stirbt mit `ableitung.ts`** (P6 Phase 3). Danach gibt es keine
 * alte Lesart mehr, gegen die verglichen werden könnte; was bleibt, sind
 * `kategorie-ableitung.test.ts` und `byte-identitaet.test.ts`.
 */
import type { SpinePhase, StatusCategory, ZahPhaseId } from '../../typen';

/** Der Messstand, auf den sich die Zählungen beziehen. */
export const BESTAND_STAND = {
  /** Import-Datum des CSV-Bestands. */
  datum: '2026-08-02',
  /** Fassung des Status-Katalogs beim Messen. */
  katalogVersion: 7,
  verbuende: 7534,
  gleich: 7001,
  abweichend: 485,
  /** Marker (43 Irrläufer) + ohne Code (5 „VN gegrüft", Tippfehler im Export). */
  unvergleichbar: 48,
} as const;

/**
 * Warum ein Muster abweicht. Alle drei sind dieselbe Aussage aus verschiedenen
 * Richtungen: **die alte Ableitung lief dem amtlichen Status voraus.**
 */
export type Ursache =
  /** Ein Datum (oder ein TV-Statuswert) mit höherem Rang schlägt den Status. */
  | 'datum-laeuft-status-voraus'
  /** Ein terminales Feld schlägt den Rang — unabhängig davon, wie hoch er ist. */
  | 'terminal-flag-zieht-vor'
  /** Der Statuswert selbst wurde in beiden Achsen verschieden eingeordnet. */
  | 'wert-selbst-anders-eingeordnet';

/**
 * Wie sich das Muster synthetisch herstellen lässt. `null` = gar nicht, der
 * Statuswert allein erzeugt es (dann ist die Ursache
 * `wert-selbst-anders-eingeordnet`).
 */
export interface Treiber {
  /** feldId aus dem Seed-Katalog (roher Spaltenname, z. B. `D_XTEC`). */
  feldId: string;
  /** Auf welcher Ebene das Feld gesetzt wird. */
  ebene: 'verbund' | 'tv';
}

export interface MusterErwartung {
  /** Roher Statuswert, wie er im Export steht. */
  statusRoh: string;
  code: number;
  /** Die neue Lesart. */
  zahPhase: ZahPhaseId;
  /** Die alte, abgeleitete Lesart. */
  spinePhase: SpinePhase;
  /** Vorkommen im Bestand von {@link BESTAND_STAND}. Protokoll, kein Assert. */
  anzahl: number;
  ursache: Ursache;
  treiber: Treiber | null;
  erklaerung: string;
}

/**
 * Die zwölf Muster, absteigend nach Anzahl — die Summe ergibt
 * {@link BESTAND_STAND.abweichend}.
 */
export const ABWEICHUNGS_MUSTER: readonly MusterErwartung[] = [
  {
    statusRoh: 'beantragt', code: 31, zahPhase: 'eingang', spinePhase: 'vollstaendigkeit',
    anzahl: 260, ursache: 'datum-laeuft-status-voraus',
    treiber: { feldId: 'D_XTEC', ebene: 'tv' },
    erklaerung: 'Ein Vollständigkeits-Datum hängt dran, der Status ist noch „beantragt".',
  },
  {
    statusRoh: 'VN geprüft', code: 97, zahPhase: 'begleitung', spinePhase: 'schluss',
    anzahl: 68, ursache: 'terminal-flag-zieht-vor',
    treiber: { feldId: 'D_AAR', ebene: 'tv' },
    erklaerung: 'Ein terminales Abschluss-Feld zog die alte Ableitung auf „Schluss".',
  },
  {
    statusRoh: 'bearbeitungsreif', code: 34, zahPhase: 'vollstaendigkeit', spinePhase: 'fachpruefung',
    anzahl: 53, ursache: 'datum-laeuft-status-voraus',
    treiber: { feldId: 'D_AT4', ebene: 'tv' },
    erklaerung: 'Ein Prüf-Datum steht vor dem Statuswechsel.',
  },
  {
    statusRoh: 'beantragt', code: 31, zahPhase: 'eingang', spinePhase: 'fachpruefung',
    anzahl: 44, ursache: 'datum-laeuft-status-voraus',
    treiber: { feldId: 'D_AT4', ebene: 'tv' },
    erklaerung: 'Wie oben, nur weiter fortgeschritten: Prüfung läuft, Status steht auf „beantragt".',
  },
  {
    statusRoh: 'bewilligt', code: 59, zahPhase: 'begleitung', spinePhase: 'schluss',
    anzahl: 25, ursache: 'terminal-flag-zieht-vor',
    treiber: { feldId: 'D_AAR', ebene: 'tv' },
    erklaerung: 'Terminales Abschluss-Feld.',
  },
  {
    statusRoh: 'bewilligt', code: 59, zahPhase: 'begleitung', spinePhase: 'fachpruefung',
    anzahl: 17, ursache: 'terminal-flag-zieht-vor',
    treiber: { feldId: 'D_ABLZ', ebene: 'tv' },
    erklaerung: 'Terminales Ablehnungs-Feld in der Fachprüfung schlägt den höheren Bewilligungs-Rang.',
  },
  {
    statusRoh: 'ablehnungsreif', code: 32, zahPhase: 'entscheidung', spinePhase: 'schluss',
    anzahl: 8, ursache: 'terminal-flag-zieht-vor',
    treiber: { feldId: 'D_AAR', ebene: 'tv' },
    erklaerung: 'Terminales Abschluss-Feld.',
  },
  {
    statusRoh: 'Anhörung zum Widerruf', code: 89, zahPhase: 'begleitung', spinePhase: 'schluss',
    anzahl: 3, ursache: 'terminal-flag-zieht-vor',
    treiber: { feldId: 'D_AAR', ebene: 'tv' },
    erklaerung: 'Terminales Abschluss-Feld.',
  },
  {
    statusRoh: 'beantragt', code: 31, zahPhase: 'eingang', spinePhase: 'bewilligung',
    anzahl: 2, ursache: 'datum-laeuft-status-voraus',
    treiber: { feldId: 'D_AB', ebene: 'tv' },
    erklaerung: 'Bewilligungs-Datum gesetzt, Verbund-Status steht noch auf „beantragt".',
  },
  {
    statusRoh: 'bearbeitungsreif', code: 34, zahPhase: 'vollstaendigkeit', spinePhase: 'schluss',
    anzahl: 2, ursache: 'terminal-flag-zieht-vor',
    treiber: { feldId: 'D_AAR', ebene: 'tv' },
    erklaerung: 'Terminales Abschluss-Feld.',
  },
  {
    statusRoh: 'NF gestellt', code: 35, zahPhase: 'vollstaendigkeit', spinePhase: 'fachpruefung',
    anzahl: 2, ursache: 'wert-selbst-anders-eingeordnet',
    treiber: null,
    erklaerung:
      'Kein Treiberfeld nötig: die alte Ableitung führt Kategorie `nachforderung` '
      + 'unter „Fachprüfung", die ZAH-Phase des Codes 35 ist „Vollständigkeit". '
      + 'Alle Verbünde mit diesem Statuswert weichen ab.',
  },
  {
    statusRoh: 'VN techn. geprüft', code: 95, zahPhase: 'begleitung', spinePhase: 'schluss',
    anzahl: 1, ursache: 'terminal-flag-zieht-vor',
    treiber: { feldId: 'D_AAR', ebene: 'tv' },
    erklaerung: 'Terminales Abschluss-Feld.',
  },
];

/**
 * Codes, die **strukturell** abweichen: ihr Statuswert allein genügt, kein
 * Treiberfeld nötig. Sichtbar wird das nur bei einem Verbund ohne weitere
 * Signale — im Bestand tragen diese Vorgänge Datumsfelder, die das Ergebnis
 * verschieben, weshalb im Diagnose-Report nur `35` als Muster auftaucht.
 *
 * Alle drei liegen in der ZAH-Phase **Vollständigkeit**, die die alte Achse so
 * nicht kannte: `nachforderung` lief dort unter „Fachprüfung", und `sonstige`
 * (Rang 0) trug gar nicht bei.
 */
export const STRUKTURELLE_ABWEICHUNGEN: readonly { code: number; text: string; grund: string }[] = [
  { code: 33, text: 'unvollständig', grund: 'Kategorie `sonstige` ⇒ Rang 0 ⇒ trug zur alten Phase gar nicht bei.' },
  { code: 35, text: 'NF gestellt', grund: 'Kategorie `nachforderung` lief unter „Fachprüfung".' },
  { code: 37, text: 'keine weiteren NF', grund: 'dito.' },
];

/**
 * Codes, die der Katalog-Seed nicht mit einer ZAH-Phase belegt — sie sind im
 * Phasen-Vergleich `unvergleichbar`, nicht `abweichend`.
 *
 * **Seit v2.383 sind das genau die vier Marker.** Vorher standen hier neun
 * Codes, und das war der Befund, der die Fassaden-Umstellung getragen hat: die
 * handgeschriebene Kategorie-Tabelle in `status-canonical.ts` kannte nur 21 der
 * 30 amtlichen Status-Codes unter ihrem amtlichen Namen. Fünf Lücken waren
 * echte Arbeitszustände:
 *
 * | Code | amtlich | die Handtabelle führte |
 * |---|---|---|
 * | 11 | Skizze eingegangen | — (gar nicht) |
 * | 70 | Ablehnung versandt | „Ablehnung" |
 * | 71 | Rücknahmeempfehlung versandt | „Rücknahmeempfehlung" |
 * | 72 | Stellungnahme zur Rücknahmeempfehlung | „…Rücknahmeempf." |
 * | 95 | VN technisch geprüft | „VN techn. geprüft" |
 *
 * Bei 70, 71 und 95 ging es nur gut, weil der Export zufällig die abgekürzte
 * Schreibweise liefert. Bei **72** ging es schon schief: der Export schreibt aus,
 * die Tabelle kannte nur die Abkürzung — 15 Teilvorhaben und 1 Verbund lagen
 * unter `sonstige`. Seit die Fassade aus dem Code-Katalog gespeist wird, trifft
 * jede dort gepflegte Schreibweise.
 */
export const CODES_OHNE_ZAH_PHASE: readonly number[] = [
  29, // Irrläufer
  88, // Sonderstatus
  93, // assoziierter Partner
  94, // internationaler Partner
];

/**
 * **Die Kategorie-Deltas der Fassaden-Umstellung** — abschließend.
 *
 * Sie gehören hierher, weil sie dieselbe Frage beantworten („was ändert P6?"),
 * tauchen im Phasen-Vergleich aber nicht auf: `vergleichePhasen` misst Phasen,
 * nicht Kategorien. Gemessen werden sie von `kategorie-ableitung.test.ts` —
 * dort ist die Liste **abschließend**, damit ein siebtes Delta auffliegt.
 *
 * `alt` ist, was die handgeschriebene Tabelle in `status-canonical.ts` bis
 * v2.382 lieferte (inklusive ihres VN/ZB-Pattern-Fallbacks).
 */
export interface KategorieDelta {
  statusRoh: string;
  code: number;
  alt: StatusCategory;
  neu: StatusCategory;
  /** Vorkommen im Bestand von {@link BESTAND_STAND}: Teilvorhaben / Verbünde. */
  anzahl: { tv: number; vb: number };
  erklaerung: string;
}

export const KATEGORIE_DELTAS: readonly KategorieDelta[] = [
  {
    statusRoh: 'NL eingegangen', code: 36, alt: 'offen', neu: 'nachforderung',
    anzahl: { tv: 52, vb: 2 },
    erklaerung:
      'Folgt aus der Regel „Phase Vollständigkeit, Codes 35–37 = Nachforderung". '
      + '37 („keine weiteren NF") lag schon vorher dort; 36 zieht nach. Bleibt offen.',
  },
  {
    statusRoh: 'Stellungnahme zur Rücknahmeempfehlung', code: 72,
    alt: 'sonstige', neu: 'entscheidung',
    anzahl: { tv: 15, vb: 1 },
    erklaerung:
      'Die Handtabelle führte nur die ABGEKÜRZTE Schreibweise („…Rücknahmeempf."); '
      + 'der Export schreibt sie aus. 16 Vorgänge fielen deshalb auf `sonstige` und '
      + 'tauchten in keiner Arbeitsliste auf — der einzige der sechs Deltas, der '
      + 'schon vor P6 ein Fehler war.',
  },
  {
    statusRoh: 'unvollständig', code: 33, alt: 'sonstige', neu: 'offen',
    anzahl: { tv: 6, vb: 2 },
    erklaerung:
      'Handtabellen-Fehler, Korrektur beabsichtigt: Code 33 liegt in der Phase '
      + 'Vollständigkeit und ist offene Arbeit. Unter `sonstige` war er in keiner '
      + 'Arbeitsliste sichtbar. NICHT mitkorrigiert wird 29 Irrläufer — der bleibt '
      + 'Marker ohne Phase, und diese Asymmetrie ist gewollt.',
  },
  {
    statusRoh: 'Skizze eingegangen', code: 11, alt: 'sonstige', neu: 'offen',
    anzahl: { tv: 0, vb: 0 },
    erklaerung: 'Stand gar nicht in der Handtabelle. Kommt im Bestand nicht vor.',
  },
  {
    statusRoh: 'Ablehnung versandt', code: 70, alt: 'sonstige', neu: 'entscheidung',
    anzahl: { tv: 0, vb: 0 },
    erklaerung:
      'Die Handtabelle kannte nur die Kurzform „Ablehnung", die der Export heute '
      + 'liefert. Schriebe er den amtlichen Text, fiele er auf `sonstige` — die '
      + 'Lücke war da, nur unsichtbar.',
  },
  {
    statusRoh: 'Rücknahmeempfehlung versandt', code: 71, alt: 'sonstige', neu: 'entscheidung',
    anzahl: { tv: 0, vb: 0 },
    erklaerung: 'Wie 70: die Tabelle kannte nur „Rücknahmeempfehlung".',
  },
];
