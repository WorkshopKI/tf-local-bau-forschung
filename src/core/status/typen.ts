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

/** Katalog-Eintrag für ein Statusfeld (CSV-Spalte bzw. Canonical-Feld). */
export interface StatusFeldEintrag {
  /** Normalisierter Feldname (Canonical-Field-Key, z.B. `status`, `verbund_status`). */
  feldId: string;
  label: string;
  /** `datum`-Felder: das Datum IST das Event (kein Wert-Enum). */
  typ: 'wert' | 'datum';
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
