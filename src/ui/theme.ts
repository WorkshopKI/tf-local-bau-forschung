export interface PresetColor {
  name: string;
  h: number;
  s?: string;
}

export const PRESET_COLORS: PresetColor[] = [
  { name: 'Blau', h: 221 },
  { name: 'Grün', h: 142 },
  { name: 'Violett', h: 262 },
  { name: 'Orange', h: 25 },
  { name: 'Teal', h: 174 },
  { name: 'Rot', h: 0 },
  { name: 'Neutral', h: 220, s: '10%' },
];

export function applyThemeColor(hue: number, saturation?: string): void {
  const root = document.documentElement;
  root.style.setProperty('--tf-primary-h', String(hue));
  if (saturation) {
    root.style.setProperty('--tf-primary-s', saturation);
  } else {
    root.style.setProperty('--tf-primary-s', '83%');
  }
}

export function setDarkMode(dark: boolean): void {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export function isDarkMode(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}
