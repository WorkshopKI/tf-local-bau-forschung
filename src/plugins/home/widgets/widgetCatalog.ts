/**
 * Widget-KATALOG (Code, bewusst NICHT „Registry" — Kollisionsgefahr mit dem
 * registry.json-Begriff der Skill-Verwaltung): definiert je WidgetTyp Label,
 * Icon, Bereich, Verfügbarkeit und Default-Config. Der Katalog ist die einzige
 * Quelle für typ-gebundene Metadaten; die persistierte Config hält nur
 * Instanzen (homeWidgetsStore.ts).
 */
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BookMarked,
  Bot,
  ClipboardCheck,
  Columns3,
  ListChecks,
  Megaphone,
  Play,
  StickyNote,
} from 'lucide-react';
import { isFeedbackEnabled, isKuratorMenusEnabled } from '@/config/feature-flags';
import { defaultAntragKanbanLanes } from './kanbanLanes';
import type { WidgetSpezifischeConfig, WidgetTyp } from './types';

export interface WidgetKatalogEintrag {
  typ: WidgetTyp;
  label: string;
  icon: LucideIcon;
  /** Default-Bereich neuer Instanzen (haupt = linke Spalte, seite = rechts). */
  bereich: 'haupt' | 'seite';
  /** false = Zukunfts-Widget (v1.1/v1.2): erscheint ausgegraut in den
   *  Einstellungen, nie auf der Homepage. */
  verfuegbar: boolean;
  /** Badge-Text für die Einstellungs-Liste (z.B. Rollen-Bindung). */
  hinweisBadge?: string;
  /** Build-/Flag-Sichtbarkeit — false blendet den Typ überall aus (Homepage UND
   *  Einstellungen). ai-assistent ist bewusst immer sichtbar (wie die heutige
   *  Karte; eine spätere Opt-in-Bindung wäre hier ein Einzeiler). */
  sichtbarWenn: () => boolean;
  defaultConfig: () => WidgetSpezifischeConfig;
}

const KEINE = (): WidgetSpezifischeConfig => ({ art: 'keine' });

export const WIDGET_KATALOG: Record<WidgetTyp, WidgetKatalogEintrag> = {
  weitermachen: {
    typ: 'weitermachen',
    label: 'Weitermachen',
    icon: Play,
    bereich: 'haupt',
    verfuegbar: true,
    sichtbarWenn: () => true,
    defaultConfig: KEINE,
  },
  'meine-antraege': {
    typ: 'meine-antraege',
    label: 'Meine Anträge',
    icon: ListChecks,
    bereich: 'haupt',
    verfuegbar: true,
    sichtbarWenn: () => true,
    defaultConfig: KEINE,
  },
  kanban: {
    typ: 'kanban',
    // Quellen-neutral (v1.1: Anträge ODER Feedback wählbar) — die Widget-
    // Kopfzeile trägt die quellen-spezifische Bezeichnung.
    label: 'Kanban',
    icon: Columns3,
    bereich: 'haupt',
    verfuegbar: true,
    sichtbarWenn: () => true,
    defaultConfig: () => ({
      art: 'kanban',
      quelle: 'antraege',
      lanes: defaultAntragKanbanLanes(),
      farbmodus: 'bunt',
      maxKartenProLane: 4,
    }),
  },
  antragseingang: {
    typ: 'antragseingang',
    label: 'Antragseingang',
    icon: Activity,
    bereich: 'seite',
    verfuegbar: true,
    sichtbarWenn: () => true,
    defaultConfig: () => ({
      art: 'ampel',
      warnschwelleTage: 30,
      kritischSchwelleTage: 90,
      zeilenKlickbar: true,
    }),
  },
  'ai-assistent': {
    typ: 'ai-assistent',
    label: 'AI-Assistent',
    icon: Bot,
    bereich: 'seite',
    verfuegbar: true,
    sichtbarWenn: () => true,
    defaultConfig: KEINE,
  },
  notizen: {
    typ: 'notizen',
    label: 'Notizen',
    icon: StickyNote,
    bereich: 'seite',
    verfuegbar: true,
    sichtbarWenn: () => true,
    defaultConfig: () => ({ art: 'notizen' }),
  },
  'qs-freigaben': {
    typ: 'qs-freigaben',
    label: 'QS-Freigaben offen',
    icon: ClipboardCheck,
    bereich: 'haupt',
    verfuegbar: false,
    sichtbarWenn: () => true,
    defaultConfig: KEINE,
  },
  'feedback-news': {
    typ: 'feedback-news',
    label: 'Feedback-Neuigkeiten',
    icon: Megaphone,
    bereich: 'seite',
    verfuegbar: true,
    sichtbarWenn: () => isFeedbackEnabled(),
    defaultConfig: () => ({ art: 'feedback-news', maxEintraege: 3 }),
  },
  'registry-aenderungen': {
    typ: 'registry-aenderungen',
    label: 'Registry-Änderungen',
    icon: BookMarked,
    bereich: 'seite',
    verfuegbar: false,
    hinweisBadge: 'Nur Kurator',
    sichtbarWenn: () => isKuratorMenusEnabled(),
    defaultConfig: KEINE,
  },
};

/** Alle Katalog-Einträge in stabiler Reihenfolge (für die Einstellungs-Liste). */
export function listeKatalog(): WidgetKatalogEintrag[] {
  return Object.values(WIDGET_KATALOG);
}
