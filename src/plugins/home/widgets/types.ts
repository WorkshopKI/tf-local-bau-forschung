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
  /** Schema-Version. v2 (Home-Redesign „optimiert"): `weitermachen` ist nicht
   *  mehr im Default (das Hero-Band zeigt es prominent); v1-Configs werden beim
   *  Lesen migriert (sichtbare weitermachen-Instanz einmalig ausgeblendet). */
  version: 2;
  /** ISO-Zeitstempel — Last-Writer-Wins analog PersonalEinstellungen. */
  updatedAt: string;
  widgets: WidgetInstanz[];
}

/**
 * Abschließende Typ-Liste. Alle Typen sind im Katalog `verfuegbar: true`; die
 * Homepage-Sichtbarkeit steuert je Instanz `sichtbar` + katalogseitig
 * `sichtbarWenn()` (Flags). Die v1.1-Widgets (`qs-freigaben`, `feedback-news`,
 * `auslastung`, `registry-aenderungen`, `neue-antraege`) sind Opt-in — sie
 * stehen NICHT im Default, sondern werden per `reconcileVerfuegbareWidgets`
 * als `sichtbar: false` nachgezogen. `neue-antraege` = MA-Selbsteintragung
 * (ehem. eigene Home-Sektion, flag-gebunden via `sichtbarWenn`).
 */
export type WidgetTyp =
  | 'weitermachen'
  | 'meine-antraege'
  | 'kanban'
  | 'antragseingang'
  | 'ai-assistent'
  | 'notizen'
  | 'feedback-news'
  | 'auslastung'
  | 'qs-freigaben'
  | 'registry-aenderungen'
  | 'neue-antraege';

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

/** Feedback-Neuigkeiten-Widget (v1.1): Kappung der angezeigten Ereignisse. */
export interface FeedbackNewsWidgetConfig {
  art: 'feedback-news';
  /** Max. angezeigte Neuigkeiten. Default 3. */
  maxEintraege: number;
}

/** Auslastungs-Mini-Widget (v1.1): Ich- vs. Team-Aggregat-Sicht. */
export interface AuslastungWidgetConfig {
  art: 'auslastung';
  /** 'auto' leitet aus dem Kürzel-Modus ab (Kürzel → ich, „alle"/leer → team);
   *  'ich'/'team' erzwingen die Sicht (z.B. PL mit eigenem Kürzel, will Team). */
  sicht: 'auto' | 'ich' | 'team';
}

/** QS-Freigaben-Widget (v1.1): Kappung der angezeigten Entwurf-Zeilen. */
export interface QsFreigabenWidgetConfig {
  art: 'qs-freigaben';
  /** Max. angezeigte Zeilen, danach „+ N weitere →". Default 4. */
  maxZeilen: number;
}

/** Registry-Änderungen-Widget (v1.1, Kurator-only): Kappung der Einträge. */
export interface RegistryAenderungenWidgetConfig {
  art: 'registry-aenderungen';
  /** Max. angezeigte Änderungen. Default 3. */
  maxEintraege: number;
}

/** Widgets ohne Detail-Config (Weitermachen, Meine Anträge, AI-Assistent, …). */
export interface LeereWidgetConfig {
  art: 'keine';
}

export type WidgetSpezifischeConfig =
  | KanbanWidgetConfig
  | AmpelWidgetConfig
  | NotizenWidgetConfig
  | FeedbackNewsWidgetConfig
  | AuslastungWidgetConfig
  | QsFreigabenWidgetConfig
  | RegistryAenderungenWidgetConfig
  | LeereWidgetConfig;

/**
 * EINZIGE Wahrheit: Hat dieses Widget ein Detail-Formular? Nur Typen mit echten
 * Reglern — Kanban (Lanes/Farbe/Quelle) und Ampel (Schwellen). Alle anderen
 * (Weitermachen, Meine Anträge, AI-Assistent, Notizen, Feedback-Neuigkeiten,
 * Auslastung, QS-Freigaben, Registry-Änderungen, Neue Anträge für dich) haben
 * keine Einstellungen.
 *
 * Steuert BEIDES aus einer Quelle: den Stift im Widget-Kopf (WidgetShell — kein
 * Stift ohne Einstellungen) und die aufklappbare Zeile in den Einstellungen
 * (WidgetsSettingsSection). Muss zu den Branches in WidgetConfigForm passen.
 */
export function hatWidgetDetailConfig(config: WidgetSpezifischeConfig): boolean {
  return config.art === 'kanban' || config.art === 'ampel';
}
