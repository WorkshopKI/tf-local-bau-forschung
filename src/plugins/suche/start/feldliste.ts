/**
 * Jedes Feld, das vor dem Doppelpunkt stehen darf — mit seiner Bedeutung, dem
 * Spaltencode der Fördertabelle und einem Beispiel, das man anklicken kann.
 *
 * Die Zweckgruppen darüber ([suchsprache.ts](src/plugins/suche/start/suchsprache.ts))
 * machen vor, WIE man fragt; sie zeigen sechs der dreizehn Felder. Der Rest
 * stand bis v4.134 nur als nackte Aufzählung im Fußsatz — dreizehn Präfixe ohne
 * ihre Bedeutung, aus der man `bl` und `ast` raten musste, und daneben drei
 * Spaltencodes als Prosa. Wer nicht wusste, dass es `deskriptor:` gibt, erfuhr
 * es dort nicht, und wer es las, konnte es nicht ausprobieren.
 *
 * **Abgeleitet, nicht abgeschrieben.** Präfix, Bedeutung und Spaltencode kommen
 * aus den drei vorhandenen Einzelquellen (`FELD_PRAEFIX`, `TREFFERFELD_LABEL`,
 * `FELD_SPALTE`); eine zweite Handtabelle wäre bei jedem neuen Feld eine
 * Fehlerquelle. Von Hand gepflegt wird nur der BEISPIELWERT — er ist das
 * einzige, was man nicht ableiten kann, weil er am Bestand belegt sein muss.
 *
 * Die Beispiele sind deshalb in dev:local an 14.225 Anträgen nachgemessen
 * (Zahlen als Kommentar) und wo möglich ANDERE Werte als in den Zweckgruppen:
 * der Block ist die Vollständigkeit, nicht die Kopie der Lektion.
 *
 * Rein — kein React.
 */
import { FELD_PRAEFIX, FELD_SPALTE } from '@/core/services/search/feldpraefix';
import { TREFFERFELD_LABEL, type Trefferfeld } from '@/core/services/search/trefferstelle';

/**
 * Der Beispielwert je Feld — das einzige von Hand Gepflegte.
 *
 * `web:gmbu` steht bewusst OHNE `.de`: die Suchform der Web-Adresse trägt die
 * Top-Level-Domain nicht (sonst träfe „de" jeden Antrag), `web:gmbu.de` liefert
 * am Bestand 0. Und genau diese Einrichtung ist der Grund, warum es das Feld
 * gibt — „GMBU" steht in keinem Namensfeld, nur in der Domain.
 */
const BEISPIEL_WERT: Partial<Record<Trefferfeld, string>> = {
  titel: 'Wasserstoff',              // 92
  kurzbeschreibung: 'Kreislaufwirtschaft', // 85
  akronym: 'DuraCoat',               // 15
  aktenzeichen: '16KN08',            // 1671
  verbundkennzeichen: 'ZKN0732',     // 80
  organisation: '"EurA AG"',         // 251
  standort: 'Leipzig',               // 450
  bundesland: 'Thüringen',           // 859
  deskriptoren: 'Medizintechnik',    // 843
  domain: 'gmbu',                    // 35
  netzwerk: 'ZEREPRO',               // 81
  wahlkreis: 'Magdeburg',            // 257
  notiz: 'Mittelabruf',              // 38
};

/** Eine Zeile des Blocks „Alle Felder". */
export interface FeldZeile {
  feld: Trefferfeld;
  /** Was die App selbst schreibt (`ast`), nicht die acht Aliasse. */
  praefix: string;
  /** Die Bedeutung, wie sie auch am Trefferstellen-Tag steht. */
  label: string;
  /** Der Spaltencode der Fördertabelle. Fehlt, wo es keine EINE Spalte gibt. */
  spalte?: string;
  /** Die Anfrage, die der Klick ausführt. */
  beispiel: string;
}

/**
 * Die Zeilen in der Reihenfolge von `FELD_PRAEFIX` — worum es geht, dann wer und
 * wo, zuletzt das Eigene. Dieselbe Ordnung, die der Fußsatz bisher aufzählte.
 *
 * Ein Feld ohne Beispielwert fiele hier heraus. Dass das nie passiert, hält der
 * Guard fest (`feldliste.test.ts`) — die Typen können es nicht, weil
 * `FELD_PRAEFIX` als `Partial` deklariert ist und TypeScript seine dreizehn
 * tatsächlichen Schlüssel nicht kennt.
 */
export const FELD_ZEILEN: readonly FeldZeile[] = (
  Object.entries(FELD_PRAEFIX) as [Trefferfeld, string][]
).flatMap(([feld, praefix]) => {
  const wert = BEISPIEL_WERT[feld];
  if (wert === undefined) return [];
  const spalte = FELD_SPALTE[feld];
  return [{
    feld,
    praefix,
    label: TREFFERFELD_LABEL[feld],
    ...(spalte === undefined ? {} : { spalte }),
    beispiel: `${praefix}:${wert}`,
  }];
});
