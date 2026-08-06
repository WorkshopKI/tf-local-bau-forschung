/**
 * Werte für die Spaltenfilter der Antrags-Tabelle — rein, ohne React.
 *
 * Zwei Dinge wohnen hier:
 *
 * 1. **Der Leer-Sentinel.** `deriveFilterCandidates` überspringt den leeren
 *    String als „kein Kandidat". Zeilen ohne Wert wären damit nicht anwählbar
 *    UND fielen still aus der Tabelle, sobald irgendetwas angehakt ist. Ein
 *    nicht-leerer Sentinel macht sie zu einem regulären Filterwert.
 *
 * 2. **Die Monats-Ableitung der Datumsspalte.** Der Filterwert ist der Monat
 *    (`2024-08`), die Gruppe das Jahr (`2024`) — ein angehaktes Jahr ist damit
 *    schlicht „alle seine Monatswerte", ohne dass `applyColumnFilters` etwas von
 *    Hierarchie wissen müsste.
 *
 * Geparst wird ausschließlich über `parseGermanDate` — die dokumentierte „eine
 * Kette für die ganze App". Sie ist bewusst streng (trifft nur den GANZEN Wert),
 * ein Wert, den sie nicht liest, landet deshalb sichtbar unter dem Sentinel statt
 * unter einem geratenen Jahr.
 */
import { parseGermanDate } from '@/core/services/csv/dateParse';

/** Filter-Label für Zeilen ohne Wert. Siehe Modulkopf, Punkt 1. */
export const FILTER_EMPTY_LABEL = '(leer)';

/**
 * Monatsnamen als Tabelle, nicht über `toLocaleDateString`.
 *
 * Gleiche Begründung wie bei den Meilenstein-Labels: die Intl-Ausgabe hängt an
 * der Laufzeit-Locale und ist damit nichts, worauf sich ein Test oder eine
 * nebenstehende Beschriftung verlassen kann.
 */
export const MONATS_NAMEN: readonly string[] = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** `YYYY-MM` eines Datumswerts, oder `''` wenn er sich nicht als Datum liest. */
export function monatsWert(v: string | undefined): string {
  const iso = parseGermanDate((v ?? '').trim());
  return iso ? iso.slice(0, 7) : '';
}

/** Wie `monatsWert`, aber leere/unlesbare Werte werden als `(leer)` wählbar. */
export function monatsWertOderLeer(v: string | undefined): string {
  return monatsWert(v) || FILTER_EMPTY_LABEL;
}

/** Anzeige eines Monatswerts: `2024-08` → `August`. Sentinel bleibt, wie er ist. */
export function monatsFilterLabel(value: string): string {
  const m = /^\d{4}-(\d{2})$/.exec(value);
  if (!m) return value;
  return MONATS_NAMEN[Number(m[1]) - 1] ?? value;
}

/** Gruppe eines Monatswerts = sein Jahr. Der Sentinel gehört in keine Gruppe. */
export function jahrGruppe(value: string): string | null {
  const m = /^(\d{4})-\d{2}$/.exec(value);
  return m ? m[1]! : null;
}

/**
 * Reihenfolge der Datums-Filterwerte: **neueste zuerst**, `(leer)` ganz unten.
 *
 * Weil `YYYY-MM` lexikografisch wie chronologisch sortiert, reicht ein
 * umgedrehter String-Vergleich — Jahre absteigend UND Monate absteigend fallen
 * damit in einem Schritt an.
 */
export function neuesteZuerst(a: string, b: string): number {
  const ja = jahrGruppe(a);
  const jb = jahrGruppe(b);
  if (ja === null || jb === null) {
    if (ja === null && jb === null) return a.localeCompare(b, 'de');
    return ja === null ? 1 : -1;
  }
  return b.localeCompare(a);
}
