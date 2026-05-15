/**
 * Plugin "auslastung" — Typen.
 *
 * MAs werden im gesamten Modul ausschliesslich ueber anonyme IDs (MA01-MA30)
 * referenziert. Die De-Anonymisierung passiert nur im Export-Moment im RAM
 * (kommt in Prompt 2). `auslastung.json` enthaelt KEINE echten Kuerzel.
 */

export type KategorieFarbe =
  | 'blue' | 'amber' | 'emerald' | 'rose' | 'violet' | 'sky' | 'slate';

export const KATEGORIE_FARBEN: KategorieFarbe[] = [
  'blue', 'emerald', 'amber', 'rose', 'violet', 'sky', 'slate',
];

/** Quelle eines Deskriptoren-Werts. */
export type DeskriptorenSpalte =
  | 'techn_1' | 'techn_2' | 'techn_3' | 'techn_4' | 'techn_5'
  | 'branche' | 'branche_2' | 'branche_3' | 'branche_4' | 'branche_5'
  | 'anwendung_1' | 'anwendung_2';

export const ALL_DESKRIPTOREN_SPALTEN: DeskriptorenSpalte[] = [
  'techn_1', 'techn_2', 'techn_3', 'techn_4', 'techn_5',
  'branche', 'branche_2', 'branche_3', 'branche_4', 'branche_5',
  'anwendung_1', 'anwendung_2',
];

/** Eine Ueberkategorie. PL konfiguriert die im Setup-Wizard. */
export interface UeberKategorie {
  id: string;                 // z.B. "IKT" (PL-frei)
  name: string;               // Klarname, z.B. "Informations- und Kommunikationstechnologie"
  farbe: KategorieFarbe;
  /** Deskriptoren-Werte (case-insensitive, normalisiert), die dieser Kategorie zugeordnet sind. */
  deskriptorenMapping: string[];
  /** Centroid-Embedding aus historischen Antraegen dieser Kategorie. Optional, leer bis Corpus gebaut. */
  referenzEmbedding?: number[];
}

/** Stufe-1-Vorschlag oder Stufe-2-Vorschlag pro Antrag. */
export interface KategorieVorschlag {
  kategorieId: string;
  confidence: number;        // 0..1
  methode: 'regel' | 'embedding';
}

export interface Klassifizierung {
  antragId: string;          // aktenzeichen
  vorgeschlageneKategorien: KategorieVorschlag[];
  /** Nach PL-Review — 1..2 Kategorien. Leer = noch nicht reviewed. */
  freigegebeneKategorien: string[];
  status: 'vorgeschlagen' | 'freigegeben';
  /** ISO-Datum der PL-Freigabe (Trigger fuer Selbsteintragungs-Frist). */
  freigegebenAm?: string;
}

/** Globale Auslastungs-Config (PL-gepflegt). */
export interface AuslastungConfig {
  stundenProTV: number;
  aktuellesQuartal: string;          // "2026-Q2"
  gewichtungKompetenz: number;       // 0..1
  gewichtungBalance: number;         // 0..1, in Praxis 1 - gewichtungKompetenz
  ueberKategorien: UeberKategorie[];
  /** Multi-Label-Schwellwert: Differenz Top-1 vs Top-2 fuer Multi-Label. */
  klassifizierungsSchwellwert: number;
  /** Tage bis automatische PL-Zuweisung nach Klassifizierungs-Freigabe. */
  selbsteintragungFristTage: number;
  /** Default false; PL aktiviert nach Corpus-Build. */
  stage2Aktiv: boolean;
  embeddingCorpusBuiltAt?: string;   // ISO
  /** Setup-Wizard zwingend durchlaufen? False = noch nicht. */
  setupAbgeschlossen: boolean;
}

/** Pro MA: virtuelle Projekte aus Onboarding-Swipe (kommt in Prompt 2). */
export interface VirtuellesProjekt {
  antragId: string;
  /** 0.3 (teilweise), 0.5 (Freitext), 0.7 (ja), 1.0 (echt). */
  confidence: number;
}

