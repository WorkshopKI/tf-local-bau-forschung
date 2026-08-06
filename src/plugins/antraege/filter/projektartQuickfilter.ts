/**
 * Projektart-Quickfilter: Einzelprojekt vs. Kooperationsprojekt, mit dem
 * Netzwerkbezug (16KN/16EP) als Unterstufen des Einzelprojekts.
 *
 * Die Unterscheidung gibt es fachlich längst — die Antrag-Aufbereitung
 * beschriftet einen Verbund mit ≥2 TV als „ZIM-Kooperationsprojekt" und den
 * 1-TV-Fall als „ZIM-Einzelprojekt". Filterbar war sie bisher nicht.
 *
 * **Abgeleitete Klassifikation, deshalb eigener Pipeline-Schritt.** Wie der
 * PreCheck-Quickfilter läuft dieser Filter client-seitig in
 * `useFilteredAntraege` über einen Store-Slot — **nicht** über
 * `useFilterState.active`. Er erzeugt damit **keinen** Filter-Chip
 * (Design-Vorgabe: Quickfilter-Segmente = keine Chips). Über die generische
 * Filter-Engine ginge es ohnehin nicht: deren `buildPredicate` macht aus einem
 * Feld, das nicht in der Slim-Projektion steht, still ein `() => true`.
 *
 * **Die TV-Zahl kommt von außen** (`TvCountOf`), und zwar aus `verbundById` —
 * also filter-UNABHÄNGIG. Zöge man sie aus den bereits gefilterten Zeilen
 * (`VerbundRowMeta.tvCount`, `AntragGroup.tvs.length`), machte ein Statusfilter,
 * der ein TV eines 2-TV-Verbunds ausblendet, daraus ein „Einzelprojekt".
 *
 * **Die Stufen partitionieren die Liste NICHT** — anders als beim PreCheck:
 * `mit`/`ohne Netzwerkbezug` liegen INNERHALB von `Einzelprojekt`, und DL/NW
 * fallen in gar keine Stufe. Deshalb zählt `getProjektartItems` jede Stufe über
 * dieselbe `matchesProjektart`-Funktion, die auch filtert: Zähler und Filter
 * dürfen nie aus zwei Vokabularen stammen.
 */
import type { AntragListItem } from '@/core/services/csv/types';
import { getAntragstypBucket } from '@/core/utils/vb-phase-mappings';
import { extractNetzwerkId, istEinzelFkz } from '../netzwerk';
import type { CollapsibleSegItem } from './CollapsibleSeg';

/** Sichtbare Stufe der Projektart-Pille. */
export type Projektart = 'alle' | 'einzel' | 'einzel_mit_nb' | 'einzel_ohne_nb' | 'kooperation';

/** Anzeige-/Iterations-Reihenfolge. */
export const PROJEKTART_ORDER: readonly Projektart[] = [
  'alle', 'einzel', 'einzel_mit_nb', 'einzel_ohne_nb', 'kooperation',
];

/** Beschriftung getrennt vom Schlüssel — der Store hält den Schlüssel, damit
 *  eine spätere Umbenennung keine gespeicherte Auswahl entwertet. */
export const PROJEKTART_LABELS: Record<Projektart, string> = {
  alle: 'Alle',
  einzel: 'Einzelprojekt',
  einzel_mit_nb: 'mit NW Bezug',
  einzel_ohne_nb: 'ohne NW Bezug',
  kooperation: 'Kooperationsprojekt',
};

/** Beschriftung im Einzelprojekt-Menü. Nur wo sie vom Segment-Label abweicht —
 *  im Menü steht der Oberpunkt für „ohne Einschränkung", und „Einzelprojekt"
 *  hieße dort dasselbe wie der Knopf, unter dem das Menü hängt. */
export const PROJEKTART_MENU_LABELS: Partial<Record<Projektart, string>> = {
  einzel: 'alle Einzelprojekte',
};

/** Die Regel im Klartext — als Tooltip am Knopf, damit die Zahl erklärbar ist. */
export const PROJEKTART_TITEL: Record<Projektart, string> = {
  alle: 'Alle Anträge, ohne Einschränkung auf die Projektart',
  einzel: 'FuE- oder DS-Antrag, dessen Verbund genau ein Teilvorhaben hat',
  einzel_mit_nb:
    'Einzelprojekt mit Netzwerkbezug (FKZ beginnt mit 16KN). '
    + 'Mit + ohne ergibt WENIGER als alle Einzelprojekte: ein DS-Einzelprojekt trägt 16DS und damit keines der beiden Präfixe.',
  einzel_ohne_nb:
    'Einzelprojekt ohne Netzwerkbezug (FKZ beginnt mit 16EP). '
    + 'Mit + ohne ergibt WENIGER als alle Einzelprojekte: ein DS-Einzelprojekt trägt 16DS und damit keines der beiden Präfixe.',
  kooperation: 'FuE- oder DS-Antrag, dessen Verbund mehr als ein Teilvorhaben hat',
};

