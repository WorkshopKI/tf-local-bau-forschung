/**
 * Kategorie-Farb-Helper für die kompakte Übersichts-View (Tabelle + Heatmap).
 *
 * Der globale `KategoriePill` rendert Kategorien als Tailwind-Klassen-basierte
 * Pills — in der dichten Tabelle/Heatmap brauchen wir aber einzelne CSS-Farben
 * (HSL-Strings) für die kleinen Punkt-Swatches und die Tile-Twin-Bars.
 *
 * Mapping orientiert sich am Handoff-Design (`hsl(<hue>, <sat>%, <light>%)`)
 * — eine Untermenge der `KategorieFarbe`-Werte aus `types.ts`.
 */
import type { KategorieFarbe } from '../../types';

/** Vollfarbe für 5×5/7×7-Swatches in Tabelle, KPI-Tile und Filter-Pills. */
export const KATEGORIE_DOT_HSL: Record<KategorieFarbe, string> = {
  blue:    'hsl(215, 35%, 50%)',
  emerald: 'hsl(145, 35%, 45%)',
  amber:   'hsl(38, 70%, 50%)',
  rose:    'hsl(15, 55%, 55%)',
  violet:  'hsl(270, 30%, 58%)',
  sky:     'hsl(195, 45%, 55%)',
  slate:   'hsl(215, 10%, 55%)',
};

/** Helle Variante (für Chip-Backgrounds, kaum gesättigt). */
export const KATEGORIE_BG_HSL: Record<KategorieFarbe, string> = {
  blue:    'hsl(215, 35%, 96%)',
  emerald: 'hsl(145, 35%, 95%)',
  amber:   'hsl(38, 70%, 95%)',
  rose:    'hsl(15, 55%, 96%)',
  violet:  'hsl(270, 30%, 96%)',
  sky:     'hsl(195, 45%, 96%)',
  slate:   'hsl(215, 10%, 96%)',
};

export function dotColor(farbe: KategorieFarbe | undefined | null): string {
  if (!farbe) return KATEGORIE_DOT_HSL.slate;
  return KATEGORIE_DOT_HSL[farbe] ?? KATEGORIE_DOT_HSL.slate;
}

export function bgColor(farbe: KategorieFarbe | undefined | null): string {
  if (!farbe) return KATEGORIE_BG_HSL.slate;
  return KATEGORIE_BG_HSL[farbe] ?? KATEGORIE_BG_HSL.slate;
}
