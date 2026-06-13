/**
 * Sortier-Optionen fuer die Zuweisungs-Worklist (Tab „Anträge zuweisen").
 *
 * Reine Comparatoren + Labels, getrennt von der grossen ZuweisungsCockpit.tsx
 * gehalten (testbar, kein React). Spiegelt das Muster der Foerderantraege-
 * Sortierung (src/plugins/antraege/sort.ts): Richtung ist im Key codiert,
 * die UI matcht ueber das Label-String (CollapsibleSeg).
 *
 * Sortiert wird IMMER nach dem Filtern, auf der bereits gefilterten Liste.
 */
import type { VerbundZuweisungRow } from '../verbund/verbund-aggregation';

export type ZuweisungSortKey =
  | 'akronym_asc'
  | 'fkz_asc'
  | 'titel_asc'
  | 'antragsdatum_desc'
  | 'antragsdatum_asc'
  | 'kategorie_asc'
  | 'sicherheit_asc'
  | 'sicherheit_desc';

/** Voreinstellung beim Oeffnen des Tabs (ersetzt die zufaellige Pool-Reihenfolge). */
export const DEFAULT_ZUWEISUNG_SORT: ZuweisungSortKey = 'akronym_asc';

/** Anzeige-Labels — muessen exakt den `CollapsibleSegItem.label`-Strings entsprechen. */
export const ZUWEISUNG_SORT_LABELS: Record<ZuweisungSortKey, string> = {
  akronym_asc: 'Akronym (A→Z)',
  fkz_asc: 'FKZ (A→Z)',
  titel_asc: 'Verbundtitel (A→Z)',
  antragsdatum_desc: 'Antragsdatum (Neu→Alt)',
  antragsdatum_asc: 'Antragsdatum (Alt→Neu)',
  kategorie_asc: 'Kategorie',
  sicherheit_asc: 'Sicherheit (niedrig→hoch)',
  sicherheit_desc: 'Sicherheit (hoch→niedrig)',
};

export interface ZuweisungSortOption {
  key: ZuweisungSortKey;
  label: string;
  compare: (a: VerbundZuweisungRow, b: VerbundZuweisungRow) => number;
}

/** Numerischer Sicherheits-Wert hinter dem ConfidenceDot (0..1; fehlend → -1
 *  sortiert ganz nach unten/oben). Feiner als die 3 Punkt-Farben. */
function sicherheitValue(row: VerbundZuweisungRow): number {
  return row.klassifizierung.vorgeschlagenePrimaer?.confidence ?? -1;
}

/** Deterministischer Tiebreak ueber das Lead-Förderkennzeichen. */
function fkzCompare(a: VerbundZuweisungRow, b: VerbundZuweisungRow): number {
  return a.leadAktenzeichen.localeCompare(b.leadAktenzeichen, 'de');
}

/** A→Z mit leeren Werten ans Ende (sonst stuenden Verbunde ohne Akronym/Titel
 *  ganz oben) und FKZ-Tiebreak. */
function textCompareEmptyLast(av: string, bv: string): number {
  const a = av.trim();
  const b = bv.trim();
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, 'de');
}

/** Antragsdatum absteigend (neueste zuerst, ISO-Vergleich), leere ans Ende. */
function dateCompareNewestFirst(a: VerbundZuweisungRow, b: VerbundZuweisungRow): number {
  const av = a.antragsdatum.trim();
  const bv = b.antragsdatum.trim();
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return bv.localeCompare(av, 'de'); // absteigend
}

/** Antragsdatum aufsteigend (älteste zuerst, ISO-Vergleich), leere ebenfalls ans Ende. */
function dateCompareOldestFirst(a: VerbundZuweisungRow, b: VerbundZuweisungRow): number {
  const av = a.antragsdatum.trim();
  const bv = b.antragsdatum.trim();
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return av.localeCompare(bv, 'de'); // aufsteigend
}

/**
 * Baut die Sort-Optionen. `kategorieRank` = Kategorie-ID → Index aus
 * `config.ueberKategorien`, damit „Kategorie" in der konfigurierten Reihenfolge
 * gruppiert (unbekannte IDs ans Ende). Pure — testbar.
 */
export function buildZuweisungSortOptions(
  kategorieRank: ReadonlyMap<string, number>,
): ZuweisungSortOption[] {
  const katRank = (row: VerbundZuweisungRow): number =>
    kategorieRank.get(row.klassifizierung.freigegebenePrimaer) ?? Number.MAX_SAFE_INTEGER;

  return [
    {
      key: 'akronym_asc',
      label: ZUWEISUNG_SORT_LABELS.akronym_asc,
      compare: (a, b) => textCompareEmptyLast(a.akronym, b.akronym) || fkzCompare(a, b),
    },
    {
      key: 'fkz_asc',
      label: ZUWEISUNG_SORT_LABELS.fkz_asc,
      compare: fkzCompare,
    },
    {
      key: 'titel_asc',
      label: ZUWEISUNG_SORT_LABELS.titel_asc,
      compare: (a, b) => textCompareEmptyLast(a.verbundTitel, b.verbundTitel) || fkzCompare(a, b),
    },
    {
      key: 'antragsdatum_desc',
      label: ZUWEISUNG_SORT_LABELS.antragsdatum_desc,
      compare: (a, b) => dateCompareNewestFirst(a, b) || fkzCompare(a, b),
    },
    {
      key: 'antragsdatum_asc',
      label: ZUWEISUNG_SORT_LABELS.antragsdatum_asc,
      compare: (a, b) => dateCompareOldestFirst(a, b) || fkzCompare(a, b),
    },
    {
      key: 'kategorie_asc',
      label: ZUWEISUNG_SORT_LABELS.kategorie_asc,
      compare: (a, b) => (katRank(a) - katRank(b)) || fkzCompare(a, b),
    },
    {
      key: 'sicherheit_asc',
      label: ZUWEISUNG_SORT_LABELS.sicherheit_asc,
      compare: (a, b) => (sicherheitValue(a) - sicherheitValue(b)) || fkzCompare(a, b),
    },
    {
      key: 'sicherheit_desc',
      label: ZUWEISUNG_SORT_LABELS.sicherheit_desc,
      compare: (a, b) => (sicherheitValue(b) - sicherheitValue(a)) || fkzCompare(a, b),
    },
  ];
}

