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
import type { FeedbackLane } from '@/components/feedback/feedbackLanes';
import type { TfBahnSpalten } from '@/components/kanban/tfBoardBahn';
import type { StatusCategory } from '@/core/utils/status-canonical';

export interface HomeWidgetConfig {
  /**
   * Schema-Version.
   *
   * - **v2** (Home-Redesign „optimiert"): `weitermachen` ist nicht mehr im
   *   Default — das Hero-Band zeigt es prominent; v1-Configs werden beim Lesen
   *   migriert (sichtbare weitermachen-Instanz einmalig ausgeblendet).
   * - **v3** (v4.134): „Änderungen der letzten Nacht" rückt einmalig ans Ende
   *   seiner Spalte. Es ist eine Nachschlage-Karte, keine Arbeitsliste — sie
   *   stand zwischen den Karten, die die Arbeit des Tages tragen. Einmalig,
   *   nicht als Pin: wer sie danach nach oben holt, behält sie dort.
   * - **v4** (v4.135): „Änderungen der letzten Nacht" bekommt Regler und damit
   *   eine eigene Detail-Config. Bestands-Instanzen tragen `{ art: 'keine' }`
   *   und bekämen ohne diesen Schritt nie ein Formular — `reconcile` ergänzt
   *   nur fehlende TYPEN, nicht fehlende Felder (s. `migriereV3NachtlaufConfig`).
   * - **v5** (v6.19): die Karten aus `ENTDECKUNG_WIDGETS` (+ die Alert-Karte des
   *   Hero-Bandes) werden EINMALIG eingeblendet. Der Reconcile zieht neue Typen
   *   bewusst als Opt-in nach — wer nie ins Untermenü sieht, findet sie damit
   *   nie. Der Versions-Stempel ist zugleich das Gedächtnis: sobald jemand
   *   irgendetwas an seiner Startseite ändert, persistiert `mutiere` v5, und ein
   *   Ausblenden hält (s. `migriereV4Entdeckung`).
   */
  version: 5;
  /** ISO-Zeitstempel — Last-Writer-Wins analog PersonalEinstellungen. */
  updatedAt: string;
  widgets: WidgetInstanz[];
  /**
   * Die beiden festen Karten ÜBER den Spalten (HomeHero). Sie sind keine
   * Widgets — sie haben keine Position, keinen Bereich und kein Einklappen —,
   * ihre Sichtbarkeit gehört aber in dieselbe persönliche Darstellungs-Config
   * (v4.41). Additiv: fehlt das Feld in einem Bestands-Stand, liest
   * `leseHeroConfig` den bisherigen Zustand „alles an" (kein Versions-Bump).
   */
  hero: HeroConfig;
}

/** Die beiden Karten des Bandes über den Spalten. */
export type HeroKarte = 'resume' | 'alert';

/** Die drei Kacheln der Karte „Braucht heute Aufmerksamkeit". */
export type HeroChipId = 'kritisch' | 'warnung' | 'qs';

export interface HeroConfig {
  sichtbar: Record<HeroKarte, boolean>;
  /**
   * Abgewählte Kacheln. Wirkt ZUSÄTZLICH zur Zähler-Regel (`heroChipSichtbarkeit`):
   * eine 0 fällt weiterhin von selbst raus — wer die QS-Kachel abwählt, will sie
   * auch bei 12 offenen Freigaben nicht sehen.
   */
  chips: Record<HeroChipId, boolean>;
}

/** Bisheriger Zustand: beide Karten, alle Kacheln. */
export const HERO_CONFIG_DEFAULT: HeroConfig = {
  sichtbar: { resume: true, alert: true },
  chips: { kritisch: true, warnung: true, qs: true },
};

/**
 * Abschließende Typ-Liste. Alle Typen sind im Katalog `verfuegbar: true`; die
 * Homepage-Sichtbarkeit steuert je Instanz `sichtbar` + katalogseitig
 * `sichtbarWenn()` (Flags). Die v1.1-Widgets (`qs-freigaben`, `feedback-news`,
 * `auslastung`, `registry-aenderungen`, `neue-antraege`, `status-verlauf`) sind
 * Opt-in — sie stehen NICHT im Default, sondern werden per
 * `reconcileVerfuegbareWidgets` als `sichtbar: false` nachgezogen.
 * `neue-antraege` = MA-Selbsteintragung (ehem. eigene Home-Sektion,
 * flag-gebunden via `sichtbarWenn`); `status-verlauf` ist an das
 * `statusCockpit`-Flag gebunden.
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
  | 'neue-antraege'
  | 'status-verlauf'
  | 'fristen'
  // Abgelöst von `fristen` (v4.87): sie zeigten dieselbe Frage aus zwei
  // Fristsystemen nebeneinander. Die Typen bleiben lesbar, damit gespeicherte
  // Configs nicht brechen — im Katalog stehen sie auf `verfuegbar: false` und
  // erscheinen weder auf der Startseite noch in den Einstellungen.
  | 'meilensteine'
  | 'haengt-fest'
  | 'nachtlauf';

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

/** Eine Anträge-Kanban-Lane = eine Status-Kategorie (Pitfall #12: nie Roh-Status).
 *  Die Spalten-Menge kommt vom Primitiv, das sie zeichnet (`TfBahnSpalten`). */
export interface KanbanLane {
  kategorie: StatusCategory;
  spalten: TfBahnSpalten;
}

