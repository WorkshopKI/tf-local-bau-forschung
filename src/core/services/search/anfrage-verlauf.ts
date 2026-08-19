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
 * Wie oft eine Anfrage gestellt wurde — Schlüssel ist die kleingeschriebene
 * Fassung, dieselbe Faltung, mit der `pushRecentSearch` entdoppelt.
 */
export type AnfrageZaehler = Readonly<Record<string, number>>;

/**
 * Wirft ab, was der Verlauf nicht mehr führt.
 *
 * **Der Verlauf bleibt die Liste, der Zähler ist nur die Zahl daneben.** Er wird
 * deshalb bei jedem Schreiben auf die Einträge des Verlaufs beschnitten: was die
 * Kappung, die Präfix-Unterdrückung oder das ✕ entfernt hat, verliert auch seine
 * Zählung. So bleibt der Speicher an die 15 Einträge gebunden, statt unbegrenzt
 * jede je getippte Anfrage mitzuschleppen.
 */
export function beschneideZaehler(
  zaehler: AnfrageZaehler, verlauf: readonly string[],
): AnfrageZaehler {
  const erlaubt = new Set(verlauf.map(e => e.toLowerCase()));
  const out: Record<string, number> = {};
  for (const [key, n] of Object.entries(zaehler)) {
    if (erlaubt.has(key) && Number.isFinite(n) && n > 0) out[key] = Math.floor(n);
  }
  return out;
}

/**
 * Zählt eine committete Anfrage — aber nur, wenn dazwischen etwas anderes lag.
 *
 * **Gezählt wird das Wiederkommen, nicht das Committen.** Das Suchfeld schreibt
 * den Verlauf nicht nur beim Absenden fort, sondern bei jedem Fokusverlust mit
 * gefülltem Feld (`onSearchBlur` in
 * [SearchInput.tsx](src/plugins/suche/SearchInput.tsx)) — und `confirmAnalyse`
 * schreibt ihn noch einmal. Bis v4.110 war das folgenlos, weil ein erneutes
 * Einfügen den Eintrag nur dorthin schob, wo er schon stand. Ein Zähler macht
 * denselben Aufruf inkrementell: gemessen stand eine Anfrage nach zwei
 * Fokusverlusten ohne einen einzigen zweiten Suchlauf bei 2 — und der Alltagsfall
 * „Enter, dann auf einen Treffer klicken" ebenso. Die Schwelle „mindestens
 * zweimal" wäre damit wirkungslos gewesen, und „Häufig gesucht" fiele auf genau
 * das zurück, was v4.111 behebt.
 *
 * Steht die Anfrage schon vorn im Verlauf, ist dieser Commit deshalb derselbe
 * Besuch. Die Regel zählt eher zu wenig als zu viel: zweimal dieselbe Anfrage
 * ohne etwas dazwischen bleibt eine — die Gruppe behauptet dann lieber nichts.
 *
 * Rein. `vorher` ist der Verlauf VOR `pushRecentSearch`, `nachher` der danach.
 */
export function zaehleAnfrage(
  zaehler: AnfrageZaehler,
  q: string,
  vorher: readonly string[],
  nachher: readonly string[],
): AnfrageZaehler {
  const out: Record<string, number> = { ...beschneideZaehler(zaehler, nachher) };
  const k = q.trim().toLowerCase();
  if (k.length === 0) return out;
  if ((vorher[0] ?? '').toLowerCase() === k) return out;
  if (!nachher.some(e => e.toLowerCase() === k)) return out;
  out[k] = (out[k] ?? 0) + 1;
  return out;
}

/**
 * Die tatsächlich häufigsten Anfragen — für die Gruppe „Häufig gesucht".
 *
 * **Ein Zähler, keine Schätzung** (v4.111). Bis dahin stand hier die zweite
 * Hälfte der Rezenzliste, begründet mit „was sich dort hält, hat neuere
 * Anfragen überlebt". Das Gegenteil trifft zu: der Verlauf ist Move-to-front,
 * eine oft gestellte Anfrage steht deshalb IMMER vorn — die hintere Hälfte ist
 * genau das, was am längsten NICHT gesucht wurde. Unter „Häufig gesucht" stand
 * am echten Verlauf ein Eintrag mit gerendert „0 Treffer".
 *
 * Zwei Regeln halten die Gruppe ehrlich:
 * - **Mindestens zweimal.** Was einmal getippt wurde, ist nicht häufig; ohne
 *   Wiederholung bleibt die Gruppe leer und verschwindet.
 * - **Nichts doppelt.** Was schon unter „Zuletzt gesucht" steht, kommt hier
 *   nicht noch einmal — sonst stünde dieselbe Anfrage zweimal auf derselben
 *   Seite, mit zwei verschiedenen Überschriften darüber.
 *
 * Bei Gleichstand entscheidet die Position im Verlauf (jünger zuerst).
 */
export function haeufigsteAnfragen(
  zaehler: AnfrageZaehler,
  verlauf: readonly string[],
  ausgenommen: readonly string[],
  max: number,
): string[] {
  const raus = new Set(ausgenommen.map(e => e.toLowerCase()));
  return verlauf
    .map((q, i) => ({ q, i, n: zaehler[q.toLowerCase()] ?? 0 }))
    .filter(e => e.n >= 2 && !raus.has(e.q.toLowerCase()))
    .sort((a, b) => (b.n - a.n) || (a.i - b.i))
    .slice(0, max)
    .map(e => e.q);
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