/** Die Stufen, die im Einzelprojekt-Menü hängen (Reihenfolge = Anzeige). */
export const EINZEL_UNTERPUNKTE: readonly Projektart[] = [
  'einzel', 'einzel_mit_nb', 'einzel_ohne_nb',
];

/** Gehört die Stufe unter „Einzelprojekt"? */
export function istEinzelStufe(art: Projektart): boolean {
  return EINZEL_UNTERPUNKTE.includes(art);
}

/** Teilvorhaben-Zahl des Verbunds eines Antrags. Injiziert, damit dieses Modul
 *  rein bleibt und ohne Store testbar ist. */
export type TvCountOf = (a: AntragListItem) => number;

/** FuE oder DS — die beiden Typen, für die die Projektart überhaupt gilt. */
function istFueOderDs(a: AntragListItem): boolean {
  const bucket = getAntragstypBucket(a.vb_phase);
  return bucket === 'FuE' || bucket === 'DS';
}

/** Einzelprojekt: FuE/DS mit genau einem Teilvorhaben. Ein Antrag ohne
 *  Verbund-Zuordnung hat faktisch eines — sich selbst (siehe `tvCountOf`). */
function istEinzelprojekt(a: AntragListItem, tvCount: number): boolean {
  return istFueOderDs(a) && tvCount <= 1;
}

/** Fällt der Antrag in die gewählte Stufe? `'alle'` matcht immer. */
export function matchesProjektart(a: AntragListItem, art: Projektart, tvCount: number): boolean {
  switch (art) {
    case 'alle':
      return true;
    case 'einzel':
      return istEinzelprojekt(a, tvCount);
    case 'einzel_mit_nb':
      return istEinzelprojekt(a, tvCount) && extractNetzwerkId(a.aktenzeichen) !== null;
    case 'einzel_ohne_nb':
      return istEinzelprojekt(a, tvCount) && istEinzelFkz(a.aktenzeichen);
    case 'kooperation':
      return istFueOderDs(a) && tvCount >= 2;
  }
}

/** Reiner Filter-Schritt für die Antrags-Pipeline. */
export function applyProjektart(
  list: AntragListItem[], art: Projektart, tvCountOf: TvCountOf,
): AntragListItem[] {
  if (art === 'alle') return list;
  return list.filter(a => matchesProjektart(a, art, tvCountOf(a)));
}

/**
 * Items für die `CollapsibleSeg`, gezählt über die (Kürzel-gefilterte, stabile)
 * `countBase` — gleiche Stabilitäts-Regel wie Status/Antragstyp/PreCheck.
 *
 * Jede Stufe läuft durch `matchesProjektart`; ein zweiter Zählweg könnte von der
 * Filterwirkung abweichen, ohne dass es jemand merkt.
 */
export function zaehleProjektarten(
  countBase: AntragListItem[], tvCountOf: TvCountOf,
): Map<Projektart, number> {
  const counts = new Map<Projektart, number>(PROJEKTART_ORDER.map(a => [a, 0]));
  for (const a of countBase) {
    const tv = tvCountOf(a);
    for (const art of PROJEKTART_ORDER) {
      if (matchesProjektart(a, art, tv)) counts.set(art, counts.get(art)! + 1);
    }
  }
  return counts;
}

/**
 * Drei Segmente — `Alle · Einzelprojekt ⌄ · Kooperationsprojekt`. Die beiden
 * Netzwerkbezug-Stufen hängen als **Menü** unter „Einzelprojekt", statt als
 * eigene Segmente daneben zu stehen.
 *
 * Grund ist nicht nur die Breite: nebeneinander lasen sich die drei Zahlen wie
 * eine Aufteilung (397 = 38 + 192), und das stimmt nicht — ein DS-Einzelprojekt
 * trägt weder 16KN noch 16EP. Im Menü ist die Verschachtelung sichtbar, und der
 * Tooltip nennt den Rest.
 */
export function getProjektartItems(
  countBase: AntragListItem[], tvCountOf: TvCountOf,
): CollapsibleSegItem[] {
  const counts = zaehleProjektarten(countBase, tvCountOf);
  const item = (art: Projektart): CollapsibleSegItem => ({
    label: PROJEKTART_LABELS[art],
    count: counts.get(art) ?? 0,
    title: PROJEKTART_TITEL[art],
    ...(PROJEKTART_MENU_LABELS[art] ? { menuLabel: PROJEKTART_MENU_LABELS[art] } : {}),
  });
  return [
    item('alle'),
    { ...item('einzel'), unterpunkte: EINZEL_UNTERPUNKTE.map(item) },
    item('kooperation'),
  ];
}

/** Label (das, was `CollapsibleSeg` meldet) → Stufe. Unbekanntes → `'alle'`. */
export function projektartVonLabel(label: string): Projektart {
  return PROJEKTART_ORDER.find(a => PROJEKTART_LABELS[a] === label) ?? 'alle';
}

/** Schmales, validierendes Parse einer Stufe (für Store-Setter/-Laden). */
export function asProjektart(v: unknown): Projektart {
  return PROJEKTART_ORDER.find(a => a === v) ?? 'alle';
}
