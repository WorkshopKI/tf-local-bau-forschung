/** Definition eines einzelnen Tour-Schritts */
export interface TourStep {
  /** Selektor: `data-tour="..."` Attribut auf dem Ziel-Element */
  target: string;
  /** Titel der Erklaerung */
  title: string;
  /** Beschreibungstext */
  description: string;
  /** Tooltip-Position relativ zum Target */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Plugin-ID zu der vor Anzeige navigiert werden soll (Cross-Page-Tour) */
  navigateTo?: string;
}

/** Die 5 Tour-Schritte fuer das TeamFlow-Onboarding */
export const TOUR_STEPS: TourStep[] = [
  {
    target: 'home-dashboard',
    title: 'Willkommen bei TeamFlow',
    description:
      'Dein Dashboard zeigt offene Vorgaenge, anstehende Fristen und den Status des KI-Assistenten auf einen Blick.',
    position: 'bottom',
    navigateTo: 'home',
  },
  {
    target: 'nav-sidebar',
    title: 'Navigation',
    description:
      'Wechsle zwischen Bauantraegen, Forschungsantraegen, Dokumenten und dem KI-Chat. Unter Admin findest du Einstellungen und den Suchindex.',
    position: 'right',
  },
  {
    target: 'search-input',
    title: 'Intelligente Suche',
    description:
      'Durchsuche alle indexierten Dokumente per Stichwort oder natuerlichsprachiger Frage. Die Suche kombiniert Volltextsuche mit KI-gestuetzter Aehnlichkeitssuche.',
    position: 'bottom',
    navigateTo: 'suche',
  },
  {
    target: 'document-list',
    title: 'Vorgaenge & Dokumente',
    description:
      'Klicke einen Vorgang an, um Details und automatisch extrahierte Metadaten zu sehen — Aktenzeichen, Fristen, Antragsteller und mehr.',
    position: 'bottom',
    navigateTo: 'home',
  },
  {
    target: 'suchindex-status',
    title: 'Suchindex',
    description:
      'Zeigt an, wie viele Dokumente indexiert sind. Den Index aktualisierst du ueber das Skript "Dokumentenindex-aktualisieren" auf dem Netzlaufwerk.',
    position: 'left',
  },
];
