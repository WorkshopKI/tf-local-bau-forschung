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
import type { VerbundZuweisungRow } from './verbund-aggregation';

export type ZuweisungSortKey =
  | 'akronym_asc'
  | 'fkz_asc'
  | 'titel_asc'
  | 'kategorie_asc'
  | 'sicherheit_asc'
  | 'sicherheit_desc';

/** Voreinstellung beim Oeffnen des Tabs (ersetzt die zufaellige Pool-Reihenfolge). */
export const DEFAULT_ZUWEISUNG_SORT: ZuweisungSortKey = 'akronym_asc';

/** Anzeige-Labels — muessen exakt den `CollapsibleSegItem.label`-Strings entsprechen. */
export const ZUWEISUNG_SORT_LABELS: Record<ZuweisungSortKey, string> = {
  akronym_asc: 'Akronym (A→Z)',
  fkz_asc: 'Förderkennzeichen (A→Z)',
  titel_asc: 'Verbundtitel (A→Z)',
  kategorie_asc: 'Kategorie',
  sicherheit_asc: 'Sicherheit (niedrigste zuerst)',
  sicherheit_desc: 'Sicherheit (höchste zuerst)',
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
