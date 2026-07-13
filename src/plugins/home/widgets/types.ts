/**
 * Home-Widget-System — Schema (v1).
 *
 * Persönliche DARSTELLUNGS-Config der Startseite: welche Widgets in welcher
 * Reihenfolge, sichtbar/eingeklappt, plus widget-spezifische Detail-Config.
 *
 * Persistenz-Invariante (HART): IDB primär (kv-Key `home-widgets-config`,
 * homeWidgetsStore.ts), optional gespiegelt in `PersonalEinstellungen`
 * (persönliches Laufwerk, LWW). NIE in registry.json, NIE auf dem geteilten
 * Daten-Share, NIE im SMB-Snapshot — der kv-Store steht in keiner
 * Snapshot-Allowlist (SNAPSHOT_FILES). Guard: `home-widgets-local-only`
 * (src/__tests__/codebase-conventions.test.ts).
 */
import type { FeedbackStatus } from '@/core/types/feedback';
import type { StatusCategory } from '@/core/utils/status-canonical';

export interface HomeWidgetConfig {
  version: 1;
  /** ISO-Zeitstempel — Last-Writer-Wins analog PersonalEinstellungen. */
  updatedAt: string;
  widgets: WidgetInstanz[];
}

/**
 * Abschließende Typ-Liste v1. `qs-freigaben` / `feedback-news` /
 * `registry-aenderungen` sind im Katalog angelegt, aber `verfuegbar: false`
 * (Folge-Pakete v1.1/v1.2) — sie erscheinen nur ausgegraut in den Einstellungen.
 */
export type WidgetTyp =
  | 'weitermachen'
  | 'meine-antraege'
  | 'kanban'
  | 'antragseingang'
  | 'ai-assistent'
  | 'notizen'
  | 'qs-freigaben'
  | 'feedback-news'
  | 'registry-aenderungen';

export interface WidgetInstanz {
  /** Instanz-ID — mehrere Instanzen desselben Typs sind möglich (z.B. 2 Kanbans). */
  id: string;
  typ: WidgetTyp;
  /** GLOBALE Ordnungszahl über beide Bereiche (eine flache Positionsliste in den
   *  Einstellungen); der Stack rendert je Bereich in globaler Reihenfolge. */
  position: number;
  /** Hauptspalte vs. rechte Seitenspalte des Home-Grids. */
  bereich: 'haupt' | 'seite';
  sichtbar: boolean;
  /** Einzige Quelle des Collapse-Zustands (useCollapsedSection wird für
   *  Widgets NICHT verwendet — keine doppelte Persistenz). */
  eingeklappt: boolean;
  config: WidgetSpezifischeConfig;
}

/** Eine Anträge-Kanban-Lane = eine Status-Kategorie (Pitfall #12: nie Roh-Status). */
export interface KanbanLane {
  kategorie: StatusCategory;
  spalten: 1 | 2;
}

/** Eine Feedback-Kanban-Lane = ein Feedback-Status (Pitfall #21: nie Roh-Literal). */
export interface FeedbackKanbanLane {
  status: FeedbackStatus;
  spalten: 1 | 2;
}

interface KanbanWidgetConfigBasis {
  art: 'kanban';
  farbmodus: 'bunt' | 'monochrom';
  /** Kappung je Lane, danach „+ N weitere →". Default 4. */
  maxKartenProLane: number;
}

/** Kanban aus Förderanträgen: Lanes = Status-Kategorien, optional ein Filter-Preset. */
export interface AntragKanbanWidgetConfig extends KanbanWidgetConfigBasis {
  quelle: 'antraege';
  /** UserPreset.id aus idb-filter; bei gelöschtem Preset Fallback auf Grundmenge. */
  presetId?: string;
  lanes: KanbanLane[];
}

/** Kanban aus Feedback-Tickets: Lanes = Feedback-Status (kein Antrags-Preset). */
export interface FeedbackKanbanWidgetConfig extends KanbanWidgetConfigBasis {
  quelle: 'feedback';
  lanes: FeedbackKanbanLane[];
}

/**
 * Quellenabhängig typisiert (diskriminiert auf `quelle`, v1.1): Anträge →
 * StatusCategory-Lanes (+ optionales Preset), Feedback → FeedbackStatus-Lanes.
 * So können Lanes nie „ins Leere" der falschen Quelle zeigen.
 */
export type KanbanWidgetConfig = AntragKanbanWidgetConfig | FeedbackKanbanWidgetConfig;

export interface AmpelWidgetConfig {
  art: 'ampel';
  /** Grenze frisch→warnung in Tagen. Default 30. */
  warnschwelleTage: number;
  /** Grenze warnung→kritisch in Tagen. Default 90. Wirkt NUR über den
   *  Aggregations-Hook (useEingangAmpelCounts) — die 4-Stufen-Logik der
   *  Listenzeilen (getEingangAmpel) bleibt unangetastet. */
  kritischSchwelleTage: number;
  /** Default true: Zeile öffnet die gefilterte Antragsliste (bewusste Änderung
   *  ggü. der alten Info-Karte — aus einem Widget heraus ist Navigation erwartbar). */
  zeilenKlickbar: boolean;
}

/** Notiz-TEXT liegt unter eigenem kv-Key (`home-notizen`), nicht in der Config —
 *  so wird er nicht bei jeder Positions-/Sichtbarkeits-Änderung mitgeschrieben. */
export interface NotizenWidgetConfig {
  art: 'notizen';
}

/** Widgets ohne Detail-Config (Weitermachen, Meine Anträge, AI-Assistent, …). */
export interface LeereWidgetConfig {
  art: 'keine';
}

export type WidgetSpezifischeConfig =
  | KanbanWidgetConfig
  | AmpelWidgetConfig
  | NotizenWidgetConfig
  | LeereWidgetConfig;
