export interface PresetColor {
  name: string;
  h: number;
  s: string;
  l: string;
}

export const PRESET_COLORS: PresetColor[] = [
  { name: 'Schiefer',    h: 215, s: '25%', l: '42%' },   // Gedämpftes Blaugrau — behördlich, ruhig
  { name: 'Petrol',      h: 192, s: '28%', l: '38%' },   // Dunkelcyan — technisch, professionell
  { name: 'Olivgrün',    h: 155, s: '22%', l: '38%' },   // Gedämpftes Grün — natürlich, sachlich
  { name: 'Terrakotta',  h: 18,  s: '35%', l: '45%' },   // Warmes Erdrot — warm, vertrauenswürdig
  { name: 'Pflaume',     h: 280, s: '18%', l: '40%' },   // Gedämpftes Violett — seriös, ruhig
  { name: 'Bernstein',   h: 38,  s: '40%', l: '40%' },   // Warmes Dunkelgelb — warm, einladend (l: 42→40% für ≥4,5:1 weißer CTA-Text, preset-contrast-contract)
  { name: 'Graphit',     h: 220, s: '8%',  l: '38%' },   // Fast neutral — maximal zurückhaltend
];

export function applyThemeColor(hue: number, saturation?: string, lightness?: string): void {
  const root = document.documentElement;
  root.style.setProperty('--tf-primary-h', String(hue));
  root.style.setProperty('--tf-primary-s', saturation ?? PRESET_COLORS[0]!.s);
  root.style.setProperty('--tf-primary-l', lightness ?? PRESET_COLORS[0]!.l);
}

/**
 * Die drei Werte einer Primärfarbe aus dem gespeicherten Profil.
 *
 * Eine Farbe sind Farbton, Sättigung UND Helligkeit — das Profil führte bis
 * v4.116 nur den Farbton, und der Start setzte die anderen beiden auf die
 * Standardwerte. „Graphit" (220 · 8% · 38%) kam so als `hsl(220, 25%, 42%)`
 * wieder hoch, ein sattes Blaugrau statt eines fast neutralen Tons.
 *
 * Ein Profil ohne `sat`/`lit` wird über den Farbton geheilt: die Vorgabe mit
 * demselben `h` liefert die fehlenden zwei Werte. Damit sehen auch Bestands-
 * Profile nach dem Neustart wieder die Farbe, die sie gewählt haben — ohne
 * Migrationsschritt.
 */
export function farbeAusProfil(theme?: { hue?: number; sat?: string; lit?: string }): PresetColor {
  const h = theme?.hue ?? PRESET_COLORS[0]!.h;
  if (theme?.sat && theme?.lit) return { name: '', h, s: theme.sat, l: theme.lit };
  const vorgabe = PRESET_COLORS.find(c => c.h === h);
  return vorgabe ?? { name: '', h, s: PRESET_COLORS[0]!.s, l: PRESET_COLORS[0]!.l };
}

/**
 * Zeigt die App gerade genau diese Vorgabe?
 *
 * Alle drei Werte, nicht nur der Farbton: „Schiefer" (215 · 25% · 42%) und ein
 * hypothetisches zweites Blau mit demselben `h` wären sonst dasselbe Häkchen.
 */
export function istGewaehlteFarbe(vorgabe: PresetColor, aktuell: PresetColor): boolean {
  return vorgabe.h === aktuell.h && vorgabe.s === aktuell.s && vorgabe.l === aktuell.l;
}

export function setDarkMode(dark: boolean): void {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export function isDarkMode(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}
