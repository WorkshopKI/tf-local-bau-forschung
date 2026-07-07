/**
 * Farb-Rampe der Altanträge-Alters-Bänder (Q-1 → Q-2 → Q-3..Q-7).
 *
 * Gedämpfte, monochrome Blau-Rampe auf dem Primär-Hue (v2.192, Design-Handoff
 * `auslastung-balken`): je NEUER der offene Antrag, desto dunkler/prominenter;
 * älter = heller/zurücktretend. Die frühere warme Gelb→Orange→Rot-Ampel wurde
 * verworfen — ihre Severity-/Ampel-Konnotation kollidierte mit den Status- und
 * Kategorie-Farben. Geteilt von `AltlastColBar` (Tabelle), `GesamtauslastungBar`
 * (Karten-Balken), `MaTileGrid` (Legende) und `AltlastInlineList` (Zeilen-Punkt).
 *
 * Farben kommen aus den globalen `--tf-altlast-band-*`-Tokens (Light + Dark in
 * `theme.css`, Token-Vertrag) — hier nur mit Fallback referenziert. Index 0 =
 * Band 1 (Q-1, neuestes/dunkelstes), Index 2 = Band 3 (Q-3..Q-7, ältestes/hellstes).
 */
export const ALTLAST_BAND_COLORS: readonly [string, string, string] = [
  'var(--tf-altlast-band-1, hsl(215, 18%, 64%))', // Band 1 · Q-1 · neuestes (dunkel)
  'var(--tf-altlast-band-2, hsl(215, 14%, 74%))', // Band 2 · Q-2
  'var(--tf-altlast-band-3, hsl(215, 12%, 83%))', // Band 3 · Q-3..Q-7 · ältestes (hell)
];

/** Text-/Zahl-Farbe auf dem jeweiligen Band (kontrastsicher, Light + Dark). */
export const ALTLAST_BAND_TEXT_COLORS: readonly [string, string, string] = [
  'var(--tf-altlast-band-1-text, #ffffff)',
  'var(--tf-altlast-band-2-text, hsl(215, 20%, 32%))',
  'var(--tf-altlast-band-3-text, hsl(215, 20%, 32%))',
];

export const ALTLAST_BAND_LABELS: readonly [string, string, string] = [
  'letztes Quartal',
  'vorletztes Quartal',
  'älter (ab Q-3)',
];

/** Kurzlabel je Band für die Balken-Tooltips („Q-1" … „Q-3–7"). */
export const ALTLAST_BAND_SHORT: readonly [string, string, string] = ['Q-1', 'Q-2', 'Q-3–7'];

/** Farbe für ein Band (1|2|3). Fallback auf Band 1, falls je out-of-range. */
export function altlastBandColor(band: 1 | 2 | 3): string {
  return ALTLAST_BAND_COLORS[band - 1] ?? ALTLAST_BAND_COLORS[0];
}

/** Text-/Zahl-Farbe für ein Band (1|2|3). Fallback auf Band 1. */
export function altlastBandTextColor(band: 1 | 2 | 3): string {
  return ALTLAST_BAND_TEXT_COLORS[band - 1] ?? ALTLAST_BAND_TEXT_COLORS[0];
}
