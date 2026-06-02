/**
 * Kompetenz-Matrix — Auto-Abkürzung der Unterkategorie-Spaltenköpfe (v2.16).
 *
 * Die Matrix-Spalten sind nur 48 px breit; das volle XLSX-Label passt nicht
 * einzeilig. `deriveCode` leitet einen kurzen, einzeiligen Code ab („Werkst.",
 * „Rob/KI") — der volle Name steht immer im `title`-Tooltip und in der
 * Reveal-Leiste. Rein deterministisch + ohne Seiteneffekte → unit-testbar.
 *
 * Keine Datenmodell-Änderung: das Schema speichert weiter die vollen Labels,
 * der Code ist reine Anzeige-Ableitung.
 */

/**
 * Kurzcode (≈ ≤ `maxLen` Zeichen, einzeilig) aus einem vollen Unterkategorie-
 * Label. Heuristik:
 *  - kurz genug → unverändert.
 *  - mit „/" → jeden Teil auf 3 Zeichen kürzen, mit „/" verbinden („Robotik/KI" → „Rob/KI").
 *  - sonst erstes Wort; ist es länger als `maxLen`, auf `maxLen-1` + „." kürzen
 *    („Werkstofftechnik" → „Werkst."), bei mehreren Wörtern ebenfalls erstes
 *    Wort + „." als kompakte Marke.
 * Umlaute/ß bleiben intakt (CSS-`text-overflow` ist das Sicherheitsnetz).
 */
export function deriveCode(label: string, maxLen = 7): string {
  const s = label.trim().replace(/\s+/g, ' ');
  if (!s) return '';
  if (s.length <= maxLen) return s;

  if (s.includes('/')) {
    const abbr = s
      .split('/')
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => (p.length <= 3 ? p : p.slice(0, 3)))
      .join('/');
    // Slash-Form darf etwas länger als maxLen sein (Trenner zählen nicht hart mit).
    if (abbr && abbr.length <= maxLen + 2) return abbr;
  }

  const firstWord = s.split(/[ \-–]/)[0] ?? s;
  if (firstWord.length >= maxLen) return `${firstWord.slice(0, maxLen - 1)}.`;
  // Mehrwortig + kurzes erstes Wort → erstes Wort als Marke mit Punkt.
  return s.includes(' ') ? `${firstWord}.` : `${firstWord.slice(0, maxLen - 1)}.`;
}
