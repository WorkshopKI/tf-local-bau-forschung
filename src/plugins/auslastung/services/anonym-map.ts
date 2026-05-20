/**
 * AnonymMap — deterministisches Mapping echtes TIB-Kuerzel ↔ "MA01"..."MAxx".
 *
 * Die Live-Map wird aus der persistenten Sidecar-Datei
 * `_intern/auslastung-kuerzel-map.json` aufgebaut (siehe `kuerzel-map.ts`).
 * Append-only: einmal vergebene anonIds bleiben stabil, neue Kuerzel
 * haengen hinten an — kein Identitaets-Drift bei neuen TIBs.
 *
 * Bootstrap + Build-Pipeline:
 *   bootstrapKuerzelMap(antraege) → buildAnonymMapFromKuerzelMap(file)
 *
 * Helpers in diesem Modul: Kuerzel-Normalisierung, User→AnonId-Lookup,
 * naechste freie anonId-Vergabe.
 */

export interface AnonymMap {
  /** echtes (uppercase) Kuerzel -> "MA01" */
  toAnon: Map<string, string>;
  /** "MA01" -> echtes (uppercase) Kuerzel */
  toReal: Map<string, string>;
}

/** Normalisiert ein Kuerzel: trim + uppercase. Leere Strings -> null. */
export function normalizeKuerzel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

/**
 * Schlaegt das echte Kuerzel des Users (aus Profile) gegen die AnonymMap nach.
 * Mehrfach-Kuerzel ("MUE,SCH") werden gesplittet — gibt das ERSTE matchende
 * zurueck. "alle" (Spezialwert fuer Disable des Filters) -> null.
 */
export function resolveAnonIdForUser(
  bearbeiterKuerzel: string | undefined | null,
  map: AnonymMap,
): string | null {
  if (!bearbeiterKuerzel) return null;
  if (bearbeiterKuerzel.trim().toLowerCase() === 'alle') return null;
  for (const part of bearbeiterKuerzel.split(',')) {
    const k = normalizeKuerzel(part);
    if (k && map.toAnon.has(k)) return map.toAnon.get(k)!;
  }
  return null;
}

/** Gibt die naechste freie MA-Nummer zurueck. Fuer "MA hinzufuegen" im Admin. */
export function nextFreeAnonId(existingIds: Iterable<string>): string {
  const taken = new Set<number>();
  for (const id of existingIds) {
    const m = /^MA(\d+)$/.exec(id);
    if (m) taken.add(Number(m[1]));
  }
  let n = 1;
  while (taken.has(n)) n++;
  return `MA${String(n).padStart(2, '0')}`;
}
