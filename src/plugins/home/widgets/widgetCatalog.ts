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
  FileClock,
  Gauge,
  GitBranch,
  Inbox,
  ListChecks,
  Megaphone,
  Milestone,
  Newspaper,
  Play,
  StickyNote,
  TimerOff,
} from 'lucide-react';
import {
  isMeilensteinMonitoringEnabled,
  isStatusCockpitEnabled,
  isTagesbriefEnabled,
  isVorgangssystemEnabled,
} from '@/config/feature-flags';
import { isAuslastungFreigeschaltet, isKuratorFreigeschaltet } from '@/core/modul-freischaltung';
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
    // „KI", nicht „AI": die einzige englische Schreibweise der Oberfläche stand
    // hier (v2.372.1). Die Modellwahl, neben der sie stand, ist mit v5.1 aus dieser
    // Karte verschwunden — verbinden heisst jetzt schlicht verbinden.
    label: 'KI-Assistent',
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
    // v4.134: hieß „QS-Freigaben offen" und las sich als Aussage über die
    // fachliche QS des Fachsystems. Gezählt wird, was in DIESER App entworfen
    // und noch nicht freigegeben wurde — gerätelokal (qsFreigaben.ts).
    label: 'Meine Entwürfe in dieser App',
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
    // v3.0: `features.feedback` war in jeder Variante an — der Flag ist entfallen.
    sichtbarWenn: () => true,
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
    sichtbarWenn: () => isAuslastungFreigeschaltet(),
    defaultConfig: () => ({ art: 'auslastung', sicht: 'auto' }),
  },
  'registry-aenderungen': {
    typ: 'registry-aenderungen',
    // Die Karte selbst heißt kurz „Zuletzt geändert" — dort nennt jede Zeile den
    // Gegenstand („Skill …", „Regel …"). In dieser Liste steht das Label allein
    // zwischen „Notizen" und „Auslastung" und braucht den Zusatz.
    // Die Typ-Id bleibt `registry-aenderungen`: sie ist in Nutzer-Configs persistiert.
    label: 'Zuletzt geändert: Skills & Regeln',
    icon: BookMarked,
    bereich: 'seite',
    verfuegbar: true,
    hinweisBadge: 'Nur Kurator',
    sichtbarWenn: () => isKuratorFreigeschaltet(),
    defaultConfig: () => ({ art: 'registry-aenderungen', maxEintraege: 3 }),
  },
  'neue-antraege': {
    typ: 'neue-antraege',
    label: 'Neue Anträge für dich',
    icon: Inbox,
    bereich: 'haupt',
    verfuegbar: true,
    // v3.0: `auslastungSelbstEintragung` war nach der Varianten-Zusammenlegung in
    // allen drei Builds an — der Flag ist entfallen. Die Selbsteintragung ist
    // bewusst NICHT ans Modul-Schloss gebunden: sie ist die Endnutzer-Seite, die
    // auch ohne das PL-Modul (prod) funktioniert. Die Komponente versteckt sich
    // ohnehin selbst, wenn keine passenden Anträge offen sind.
    sichtbarWenn: () => true,
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
  fristen: {
    typ: 'fristen',
    label: 'Fristen',
    icon: Milestone,
    bereich: 'haupt',
    verfuegbar: true,
    // Zwei Fristsysteme, eine Liste: Zieltage je Status (Stillstands-Waechter)
    // und Meilenstein-Sollwochen. Sichtbar, sobald EINES von beiden an ist —
    // das Widget sagt dann selbst, dass es nur eine Haelfte zeigt.
    sichtbarWenn: () => isVorgangssystemEnabled() || isMeilensteinMonitoringEnabled(),
    defaultConfig: KEINE,
  },
  tagesbrief: {
    typ: 'tagesbrief',
    label: 'Tagesbrief',
    icon: Newspaper,
    bereich: 'haupt',
    verfuegbar: true,
    // Am eigenen Flag, nicht am Vorgangssystem: der Brief traegt zehn Themen aus
    // vier Familien, und welche davon in diesem Build etwas sagen koennen,
    // entscheidet jedes Thema fuer sich (`themen.ts`). Ein Brief, der an der
    // Quelle seiner staerksten Themen haengt, waere in jeder anderen Variante
    // gar nicht erst abwaehlbar.
    sichtbarWenn: isTagesbriefEnabled,
    // Nichts abgewaehlt: Abwahl statt Auswahl, damit ein spaeter ergaenztes
    // Thema von selbst erscheint statt stumm zu bleiben.
    defaultConfig: (): WidgetSpezifischeConfig => ({ art: 'tagesbrief', aus: [] }),
  },
  // --- Abgeloest von `fristen` (v4.87) ------------------------------------
  // Sie beantworteten dieselbe Frage aus zwei Systemen, nebeneinander, ohne dass
  // eines seine Herkunft nannte. Die Eintraege bleiben stehen, damit
  // gespeicherte Instanzen weiter aufloesen; `verfuegbar: false` nimmt sie aus
  // Startseite UND Einstellungs-Liste (einzige Konsumenten des Flags).
  meilensteine: {
    typ: 'meilensteine',
    label: 'Meilensteine diese Woche',
    icon: Milestone,
    bereich: 'haupt',
    verfuegbar: false,
    sichtbarWenn: () => false,
    defaultConfig: KEINE,
  },
  nachtlauf: {
    typ: 'nachtlauf',
    label: 'Änderungen der letzten Nacht',
    icon: FileClock,
    bereich: 'haupt',
    verfuegbar: true,
    // Schwer genug fuer ein Default-Zu: es liest die Monatsdateien des Journals
    // vom Share.
    defaultEingeklappt: true,
    // An das Import-Diff-Journal gebunden; ohne Vorgangssystem entsteht keines.
    sichtbarWenn: () => isVorgangssystemEnabled(),
    // Der Auslieferungszustand ist exakt das Verhalten vor v4.135: ein Lauf,
    // zehn Zeilen, drei Kürzel, Ausschnitt aus dem Chip. Die Regler ändern
    // nichts, bis jemand sie anfasst.
    defaultConfig: () => ({
      art: 'nachtlauf',
      maxZeilen: 10,
      rueckblickTage: 0,
      maxKuerzel: 3,
      sortierung: 'anzahl',
      fusszeilen: true,
      ausschnitt: 'chip',
    }),
  },
  'haengt-fest': {
    typ: 'haengt-fest',
    label: 'Hängt fest',
    icon: TimerOff,
    bereich: 'haupt',
    verfuegbar: false,   // abgeloest von `fristen` (v4.87), siehe oben
    sichtbarWenn: () => false,
    defaultConfig: KEINE,
  },
};

/** Alle Katalog-Einträge in stabiler Reihenfolge (für die Einstellungs-Liste). */
export function listeKatalog(): WidgetKatalogEintrag[] {
  return Object.values(WIDGET_KATALOG);
}
