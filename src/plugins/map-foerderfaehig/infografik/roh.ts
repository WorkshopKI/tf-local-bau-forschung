/**
 * Gemeinsame Nachsichtigkeits-Primitiven für die Auswertung der Modell-Antwort.
 *
 * Eigene Datei, weil `schema.ts` und `substanz.ts` sie beide brauchen und ein
 * gegenseitiger Import einen Zyklus ergäbe.
 *
 * Nachsichtig gegenüber Form, streng gegenüber Beleg: fehlende Felder werden zu
 * Leerwerten, aber eine Sektions-ID, die es in der Gliederung nicht gibt, wird
 * verworfen statt übernommen — sonst könnte sich das Modell seine Fundstellen
 * selbst ausdenken.
 */

export function alsText(wert: unknown): string {
  return typeof wert === 'string' ? wert.trim() : '';
}

/** Behält nur Sektions-IDs, die in der Gliederung wirklich vorkommen. Dubletten fallen weg. */
export function alsSektionIds(wert: unknown, bekannt: ReadonlySet<string>): string[] {
  if (!Array.isArray(wert)) return [];
  return [...new Set(wert.filter((v): v is string => typeof v === 'string'))]
    .filter(id => bekannt.has(id));
}
