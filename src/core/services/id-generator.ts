/**
 * Zentrale ID-Erzeugung für Vorgänge und Dokumente.
 *
 * `generatePrefixedId` wird von den Bereichs-Stores (Bauantraege, Forschung)
 * genutzt; `uuid` deckt kollisionssichere IDs für Dokumente, CSV-Merger und
 * Feedback ab.
 */

/**
 * Generiert präfixierte laufende IDs im Format `PREFIX-YYYY-NNN` (3-stellig
 * gepadded). Liest die höchste laufende Nummer aus den übergebenen Einträgen
 * und inkrementiert.
 */
export function generatePrefixedId<T extends { id: string }>(
  prefix: string,
  existing: T[],
): string {
  const year = new Date().getFullYear();
  const fullPrefix = `${prefix}-${year}-`;
  const nums = existing
    .filter(v => v.id.startsWith(fullPrefix))
    .map(v => parseInt(v.id.slice(fullPrefix.length), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${fullPrefix}${String(next).padStart(3, '0')}`;
}

/** Kollisionssichere UUID über Web-Crypto, mit Fallback für sehr alte Browser. */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
