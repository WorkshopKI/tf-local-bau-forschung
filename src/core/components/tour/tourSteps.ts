import { features } from '@/config/feature-flags';

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
  /** Wenn gesetzt: Step nur anzeigen, wenn dieses Feature im Build aktiv ist. */
  requiresFeature?: keyof typeof features;
}

/** Vollstaendiger Step-Katalog. Wird beim Modul-Load gegen `features` gefiltert. */
const ALL_STEPS: TourStep[] = [
  {
    target: 'home-dashboard',
    title: 'Willkommen bei ZAH',
    description:
      'Dein Dashboard zeigt offene Vorgaenge, anstehende Fristen und den Status des KI-Assistenten auf einen Blick.',
    position: 'bottom',
    navigateTo: 'home',
  },
  {
    target: 'nav-sidebar',
    title: 'Navigation',
    description:
      'Hier wechselst du zwischen den Bereichen der App. Unten siehst du den Verbindungs-Status zum Daten-Share und kannst diese Tour jederzeit neu starten.',
    position: 'right',
  },
  {
    target: 'search-input',
    title: 'Intelligente Suche',
    description:
      'Durchsuche alle indexierten Dokumente per Stichwort oder natuerlichsprachiger Frage. Die Suche kombiniert Volltextsuche mit KI-gestuetzter Aehnlichkeitssuche.',
    position: 'bottom',
    navigateTo: 'suche',
    requiresFeature: 'suche',
  },
  {
    target: 'document-list',
    title: 'Vorgaenge & Dokumente',
    description:
      'Klicke auf einen Antrag, um Details und automatisch extrahierte Metadaten zu sehen — Aktenzeichen, Fristen, Antragsteller und mehr.',
    position: 'bottom',
    navigateTo: 'home',
  },
];

/** Die aktiven Tour-Schritte fuer die jeweilige Build-Variante. */
export const TOUR_STEPS: TourStep[] = ALL_STEPS.filter(
  step => !step.requiresFeature || features[step.requiresFeature] === true,
);
