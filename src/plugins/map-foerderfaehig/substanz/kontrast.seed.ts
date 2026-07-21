/**
 * Kontrast-Fixtures des Substanzchecks — vier FIKTIVE Vorhabensbeschreibungen.
 *
 * Zweck ist die Messung, nicht die Demo: drei Fassungen tragen je genau eine
 * eingebaute Abweichung gegen die Dummy-Einreichung, die vierte ist sauber. Erst
 * beides zusammen ist aussagekräftig — ein Widerspruchscheck, der alles meldet,
 * ist genauso wertlos wie einer, der nichts findet. Die saubere Fassung ist die
 * **Falsch-Positiv-Kontrolle** und der eigentliche Härtetest.
 *
 * Bezugsgrössen aus `__tests__/fixtures/dummy-2025.json` (gescrubbt, fiktiv):
 * Laufzeit 01.06.2025–30.04.2027 = 23 Monate · 16 PM gesamt ·
 * AP1 = 12 PM · AP2 = 4 PM · Gesamtkosten 111.730 € · Zuwendung 50.279 €.
 *
 * Der Text ist bewusst im Duktus einer glattgeschriebenen Vorhabensbeschreibung
 * gehalten (viel Anspruch, wenig Zahl) — genau der Fall, gegen den das Paket
 * gebaut ist. Die Unschärfe-Begriffe sind darum in ALLEN vier Fassungen gleich
 * enthalten, auch in der sauberen: unscharf zu schreiben ist kein Widerspruch.
 *
 * Reine Daten. Kein Echtfall, keine Personen, keine realen Firmen.
 */

import type { MapStufe } from '../checkliste/typen';
import type { MapEinreichung } from '../types';

export type KontrastId = 'sauber' | 'pm-abweichung' | 'laufzeit-abweichung' | 'ap-erfunden';

/**
 * Faktenseite der Kontrast-Fixtures — zahlengleich zur Dummy-Einreichung, aber
 * hier als gebündeltes Objekt statt aus `__tests__/fixtures/`.
 *
 * Grund: das Smoke-Panel läuft in der App, Test-Fixtures werden nicht gebündelt.
 * Der Fakten-Block entsteht daraus über dasselbe `baueFaktenBlock` wie im
 * Produktivpfad — so misst der Smoke den echten Prompt und nicht eine
 * nachgebaute Fassung, die auseinanderdriften könnte.
 */
export const KONTRAST_EINREICHUNG: MapEinreichung = {
  version: 1,
  id: 'kontrast-fiktiv',
  schemaId: 'zim-2025',
  importiertAm: '2026-01-01T00:00:00.000Z',
  importiertVon: null,
  dateiname: 'kontrast-fiktiv.json',
  quellHash: 'kontrast',
  stamm: {
    titel: 'Akustische Früherkennung von Lagerschäden',
    akronym: 'AKUFRUEH',
    kurzfassung: null,
  },
  laufzeit: { start: '2025-06-01', ende: '2027-04-30', monate: 23 },
  arbeitspakete: [
    { laufnummer: 1, name: 'AP1', start: '2025-08-01', ende: '2026-01-31', aufwandPm: 12, quellIndex: 0 },
    { laufnummer: 2, name: 'AP2', start: '2026-02-02', ende: '2026-05-01', aufwandPm: 4, quellIndex: 1 },
  ],
  // Leer: die Einsatzplanung trägt personenbezogene Felder und wird vom
  // Fakten-Block ohnehin nicht gelesen — sie hier zu füllen hiesse, fiktive
  // Personendaten zu erfinden, die niemand braucht.
  einsatzplanung: [],
  summen: { personenmonateEinsatz: 16, arbeitsaufwandAp: 16, nnAnteil: null },
  kosten: {
    personal: 69718, dritte: 5012, fue: 7000, temp: 5000, uebrige: 25000,
    gesamt: 111730, beantragteZuwendung: 50279, foerdersatz: 0.45, foerdersatzQuelle: '0.45',
  },
  antragsteller: { kurzprofil: null },
  merkmale: { patentsituation: [], technologieneuerung: [] },
  anlagen: [],
};

/**
 * Erwartete Einstufung der drei Skala-Items — eine **Kurator-Einschätzung, keine
 * Wahrheit**. Sie geht in kein Pass/Fail ein, der Smoke zeigt nur den Abstand.
 *
 * Für alle vier Fassungen bewusst identisch: die Manipulationen betreffen den
 * Arbeitsplan, nicht den Innovationsgehalt. Damit misst der Abgleich zugleich die
 * STABILITÄT der Einstufung — streut das Modell über vier fast gleiche Texte, ist
 * die Zweitmeinung nicht belastbar, und das soll sichtbar werden dürfen.
 *
 * B1 begründet sich aus dem Duktus des Fixture-Texts: viel Anspruch, kaum Zahl —
 * „Verbesserungen vorwiegend qualitativ beschrieben" ist der B1-Ankertext.
 */
const GOLD_B1: Readonly<Record<string, MapStufe>> = {
  'inno.zielstellung': 'B1',
  'inno.loesungsansatz': 'B1',
  'inno.risiken': 'B1',
};

export interface KontrastFixture {
  id: KontrastId;
  label: string;
  /** Was manipuliert wurde — erscheint im Smoke-Report als Sollwert. */
  manipulation: string;
  /** Erwartete Anzahl Widersprüche. */
  erwarteteWidersprueche: number;
  /** Erwartete Art des Widerspruchs; `null` bei der sauberen Fassung. */
  erwarteteArt: 'zahl' | 'zeitraum' | 'bezeichnung' | null;
  /** Optionale Gold-Werte der Zweitmeinung — informativ, siehe `GOLD_B1`. */
  goldZweitmeinung?: Readonly<Record<string, MapStufe>>;
  markdown: string;
}

