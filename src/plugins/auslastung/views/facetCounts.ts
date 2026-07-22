/**
 * Facetten-Zähler für die Filter-Toolbars des Auslastungs-Moduls.
 *
 * Regel (identisch zur Förderanträge-Sidebar, `computeFacetCounts` in
 * `core/services/csv/filter/engine.ts`): der Zähler einer Pille gilt für die
 * Zeilen, die alle ANDEREN aktiven Filter bereits passiert haben — der eigene
 * Filter wird ausgenommen, sonst kollabierten die Geschwister-Werte auf 0.
 *
 * Damit gilt die Invariante, an der sich die Toolbar messen lassen muss:
 * **was die Pille anzeigt, ist die Zeilenzahl nach dem Klick auf sie.** Die
 * frühere Zählung über den gesamten Pool verletzte das, sobald ein zweiter
 * Filter aktiv war (Kategorie 30 + Antragstyp 16 → Liste zeigte 9).
 *
 * Rein + generisch über den Zeilentyp (Verbund-Views beider Tabs), kein React,
 * keine Domänen-Kenntnis. `bucketsOf` liefert 0..n Buckets pro Zeile — eine
 * Zeile darf in mehreren Werten derselben Facette zählen (Kategorie: Primär +
 * Aspekte; Status: „offen" und „Übernahme-Wunsch" überlappen bewusst).
 */

/** Eine Filter-Facette: benanntes Prädikat. `active: null` = inaktiv („Alle"). */
export interface Facet<Row> {
  key: string;
  active: ((row: Row) => boolean) | null;
}

/** Zeilen, die ALLE Facetten passieren (= die sichtbare Liste). */
export function applyFacets<Row>(
  rows: readonly Row[],
  facets: readonly Facet<Row>[],
): Row[] {
  return rowsExcept(rows, facets, null);
}

/**
 * Zeilen, die alle Facetten AUSSER `exceptKey` passieren. `exceptKey === null`
 * nimmt keine aus (= {@link applyFacets}).
 */
export function rowsExcept<Row>(
  rows: readonly Row[],
  facets: readonly Facet<Row>[],
  exceptKey: string | null,
): Row[] {
  const aktiv = facets.filter(f => f.active !== null && f.key !== exceptKey);
  if (aktiv.length === 0) return [...rows];
  return rows.filter(row => aktiv.every(f => f.active!(row)));
}

/** Ergebnis eines Facetten-Zählers. */
export interface FacetCount {
  /** „Alle"-Zahl dieser Facette: Zeilen, die alle anderen Filter passieren. */
  total: number;
  /** Bucket → Zeilenzahl nach Klick auf genau diesen Bucket. */
  byBucket: Record<string, number>;
}

/**
 * Zähler EINER Facette über {@link rowsExcept}. Eine Zeile zählt in jedem
 * Bucket, den `bucketsOf` für sie liefert (Duplikate werden ignoriert), aber
 * nur einmal in `total`.
 */
export function countFacet<Row>(
  rows: readonly Row[],
  facets: readonly Facet<Row>[],
  key: string,
  bucketsOf: (row: Row) => Iterable<string>,
): FacetCount {
  const basis = rowsExcept(rows, facets, key);
  const byBucket: Record<string, number> = {};
  for (const row of basis) {
    const gezaehlt = new Set<string>();
    for (const bucket of bucketsOf(row)) {
      if (gezaehlt.has(bucket)) continue;
      gezaehlt.add(bucket);
      byBucket[bucket] = (byBucket[bucket] ?? 0) + 1;
    }
  }
  return { total: basis.length, byBucket };
}

/**
 * Bequemlichkeit für Facetten, deren Prädikat genau „Zeile liegt im gewählten
 * Bucket" ist: baut aus `bucketsOf` + gewähltem Wert das Facetten-Prädikat.
 * Leerer Wert (`''`) → Facette inaktiv. Verwendet dieselbe `bucketsOf`-Funktion
 * wie {@link countFacet} — genau das hält Zähler und Liste deckungsgleich.
 */
export function bucketFacet<Row>(
  key: string,
  gewaehlt: string,
  bucketsOf: (row: Row) => Iterable<string>,
): Facet<Row> {
  if (!gewaehlt) return { key, active: null };
  return {
    key,
    active: (row) => {
      for (const bucket of bucketsOf(row)) {
        if (bucket === gewaehlt) return true;
      }
      return false;
    },
  };
}
