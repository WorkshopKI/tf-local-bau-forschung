/**
 * Datenmodell des Status-Katalogs (Status-System neu, Phase 1).
 *
 * Der Katalog macht aus der bisher hartkodierten Status→Kategorie-Map
 * (`status-canonical.ts`) **kuratierbare, versionierte Daten**: jedes Statusfeld
 * und jeder bekannte Statuswert bekommt einen Eintrag mit Label, Kategorie,
 * Spine-Phase, Rang und Prominenz. Unbekanntes wird beim Import als
 * `unkuratiert` aufgenommen — nie stillschweigend gemappt.
 *
 * Die `StatusCategory`-Taxonomie bleibt **unverändert** aus `status-canonical.ts`
 * (keine zweite Kategorien-Wahrheit). Die `SpinePhase` ist genau die amtliche
 * 5-Stationen-Wirbelsäule (`STEPPER_STATIONS` in `statusZuStepperPosition.ts`),
 * hier als benanntes Union statt als Stationsindex.
 */
import type { StatusCategory } from '@/core/utils/status-canonical';

export type { StatusCategory };

/** Amtliche Wirbelsäule (Eingang→…→Schluss), 1:1 zu `STEPPER_STATIONS`.
 *  `keine` = trägt nicht zur Positionsableitung bei (Sonstige/Unkuratiert). */
export type SpinePhase =
  | 'eingang'
  | 'vollstaendigkeit'
  | 'fachpruefung'
  | 'bewilligung'
  | 'schluss'
  | 'keine';

/** Anzeige-Prominenz eines Feldes/Wertes. Wirkt **nur** auf die Darstellung
 *  (Timeline/Warum), nie auf Erfassung oder Ableitung. `ignoriert` = nirgends
 *  gerendert (Events werden trotzdem vollständig erfasst). */
export type Prominenz = 'meilenstein' | 'normal' | 'nebensaechlich' | 'ignoriert';

/**
 * Zuständigkeit für einen Statuseintrag. Das Vokabular des Fachsystems trennt
 * durchgängig zwischen administrativer und fachlicher Bearbeitung — `[ARK]`
 * „Rücknahmeempfehlung adm." gegen `[ART]` „… techn.", `[AK4]` „Gutachten
 * kaufmännisch" gegen `[AT4]` „… technisch". Rein deskriptiv: filtert und
 * sortiert die Anzeige, sperrt nichts und geht nicht in die Ableitung ein.
 */
export type Zustaendigkeit = 'ab' | 'fb' | 'beide';

/**
 * Ein Ordner des Statusbaums, wie ihn das Fachsystem führt (Kommunikation,
 * Antragsbearbeitung → pre-check, Betreuung, …). Beliebig tief.
 *
 * Verbund- und Teilvorhaben-Baum sind **getrennt**: „Kommunikation" gibt es auf
 * beiden Ebenen, mit verschiedenen Codes dahinter (`[XYB]` gegen `[YB]`). Die
 * `ebene` gehört deshalb an die Kategorie, nicht nur ans Feld.
 */
export interface StatusKategorie {
  /** Stabil, sprechend: `vb.antragsbearbeitung`, `tv.antragsbearbeitung.pre-check`. */
  id: string;
  elternId: string | null;
  label: string;
  ebene: 'verbund' | 'tv';
  /** Sortierung unter demselben Elternknoten (Zehnerlücken). */
  reihenfolge: number;
  aktiv: boolean;
}

/** Katalog-Eintrag für ein Statusfeld (CSV-Spalte bzw. Canonical-Feld). */
export interface StatusFeldEintrag {
  /** Canonical-Field-Key (`status`, `verbund_status`) ODER — bei den Codes des
   *  Fachsystems — der ROHE CSV-Spalten-Code (`D_XTEC`). Der Code ist der
   *  einzige über Programme hinweg stabile Bezeichner; der tatsächliche
   *  Record-Key wird zur Lesezeit über das Schema aufgelöst (`feld-aufloesung.ts`). */
  feldId: string;
  label: string;
  /** `datum`: das Datum IST das Event. `text`: freier Texteintrag (`T_*`-Spalten).
   *  Beide haben kein Wert-Enum — ihr Ableitungs-Beitrag hängt am Feld. */
  typ: 'wert' | 'datum' | 'text';
  /** Fachliche Ebene des Eintrags: gilt er dem Verbund oder dem Teilvorhaben?
   *  Steuert die Event-/Timeline-Zuordnung. */
  ebene: 'verbund' | 'tv';
  /** Tatsächlicher Record-Key, falls ≠ `feldId` (z.B. `verbund_status` → der
   *  Verbund-Record führt ihn unter `status`). Default: `feldId`. */
  quelleKey?: string;
  /**
   * Aus WELCHEM Record gelesen wird — unabhängig von der fachlichen `ebene`.
   * Nötig, weil die Verbund-Codes (`X`-Präfix) nicht im Verbund-Record stehen:
   * der führt nur `titel` und `status`. Sie stehen identisch auf jeder
   * TV-Zeile der CSV. Default: dieselbe Herkunft wie die `ebene`.
   */
  herkunft?: 'verbund-record' | 'tv-record';
  /** Code des Fachsystems ohne Spalten-Präfix (`XTEC` zu `D_XTEC`) — der
   *  Bezeichner, unter dem das Team den Eintrag kennt. */
  code?: string;
  /** Begleitende Text-Spalte (`T_AAI` zu `D_AAI`). Das Fachsystem führt zu
   *  manchen Terminen eine Notiz; sie gehört zum selben Ereignis und bekommt
   *  deshalb keinen eigenen Katalog-Eintrag. */
  textSpalte?: string;
  /** Referenz in den Kategoriebaum (kein Pfad — Umbenennen bricht nichts).
   *  Ohne Zuordnung erscheint das Feld unter „Nicht zugeordnet". */
  kategorieId?: string;
  zustaendigkeit?: Zustaendigkeit;
  /** Ableitungs-Beitrag für Felder OHNE Wert-Enum (`datum`/`text`): dort trägt
   *  das FELD die Phase, weil es keinen Wert gibt, an dem sie hängen könnte.
   *  `rang` 0/undefiniert = trägt nicht bei (Default für den ganzen Seed). */
  spinePhase?: SpinePhase;
  rang?: number;
  terminal?: boolean;
  prominenzDefault: Prominenz;
  aktiv: boolean;
  unkuratiert: boolean;
  erstmalsGesehen?: string;
}

