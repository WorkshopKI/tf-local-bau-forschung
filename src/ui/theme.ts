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
  { name: 'Bernstein',   h: 38,  s: '40%', l: '42%' },   // Warmes Dunkelgelb — warm, einladend
  { name: 'Graphit',     h: 220, s: '8%',  l: '38%' },   // Fast neutral — maximal zurückhaltend
];

export function applyThemeColor(hue: number, saturation?: string, lightness?: string): void {
  const root = document.documentElement;
  root.style.setProperty('--tf-primary-h', String(hue));
  root.style.setProperty('--tf-primary-s', saturation ?? '25%');
  root.style.setProperty('--tf-primary-l', lightness ?? '42%');
}

export function setDarkMode(dark: boolean): void {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export function isDarkMode(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}
