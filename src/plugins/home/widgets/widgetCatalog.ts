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
  Gauge,
  GitBranch,
  Inbox,
  ListChecks,
  Megaphone,
  Play,
  StickyNote,
} from 'lucide-react';
import {
  isAuslastungEnabled,
  isAuslastungSelbstEintragungEnabled,
  isFeedbackEnabled,
  isKuratorMenusEnabled,
  isStatusCockpitEnabled,
} from '@/config/feature-flags';
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
  /** Start-Collapse-Zustand neuer Instanzen (Default `false` = ausgeklappt).
   *  Für schwere Widgets (Auslastung: 13k-Anträge-Aggregation) sinnvoll `true`
   *  — greift nur bei der Erst-Anlage (Default/Reconcile), nie retroaktiv. */
  defaultEingeklappt?: boolean;
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
    verfuegbar: true,
    sichtbarWenn: () => true,
    defaultConfig: () => ({ art: 'qs-freigaben', maxZeilen: 4 }),
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
  auslastung: {
    typ: 'auslastung',
    label: 'Auslastung',
    icon: Gauge,
    bereich: 'seite',
    verfuegbar: true,
    // Schwere Aggregation (13k Anträge) → standardmäßig eingeklappt; der Body
    // rechnet erst beim Ausklappen (Lazy-Guard `aktiv` im Widget).
    defaultEingeklappt: true,
    sichtbarWenn: () => isAuslastungEnabled(),
    defaultConfig: () => ({ art: 'auslastung', sicht: 'auto' }),
  },
  'registry-aenderungen': {
    typ: 'registry-aenderungen',
    label: 'Registry-Änderungen',
    icon: BookMarked,
    bereich: 'seite',
    verfuegbar: true,
    hinweisBadge: 'Nur Kurator',
    sichtbarWenn: () => isKuratorMenusEnabled(),
    defaultConfig: () => ({ art: 'registry-aenderungen', maxEintraege: 3 }),
  },
  'neue-antraege': {
    typ: 'neue-antraege',
    label: 'Neue Anträge für dich',
    icon: Inbox,
    bereich: 'haupt',
    verfuegbar: true,
    // Flag-gebunden wie die frühere hart verdrahtete Home-Sektion (MA-
    // Selbsteintragung aus der Auslastung); die Komponente versteckt sich
    // zusätzlich selbst, wenn keine passenden Anträge offen sind.
    sichtbarWenn: () => isAuslastungSelbstEintragungEnabled(),
    defaultConfig: KEINE,
  },
  'status-verlauf': {
    typ: 'status-verlauf',
    label: 'Status & Verlauf',
    icon: GitBranch,
    bereich: 'haupt',
    verfuegbar: true,
    // An das Status-Cockpit gebunden (deterministischer Katalog-Snapshot); ohne
    // Flag kein abgeleiteter Status, also überall ausgeblendet.
    sichtbarWenn: () => isStatusCockpitEnabled(),
    defaultConfig: KEINE,
  },
};

/** Alle Katalog-Einträge in stabiler Reihenfolge (für die Einstellungs-Liste). */
export function listeKatalog(): WidgetKatalogEintrag[] {
  return Object.values(WIDGET_KATALOG);
}