/** Katalog-Eintrag für einen konkreten Statuswert eines Feldes. */
export interface StatusWertEintrag {
  /** Stabil: `${feldId}::${normalisiert(wert)}`. */
  id: string;
  feldId: string;
  /** Rohwert in Original-Schreibweise. */
  wert: string;
  /** Default: `wert`. */
  label?: string;
  kategorie: StatusCategory;
  spinePhase: SpinePhase;
  /** 0 = trägt nicht zur Ableitung bei; sonst Zehnerlücken (10, 20, …) entlang der Spine. */
  rang: number;
  prominenz: Prominenz;
  /** Ablehnung, Widerruf, Rücknahme, Schlussvermerk … — final entschieden. */
  terminal: boolean;
  aktiv: boolean;
  unkuratiert: boolean;
  erstmalsGesehen?: string;
}

// --- Nächste-Schritte-Regeln (Struktur hier; Auswertung folgt in Phase 3) ---

export type Werkzeug = 'gutachten' | 'nachforderung' | 'ablehnung';

/** Bedingung eines Regelblatts oder einer UND/ODER-Gruppe. Rein deklarativ. */
export type Bedingung =
  | { alle: Bedingung[] }
  | { einige: Bedingung[] }
  | { feldId: string; op: 'ist' | 'istNicht' | 'gefuellt' | 'leer'; wert?: string }
  | { feldId: string; op: 'datumVor' | 'datumNach'; tageRelativHeute: number };

export interface NaechsterSchritt {
  label: string;
  /** Optionaler Verweis auf ein Workflow-Werkzeug — reine Navigation, nie ein Status. */
  werkzeug?: Werkzeug;
}

export interface NaechsterSchrittRegel {
  id: string;
  /** Aufsteigend; alle zutreffenden aktiven Regeln liefern Schritte. */
  prioritaet: number;
  aktiv: boolean;
  beschreibung: string;
  bedingung: Bedingung;
  schritte: NaechsterSchritt[];
}

/** Eine gespeicherte, aktivierbare Fassung des Katalogs (+ Regeln). */
export interface MappingVersion {
  /** v+1 beim Speichern. */
  version: number;
  /** `UserProfile.bearbeiter_kuerzel` (via `useMeinKuerzel`), null im Seed. */
  autor: string | null;
  zeitstempel: string;
  kommentar?: string;
  felder: StatusFeldEintrag[];
  werte: StatusWertEintrag[];
  regeln: NaechsterSchrittRegel[];
  /** Der Statusbaum. Optional, damit Fassungen aus der Zeit vor dem
   *  Code-Inventar unverändert gültig bleiben (fehlt er, sind alle Felder
   *  „Nicht zugeordnet"). */
  kategorien?: StatusKategorie[];
}

// --- Ableitung (Phase 3) ---

/** Ein Feldwert und ob/warum er zur Positionsableitung beiträgt. Datenbasis des
 *  „Warum?"-Popovers. */
export interface Beitrag {
  feldId: string;
  wert: string;
  /** Gesetzt bei TV-bezogenen Werten. */
  tvId?: string;
  kategorie: StatusCategory;
  spinePhase: SpinePhase;
  rang: number;
  terminal: boolean;
  beruecksichtigt: boolean;
  /** Grund für Nicht-Berücksichtigung. */
  grund?: 'unkuratiert' | 'rang-0' | 'inaktiv';
}

export interface FuehrenderWert {
  feldId: string;
  wert: string;
  rang: number;
  tvId?: string;
}

export interface KonfliktDetail {
  feldId: string;
  wert: string;
  tvId?: string;
  spinePhase: SpinePhase;
}

export interface AbgeleiteterSchritt extends NaechsterSchritt {
  regelId: string;
}

/** Ergebnis der deterministischen Statusableitung über das Feld-Ensemble. */
export interface AbleitungsErgebnis {
  spinePhase: SpinePhase;
  kategorie: StatusCategory;
  fuehrenderWert: FuehrenderWert | null;
  terminal: boolean;
  konflikt: boolean;
  konfliktDetails: KonfliktDetail[];
  beitraege: Beitrag[];
  naechsteSchritte: AbgeleiteterSchritt[];
}

/** Ein noch nicht kuratierter, beim Import entdeckter (Feld,Wert)-Fund. */
export interface UnkuratierterFund {
  /** Stabil: `${feldId}::${normalisiert(wert)}`. */
  id: string;
  feldId: string;
  wert: string;
  erstmalsGesehen: string;
}

/** Stabile Wert-ID aus Feld + normalisiertem Rohwert. */
export function wertId(feldId: string, wert: string): string {
  return `${feldId}::${normalisiereWert(wert)}`;
}

/** Normalisierung eines Rohwerts: trim + lowercase (deckungsgleich mit
 *  `status-canonical.ts`, damit Lookups über beide Pfade identisch treffen). */
export function normalisiereWert(wert: string): string {
  return wert.trim().toLowerCase();
}