/** Gemeinsamer Rumpf; die Fassungen unterscheiden sich nur im Abschnitt 3. */
function baueVb(arbeitsplan: string): string {
  return `# Vorhabensbeschreibung

## 1 Ausgangslage und Stand der Technik

Die akustische Zustandsüberwachung von Pumpenaggregaten erfolgt heute überwiegend
manuell. Marktübliche Systeme arbeiten mit festen Schwellwerten und erreichen dabei
nur eine unbefriedigende Trennschärfe. Der Stand der Technik lässt hier deutliche
Effizienzsteigerungen zu, die bislang niemand gehoben hat.

## 2 Ziel des Vorhabens

Ziel ist ein innovativer Ansatz zur körperschallbasierten Früherkennung von
Lagerschäden. Das Verfahren soll die Fehlalarmquote spürbar senken und die
Standzeiten der Aggregate signifikant verlängern. Gegenüber bestehenden Lösungen
wird eine wesentlich robustere Erkennung angestrebt.

${arbeitsplan}

## 4 Technische Risiken

Es bestehen die üblichen Risiken eines Entwicklungsvorhabens. Die Verfügbarkeit
geeigneter Trainingsdaten ist zeitkritisch; hier wird mit vertretbarem Aufwand
gegengesteuert. Ein Restrisiko verbleibt bei der Übertragbarkeit auf andere
Baugrössen.

## 5 Kosten und Finanzierung

Die Gesamtkosten des Vorhabens belaufen sich auf 111.730 €. Beantragt wird eine
Zuwendung von 50.279 €, entsprechend einem Fördersatz von 45 %.

## 6 Verwertung

Die Verwertung erfolgt über den Vertrieb eines Nachrüstsatzes. Es wird mit einer
deutlichen Umsatzsteigerung ab dem zweiten Jahr nach Projektende gerechnet. Der
adressierte Markt gilt als hinreichend gross.
`;
}

const AP_SAUBER = `## 3 Arbeitsplan

Das Vorhaben gliedert sich in zwei Arbeitspakete und läuft über 23 Monate. AP1
umfasst die Datenerhebung und Merkmalsextraktion mit einem Aufwand von 12
Personenmonaten. AP2 umfasst die Validierung im Feldversuch mit 4 Personenmonaten.
Insgesamt werden 16 Personenmonate eingesetzt.`;

const AP_PM = `## 3 Arbeitsplan

Das Vorhaben gliedert sich in zwei Arbeitspakete und läuft über 23 Monate. AP1
umfasst die Datenerhebung und Merkmalsextraktion mit einem Aufwand von 12
Personenmonaten. AP2 umfasst die Validierung im Feldversuch mit 4 Personenmonaten.
Insgesamt werden 18 Personenmonate eingesetzt.`;

const AP_LAUFZEIT = `## 3 Arbeitsplan

Das Vorhaben gliedert sich in zwei Arbeitspakete und läuft über 30 Monate. AP1
umfasst die Datenerhebung und Merkmalsextraktion mit einem Aufwand von 12
Personenmonaten. AP2 umfasst die Validierung im Feldversuch mit 4 Personenmonaten.
Insgesamt werden 16 Personenmonate eingesetzt.`;

const AP_ERFUNDEN = `## 3 Arbeitsplan

Das Vorhaben gliedert sich in drei Arbeitspakete und läuft über 23 Monate. AP1
umfasst die Datenerhebung und Merkmalsextraktion mit einem Aufwand von 12
Personenmonaten. AP2 umfasst die Validierung im Feldversuch mit 4 Personenmonaten.
AP3 „Zertifizierungsvorbereitung" begleitet die Normungsarbeit. Insgesamt werden
16 Personenmonate eingesetzt.`;

export const KONTRAST_FIXTURES: readonly KontrastFixture[] = [
  {
    id: 'sauber',
    label: 'Saubere Fassung',
    manipulation: 'keine — Falsch-Positiv-Kontrolle',
    erwarteteWidersprueche: 0,
    erwarteteArt: null,
    goldZweitmeinung: GOLD_B1,
    markdown: baueVb(AP_SAUBER),
  },
  {
    id: 'pm-abweichung',
    label: 'Personenmonate weichen ab',
    manipulation: 'Text nennt 18 PM, Einreichung führt 16 PM',
    erwarteteWidersprueche: 1,
    erwarteteArt: 'zahl',
    goldZweitmeinung: GOLD_B1,
    markdown: baueVb(AP_PM),
  },
  {
    id: 'laufzeit-abweichung',
    label: 'Laufzeit weicht ab',
    manipulation: 'Text nennt 30 Monate, Einreichung führt 23 Monate',
    erwarteteWidersprueche: 1,
    erwarteteArt: 'zeitraum',
    goldZweitmeinung: GOLD_B1,
    markdown: baueVb(AP_LAUFZEIT),
  },
  {
    id: 'ap-erfunden',
    label: 'Arbeitspaket ohne Entsprechung',
    manipulation: 'Text nennt AP3, Einreichung führt nur AP1 und AP2',
    erwarteteWidersprueche: 1,
    erwarteteArt: 'bezeichnung',
    goldZweitmeinung: GOLD_B1,
    markdown: baueVb(AP_ERFUNDEN),
  },
];