/**
 * Eine Bahn im eigenen FENSTER: wie die Widget-Lane, plus die Frage, ob der
 * Nutzer sie DORT sehen will.
 *
 * Ausgeblendet wird per Flag statt durch Entfernen — die Liste IST die
 * Reihenfolge, und wer eine Bahn herausnähme, verlöre ihren Platz. Dasselbe
 * Modell wie `BoardLane` des Feedback-Boards, aus demselben Grund (v3.41).
 */
export interface VollbildLane extends KanbanLane {
  sichtbar: boolean;
}

/** Eine Feedback-Kanban-Lane = ein Feedback-Status (Pitfall #21: nie Roh-Literal).
 *  Identisch zur Board-Lane — EIN Typ, damit Widget und Board dieselbe
 *  Lane-Auswahl-UI teilen können. */
export type FeedbackKanbanLane = FeedbackLane;

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
  /**
   * Die Bahnen des EIGENEN FENSTERS — Auswahl, Reihenfolge und Kartenspalten,
   * die nur dort gelten. Das Fenster hat ein Vielfaches der Widget-Breite; wer
   * sich dort einrichtet, meint nicht die Startseite (und umgekehrt).
   *
   * `undefined` = noch nie eingerichtet. Dann friert das erste Öffnen den
   * bisherigen Anblick als Vorschlag ein (`seedVollbildLanes`) — bis v4.25 leitete
   * das Fenster seine Bahnen aus dem Bestand ab und ignorierte jede Einstellung.
   */
  vollbildLanes?: VollbildLane[];
  /**
   * Im EIGENEN FENSTER von Hand eingeklappte Bahnen. Nur dort persistiert: das
   * Fenster zeigt alle neun Kategorien und ist die Ansicht, in der man sich
   * einrichtet — im Widget hängt der Body ohnehin bei jedem Seitenwechsel aus
   * dem DOM, ein gespeicherter Zustand hätte dort nichts zu überleben.
   *
   * Eine Liste von Kategorien, kein Wunsch-Objekt: „eingeklappt" ist die einzige
   * Aussage, die eine Sitzung überdauern soll (`eingeklappteBahnen`). Getrennt
   * von `vollbildLanes.sichtbar`: eingeklappt heißt „steht als Schiene da",
   * abgewählt heißt „ist nicht da".
   */
  vollbildEingeklappt?: StatusCategory[];
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

/** Entwürfe-Widget („Meine Entwürfe in dieser App"): Kappung der Zeilen. */
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

/** Wonach „Änderungen der letzten Nacht" seine Zeilen ordnet. */
export type NachtlaufSortierung = 'anzahl' | 'label';

/**
 * Woher „Änderungen der letzten Nacht" seinen Bearbeiter-Ausschnitt nimmt.
 *
 * `'chip'` folgt dem Umschalter im Seitenkopf (wie Liste und Kanban). Die beiden
 * anderen übersteuern **nur diesen Umschalter** — ein Ausschnitt aus einer Frage
 * und eine festgezurrte MA-Identität gewinnen weiterhin, sonst machte eine
 * Widget-Einstellung den Bestand auf, den die Anmeldung zugeschnitten hat.
 */
export type NachtlaufAusschnitt = 'chip' | 'meine' | 'alle';

/**
 * „Änderungen der letzten Nacht" (v4.135).
 *
 * `rueckblickTage: 0` ist der Auslieferungszustand und heißt „genau ein Lauf" —
 * inklusive des Rückfalls auf den letzten Export MIT Änderungen. Jeder Wert > 0
 * schaltet auf ein Zeitfenster um, das diesen Rückfall bewusst NICHT hat
 * (`nachtLaeufeSeit`).
 */
export interface NachtlaufWidgetConfig {
  art: 'nachtlauf';
  /** Max. angezeigte Vorgangs-Zeilen, danach „… und N weitere". Default 10. */
  maxZeilen: number;
  /** 0 = nur der letzte Lauf (Default), sonst die letzten N Tage inkl. heute. */
  rueckblickTage: number;
  /** Feldnamen je Art in einer Zeile, danach „+N". Default 3. */
  maxKuerzel: number;
  sortierung: NachtlaufSortierung;
  /** Die beiden erklärenden Fußzeilen (Rest-Vorgänge, fremder Anteil). Default true. */
  fusszeilen: boolean;
  ausschnitt: NachtlaufAusschnitt;
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
  | NachtlaufWidgetConfig
  | LeereWidgetConfig;

/**
 * EINZIGE Wahrheit: Hat dieses Widget ein Detail-Formular? Nur Typen mit echten
 * Reglern — Kanban (Lanes/Farbe/Quelle), Ampel (Schwellen) und „Änderungen der
 * letzten Nacht" (Umfang/Zeitraum/Ausschnitt). Alle anderen (Weitermachen,
 * Meine Anträge, AI-Assistent, Notizen, Feedback-Neuigkeiten, Auslastung,
 * QS-Freigaben, Registry-Änderungen, Neue Anträge für dich, Status & Verlauf)
 * haben keine Einstellungen.
 *
 * Steuert BEIDES aus einer Quelle: den Stift im Widget-Kopf (WidgetShell — kein
 * Stift ohne Einstellungen) und die aufklappbare Zeile in den Einstellungen
 * (WidgetsSettingsSection). Muss zu den Branches in WidgetConfigForm passen.
 */
export function hatWidgetDetailConfig(config: WidgetSpezifischeConfig): boolean {
  return config.art === 'kanban' || config.art === 'ampel' || config.art === 'nachtlauf';
}
