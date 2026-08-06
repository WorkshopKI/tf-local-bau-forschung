/**
 * Kategorie-Quickfilter: Single-Select-Wrapper um den `system-vb-phase`-Filter.
 *
 * Mappt die fachlichen ZIM-Kategorien (FuE / DS / DL / NW) aus dem Design-
 * Handoff auf das bestehende CSV-Feld [vb_phase](src/core/utils/vb-phase-mappings.ts):
 *
 * | Kategorie | vb_phase-Werte |
 * |-----------|----------------|
 * | FuE       | 3              |
 * | DS        | 5              |
 * | DL        | 4              |
 * | NW        | 1, 2           |
 * | Alle      | (Filter leeren)|
 *
 * Irrläufer (vb_phase = 9) sind keinem Kategorie-Bucket zugeordnet und werden
 * bewusst nicht über die Kategorie-Achse sichtbar gemacht — wenn nötig hat der
 * User dafür den vollen vb_phase-Filter in der Sidebar.
 *
 * Counts gehen über die gesamte Liste, nicht über die aktuell gefilterte
 * Teilmenge — gleiche Stabilitäts-Regel wie beim Phase-Filter.
 */
import type { ActiveFilter } from '@/core/services/csv';
import type { AntragListItem } from '@/core/services/csv/types';
import { getAntragstypBucket, type AntragstypBucket } from '@/core/utils/vb-phase-mappings';
import type { CollapsibleSegItem } from './CollapsibleSeg';

export const KATEGORIE_FILTER_ID = 'system-vb-phase';

/** Die vier Antragstypen plus die „Alle"-Option des Quickfilters. Die
 *  vb_phase-Zuordnung selbst lebt in `vb-phase-mappings.ts`. */
export type KategorieLabel = 'Alle' | AntragstypBucket;

const KATEGORIE_VALUES: Record<Exclude<KategorieLabel, 'Alle'>, string[]> = {
  FuE: ['3'],
  DS: ['5'],
  DL: ['4'],
  NW: ['1', '2'],
};

const KATEGORIE_ORDER: KategorieLabel[] = ['Alle', 'FuE', 'DS', 'DL', 'NW'];

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** Liest die aktuelle Kategorie aus dem aktiven Filter-Set. Wenn der vb_phase-
 *  Filter nicht exakt einem Kategorie-Bucket entspricht (z.B. weil der User in
 *  der Sidebar manuell Phasen kombiniert hat), wird 'Alle' returned — der
 *  Quickfilter zeigt dann seinen Default-Zustand. Die Sidebar bleibt davon
 *  unberührt. */
export function getKategorieFromActive(active: ActiveFilter[]): KategorieLabel {
  const entry = active.find(a => a.filterId === KATEGORIE_FILTER_ID);
  if (!entry) return 'Alle';
  if (!Array.isArray(entry.value)) return 'Alle';
  const activeSet = new Set<string>();
  for (const v of entry.value) {
    if (typeof v === 'string') activeSet.add(v);
  }
  for (const [label, values] of Object.entries(KATEGORIE_VALUES) as [
    Exclude<KategorieLabel, 'Alle'>,
    string[],
  ][]) {
    if (setsEqual(activeSet, new Set(values))) return label;
  }
  return 'Alle';
}

/** Bucket-Label für eine vb_phase (FuE/DS/DL/NW). Liefert null für
 *  Irrläufer (9), leere/unbekannte Werte, oder reservierte Phasen (6–8).
 *  Dünne Schale um `getAntragstypBucket` — die Zuordnung lebt genau dort. */
export function getKategorieLabel(vbPhase: unknown): AntragstypBucket | null {
  return getAntragstypBucket(vbPhase);
}

/**
 * Fällt der Antrag in die gewählte Kategorie? `'Alle'` matcht immer.
 *
 * Für Anzeige-Kaskaden gedacht (die Projektart-Zähler zählen nur noch innerhalb
 * des gewählten Antragstyps), NICHT als Ersatz für den echten Filter: der läuft
 * weiterhin über die Filter-Engine (`applyKategorie` → `system-vb-phase`), damit
 * es nicht zwei Wege gibt, dieselbe Menge zu bilden.
 */
export function matchesKategorie(a: AntragListItem, kategorie: KategorieLabel): boolean {
  if (kategorie === 'Alle') return true;
  return getAntragstypBucket(a.vb_phase) === kategorie;
}

/** Liefert die Items für `CollapsibleSeg`: Alle + 4 Kategorien mit Counts. */
export function getKategorieItems(antraege: AntragListItem[]): CollapsibleSegItem[] {
  const counts: Record<KategorieLabel, number> = {
    Alle: antraege.length,
    FuE: 0,
    DS: 0,
    DL: 0,
    NW: 0,
  };
  for (const a of antraege) {
    const bucket = getAntragstypBucket(a.vb_phase);
    if (bucket === null) continue;
    counts[bucket]++;
  }
  return KATEGORIE_ORDER.map(label => ({ label, count: counts[label] }));
}

/** Wendet die User-Auswahl auf den Filter-State an. */
export function applyKategorie(
  kategorie: KategorieLabel,
  setActiveValue: (filterId: string, value: string[]) => void,
  clearFilter: (filterId: string) => void,
): void {
  if (kategorie === 'Alle') {
    clearFilter(KATEGORIE_FILTER_ID);
    return;
  }
  const values = KATEGORIE_VALUES[kategorie];
  setActiveValue(KATEGORIE_FILTER_ID, values);
}
