export interface ThemePreset {
  id: string;
  darkId: string;
  name: string;
  description: string;
}

export const themePresets: ThemePreset[] = [
  {
    id: "muted-stone-contrast",
    darkId: "muted-stone-contrast-dark",
    name: "Stone",
    description: "Ruhiges Steingrau mit klarerer Hierarchie und Kontrast.",
  },
  {
    id: "muted-moss-light",
    darkId: "muted-moss-light-dark",
    name: "Moss",
    description: "Helles, nebliges Grün mit sehr subtilen Akzenten.",
  },
  {
    id: "silber",
    darkId: "silber-dark",
    name: "Silber",
    description: "Kühles Aluminium-Theme in feinen Graustufen mit Sora.",
  },
];
