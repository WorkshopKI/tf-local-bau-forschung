/**
 * Der Verlauf gestellter Anfragen — Einfügen, Kappen, Filtern.
 *
 * Steht hier und nicht mehr in `suche/suchseite-utils.ts`, weil es seit v4.106
 * einen **zweiten** Verlauf gibt: die Fragen an die Förderantrags-Liste
 * ([frageVerlauf.ts](src/plugins/antraege/frage/frageVerlauf.ts)). Die Mechanik
 * ist dieselbe, die Listen sind getrennt.
 *
 * Der direkte Weg — das Plugin importiert `suchseite-utils` — schiede aus: die
 * Datei zieht `CollapsibleSeg` und damit eine React-Komponente hinter sich her,
 * und ein Verlaufs-Store hätte dann eine Oberfläche im Rücken. `suchseite-utils`
 * re-exportiert die drei Namen weiter, damit die Aufrufer der Suche unverändert
 * bleiben.
 *
 * Rein — kein React, kein Speicher, keine Uhr.
 */

/** Default-Cap fuer die persistierte Such-Historie. */
export const MAX_RECENT_SEARCHES = 15;

/**
 * Fuegt eine Anfrage vorne in die Recent-Search-Liste ein (most-recent-first).
 *
 * - `trim`; zu kurze (`len < 2`) Anfragen werden ignoriert → unveraenderte
 *   Liste (Identitaet bleibt erhalten, damit der Store ein No-op erkennt).
 * - Case-insensitives Dedupe: ein bereits vorhandener identischer Eintrag wird
 *   entfernt und neu nach vorne gesetzt (Move-to-front).
 * - Prefix-Suppression: aeltere Eintraege, die ein PRAEFIX der neuen Anfrage
 *   sind, fallen raus ("standardisierung" ersetzt das fruehere "standard").
 *   Laengere Eintraege, von denen die neue Anfrage ein Praefix ist, bleiben.
 * - Auf `max` gekappt.
 */
export function pushRecentSearch(list: string[], q: string, max: number = MAX_RECENT_SEARCHES): string[] {
  const trimmed = q.trim();
  if (trimmed.length < 2) return list;
  const lower = trimmed.toLowerCase();
  const kept = list.filter(e => !lower.startsWith(e.toLowerCase()));
  return [trimmed, ...kept].slice(0, max);
}

/**
 * Filtert die Recent-Search-Liste fuer die Vorschlags-Anzeige.
 *
 * - Leere Query → die `max` juengsten Eintraege.
 * - Sonst case-insensitiver Substring-Match; der Eintrag, der exakt der
 *   aktuellen Query entspricht, wird ausgeschlossen (kein Vorschlag fuer das
 *   bereits Getippte).
 */
export function filterRecentSearches(list: string[], query: string, max: number = 8): string[] {
  const q = query.trim().toLowerCase();
  if (q === '') return list.slice(0, max);
  return list.filter(e => {
    const el = e.toLowerCase();
    return el !== q && el.includes(q);
  }).slice(0, max);
}