export interface AnonymerMitarbeiter {
  anonId: string;                  // "MA01"
  jahresKapazitaet: number;        // Stunden/Jahr
  abgemeldet: string[];            // Quartal-Liste
  manuelleTechnologien: string[];
  /** In welchen Ueberkategorien arbeitet der MA. */
  ueberKategorien: string[];
  virtuelleProjekte: VirtuellesProjekt[];
  profilEmbeddingText?: string;
  onboardingAbgeschlossen: boolean;
}

export interface Zuweisung {
  antragId: string;
  anonId: string;
  quartal: string;
  stunden: number;
  status: 'vorgeschlagen' | 'freigegeben' | 'abgelehnt' | 'selbst';
  freigegebenAm?: string;
  selbstEingetragen?: boolean;
}

/** Top-Level: kommt als JSON auf den SMB-Share. */
export interface AuslastungData {
  version: 1;
  updatedAt: string;
  config: AuslastungConfig;
  /** Key = anonId. */
  mitarbeiter: Record<string, AnonymerMitarbeiter>;
  klassifizierungen: Klassifizierung[];
  zuweisungen: Zuweisung[];
}

// ───────────────────────────────────────────────────────────────────────────
// Match-Output (Engine -> UI)
// ───────────────────────────────────────────────────────────────────────────

export interface AehnlichesProjekt {
  aktenzeichen: string;
  titel?: string;
  similarity: number;
}

export interface MatchResult {
  anonId: string;
  bm25Score: number;
  embeddingScore: number;
  kompetenzScore: number;
  restKapazitaet: number;
  quartalsKapazitaet: number;
  balanceScore: number;
  finalScore: number;
  matchendeTechnologien: string[];
  aehnlicheProjekte: AehnlichesProjekt[];
  matchStufe: 1 | 2 | 3;
  confidence: 'high' | 'medium' | 'low';
  benoetigteStunden: number;
}

// ───────────────────────────────────────────────────────────────────────────
// Konstanten
// ───────────────────────────────────────────────────────────────────────────

/** SMB-Share Pfad fuer Auslastungs-Daten. */
export const AUSLASTUNG_JSON_PATH = '_intern/auslastung/data.json';

/** IDB-kv-Prefix fuer Embedding-Cache. */
export const AUSLASTUNG_EMB_PREFIX = 'auslastung-emb:';

/** Canonical-Field-Keys aus dem CSV-Schema. */
export const CANONICAL_AKTENZEICHEN = 'aktenzeichen';
export const CANONICAL_TIB_KUERZ = 'tib_kuerz';
export const CANONICAL_VERBUND_ID = 'verbund_id';
export const CANONICAL_VERBUND_TITEL = 'verbund_titel';
export const CANONICAL_TITEL = 'titel';
export const CANONICAL_AKRONYM = 'akronym';

/** Custom-Field-Keys (nicht canonical, ueber antrag[key] erreichbar). */
export const FIELD_PROJEKTBESCHREIBUNG = 'projektbeschreibung_text';

export const DEFAULT_AUSLASTUNG_CONFIG: AuslastungConfig = {
  stundenProTV: 10,
  aktuellesQuartal: deriveCurrentQuartal(),
  gewichtungKompetenz: 0.7,
  gewichtungBalance: 0.3,
  ueberKategorien: [],
  klassifizierungsSchwellwert: 0.15,
  selbsteintragungFristTage: 14,
  stage2Aktiv: false,
  setupAbgeschlossen: false,
};

export function deriveCurrentQuartal(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const q = Math.floor(m / 3) + 1;
  return `${year}-Q${q}`;
}

export function emptyAuslastungData(): AuslastungData {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    config: { ...DEFAULT_AUSLASTUNG_CONFIG },
    mitarbeiter: {},
    klassifizierungen: [],
    zuweisungen: [],
  };
}
