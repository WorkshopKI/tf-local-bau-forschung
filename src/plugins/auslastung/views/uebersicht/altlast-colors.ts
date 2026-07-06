/**
 * Farb-Rampe der Altanträge-Dringlichkeits-Bänder (Q-1 → Q-2 → Q-3..Q-7).
 *
 * Wärmende Eskalation Gelb → Orange → Rot: je älter der offene Antrag, desto
 * dringlicher, desto röter. Geteilt von `GesamtauslastungBar` (Balken-Segmente),
 * `MaTileGrid` (Legende) und `AltlastInlineList` (Zeilen-Punkt).
 *
 * Bewusst hsl-Literale (nicht `var(--tf-…)`): eine 3-Hue-Viz-Rampe hat keine
 * passenden Theme-Tokens (nur Amber+Rot existieren, kein Orange dazwischen), und
 * Viz-Farben als Literale sind hier das etablierte Muster (vgl. Status-Dots +
 * das frühere `ALTLAST_COLOR`). Mittlere Lightness/Sättigung → lesbar in Light
 * und Dark. Index 0 = Band 1 (Q-1), Index 2 = Band 3 (Q-3..Q-7).
 */
export const ALTLAST_BAND_COLORS: readonly [string, string, string] = [
  'hsl(45, 95%, 55%)',  // Band 1 · letztes Quartal · Amber
  'hsl(28, 90%, 52%)',  // Band 2 · vorletztes Quartal · Orange
  'hsl(2, 72%, 50%)',   // Band 3 · Q-3..Q-7 · Rot
];

export const ALTLAST_BAND_LABELS: readonly [string, string, string] = [
  'letztes Quartal',
  'vorletztes Quartal',
  'älter (ab Q-3)',
];

/** Farbe für ein Band (1|2|3). Fallback auf Band 1, falls je out-of-range. */
export function altlastBandColor(band: 1 | 2 | 3): string {
  return ALTLAST_BAND_COLORS[band - 1] ?? ALTLAST_BAND_COLORS[0];
}