// ─── Kompakte Sortier-Chips (UI: Segmented-Control mit Pfeil-Toggle) ──────
// „Antragsdatum" und „Sicherheit" sind je EIN umschaltbarer Chip: der Pfeil
// zeigt die aktive Richtung, jeder Klick auf den aktiven Chip dreht sie.
// Konvention: erster Klick auf eine umschaltbare Dimension = ↓ = absteigend
// (Antragsdatum ↓ = neueste zuerst; Sicherheit ↓ = höchste zuerst). Die vier
// übrigen Dimensionen haben nur eine Richtung. Reine Helfer, kein React — testbar.

/** Kompakte Label-Anzeige im Segmented-Control (Pfeile nur bei umschaltbaren
 *  Dimensionen). Müssen paarweise eindeutig sein (Reverse-Lookup im Klick-Handler). */
export const SORT_CHIP_DISPLAY: Record<ZuweisungSortKey, string> = {
  akronym_asc: 'Akronym (A→Z)',
  fkz_asc: 'FKZ (A→Z)',
  titel_asc: 'Verbundtitel (A→Z)',
  antragsdatum_desc: 'Antragsdatum ↓',
  antragsdatum_asc: 'Antragsdatum ↑',
  kategorie_asc: 'Kategorie',
  sicherheit_desc: 'Sicherheit ↓',
  sicherheit_asc: 'Sicherheit ↑',
};

/** Anzeige-Reihenfolge der 6 Chips; je Dimension der Default-Key (erster Klick = ↓). */
const CHIP_ORDER: ZuweisungSortKey[] = [
  'akronym_asc',
  'fkz_asc',
  'titel_asc',
  'antragsdatum_desc',
  'kategorie_asc',
  'sicherheit_desc',
];

/** Umschaltbare Dimensionen: Key → Gegenrichtung. Nicht gelistet = nicht umschaltbar. */
const TOGGLE_PARTNER: Partial<Record<ZuweisungSortKey, ZuweisungSortKey>> = {
  antragsdatum_desc: 'antragsdatum_asc',
  antragsdatum_asc: 'antragsdatum_desc',
  sicherheit_desc: 'sicherheit_asc',
  sicherheit_asc: 'sicherheit_desc',
};

export interface ZuweisungSortChip {
  /** Key, den ein Klick auf diesen Chip setzt (bzw. der gerade aktiv ist). */
  key: ZuweisungSortKey;
  /** Kompaktes Anzeige-Label (mit Richtungs-Pfeil bei umschaltbaren). */
  label: string;
  /** Tooltip (nur umschaltbare): ausführliches Richtungs-Label + Toggle-Hinweis. */
  title?: string;
}

/** Reverse-Lookup Anzeige-Label → Key (alle Labels eindeutig). Modul-konstant. */
const KEY_BY_DISPLAY: ReadonlyMap<string, ZuweisungSortKey> = new Map(
  (Object.entries(SORT_CHIP_DISPLAY) as [ZuweisungSortKey, string][]).map(([k, v]) => [v, k]),
);

/** Aktive Dimension == Base-Key oder dessen Toggle-Partner. */
function isActiveDimension(baseKey: ZuweisungSortKey, current: ZuweisungSortKey): boolean {
  return current === baseKey || TOGGLE_PARTNER[baseKey] === current;
}

/**
 * Baut die 6 Chips für die aktuelle Sortierung. Bei der aktiven umschaltbaren
 * Dimension spiegelt der Chip die aktive Richtung (`current`), sonst die
 * Default-Richtung (Base-Key). Pure — testbar.
 */
export function buildSortChips(current: ZuweisungSortKey): ZuweisungSortChip[] {
  return CHIP_ORDER.map(baseKey => {
    const key = isActiveDimension(baseKey, current) ? current : baseKey;
    const umschaltbar = TOGGLE_PARTNER[key] !== undefined;
    return {
      key,
      label: SORT_CHIP_DISPLAY[key],
      title: umschaltbar ? `${ZUWEISUNG_SORT_LABELS[key]} · Klick dreht die Richtung` : undefined,
    };
  });
}

/** Aktives Chip-Label (== eines der `buildSortChips`-Labels) für `CollapsibleSeg.value`. */
export function sortChipValue(current: ZuweisungSortKey): string {
  return SORT_CHIP_DISPLAY[current];
}

/**
 * Nächster SortKey nach einem Klick auf das Chip mit `clickedLabel`:
 * erneuter Klick auf das aktive umschaltbare Chip → Gegenrichtung; sonst →
 * geklickter Key. Unbekanntes Label → `current` (No-Op).
 */
export function nextSortKeyForClick(
  clickedLabel: string,
  current: ZuweisungSortKey,
): ZuweisungSortKey {
  const clicked = KEY_BY_DISPLAY.get(clickedLabel);
  if (!clicked) return current;
  if (clicked === current) return TOGGLE_PARTNER[current] ?? current;
  return clicked;
}
