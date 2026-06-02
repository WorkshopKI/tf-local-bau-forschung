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

/**
 * Quelle eines Deskriptoren-Werts.
 *
 * Bewusste Beschraenkung auf die TECHN_*-String-Spalten — die echten
 * Technologie-Deskriptoren eines Antrags. BRANCHE_* (Wirtschaftszweige) und
 * ANWEND_* (Anwendungsdomaenen) bleiben absichtlich draussen, weil sie sonst
 * z.B. einen KI-Bearbeiter faelschlich als Pflanzen-/Bautechnologie-Experten
 * markieren wuerden (KI als Querschnittsthema in vielen Branchen). Die 46
 * ZT_*-Boolean-Spalten (Zukunftstechnologien) werden in
 * `readAntragDeskriptoren()` aus `ZUKUNFTSTECHNOLOGIE_FELDER` separat
 * eingelesen — nicht ueber diesen Typ.
 */
export type DeskriptorenSpalte =
  | 'techn_1' | 'techn_2' | 'techn_3' | 'techn_4' | 'techn_5';

export const ALL_DESKRIPTOREN_SPALTEN: DeskriptorenSpalte[] = [
  'techn_1', 'techn_2', 'techn_3', 'techn_4', 'techn_5',
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

/** Stufe-1-Vorschlag oder Stufe-2-Vorschlag pro Antrag.
 *  Methode-Wertebereich seit Workflow-Revision 1.17: zusaetzlich 'llm' und
 *  'manuell' fuer LLM-Batch-Klassifizierung bzw. PL-Korrektur. */
export interface KategorieVorschlag {
  kategorieId: string;
  confidence: number;        // 0..1
  methode: 'regel' | 'embedding' | 'llm' | 'manuell';
}

/** Vorgeschlagene Primaerkategorie eines Antrags (mit Methode + optionaler
 *  LLM-Begruendung). Workflow-Revision 1.17: ersetzt das Multi-Label-Modell. */
export interface PrimaerVorschlag {
  kategorieId: string;
  confidence: number;
  methode: 'regel' | 'embedding' | 'llm' | 'manuell';
  /** Nur bei methode='llm' gesetzt — Kurzbegruendung vom Modell. */
  begruendung?: string;
}

/** Vorgeschlagener Aspekt — Querschnittstechnologie die im Antrag steckt,
 *  aber NICHT das Kernthema ist. Beispiel: KI als Werkzeug in einem
 *  Maschinenbau-Antrag (primaer=IT, aspekte=[DT]). */
export interface AspektVorschlag {
  kategorieId: string;
  confidence: number;
}

export interface Klassifizierung {
  antragId: string;          // aktenzeichen

  // Workflow-Revision 1.17: Primaer + Aspekte (seit v2.3 required;
  // Migration aus Pre-1.17-Daten passiert in normalizeKlassifizierungArray).
  /** Genau eine Primaerkategorie. `null` = noch keine Klassifizierung. */
  vorgeschlagenePrimaer: PrimaerVorschlag | null;
  /** 0..n Aspekte (Querschnittstechnologien), sortiert nach Confidence desc. */
  vorgeschlageneAspekte: AspektVorschlag[];
  /** Nach PL-Review — genau eine Primaerkategorie. '' = noch nicht reviewed. */
  freigegebenePrimaer: string;
  /** Nach PL-Review — 0..n Aspekte. */
  freigegebeneAspekte: string[];

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
  /** Schwellwert fuer Aspekt-Erkennung in der Klassifizierung: Wenn Top-2
   *  weniger als `klassifizierungsSchwellwert` hinter Top-1 liegt, wird
   *  Top-2 als Aspekt aufgenommen (statt verworfen). Default 0.15. */
  klassifizierungsSchwellwert: number;
  /** Tage bis automatische PL-Zuweisung nach Klassifizierungs-Freigabe. */
  selbsteintragungFristTage: number;
  /** Embedding-basierte Themen-Erkennung (Cosine-Similarity gegen
   *  Kategorie-Centroids). Seit Mai 2026 immer aktiv — der frühere Toggle
   *  wurde entfernt, das Feld bleibt aus Datenmodell-Kompat-Gruenden im
   *  Schema und wird beim Load auf `true` migriert. */
  stage2Aktiv: boolean;
  embeddingCorpusBuiltAt?: string;   // ISO
  /** Setup-Wizard zwingend durchlaufen? False = noch nicht. */
  setupAbgeschlossen: boolean;

  // ─── Workflow-Revision 1.17 ──────────────────────────────────────────
  /** Durchschnittliche Anzahl Teilvorhaben pro Verbund — wird fuer die
   *  Anzeige-Umrechnung "Stunden → Antraege" verwendet. Stunden bleiben
   *  intern (Berechnungs-Einheit), User-facing zeigen wir Antraege.
   *  Default 2. */
  durchschnittTVproAntrag: number;
  /** Quartals-Ende-Bonus: in den letzten N Tagen eines Quartals bekommen
   *  ueberbuchte MAs einen sanfteren Malus (weil das naechste Quartal ja
   *  bald startet). Default 21 Tage. */
  quartalsEndeBonusTage: number;
  /** Bonus zum Kompetenz-Score pro Aspekt-Treffer (Antrag-Aspekt matched
   *  MA-Nebenkategorie). Default 0.10. */
  aspektBonus: number;

  // ─── v2.15: PL-Kompetenz-Vorbelegung ────────────────────────────────
  /** Gewicht des Kompetenz-Levels (0..1) im Matcher: skaliert den Kompetenz-
   *  Score mit `(1-w) + w * normLevel(Primärkat.)`. 0 = Level ignoriert (altes
   *  Verhalten), 1 = voll. Default 0.3. */
  kompetenzLevelGewicht: number;
  /** Gewicht des Antragstyp-Kontingents (0..1) im Matcher: skaliert den
   *  finalScore mit `(1-w) + w * kontingentScore`. MAs mit erschöpftem Typ-
   *  Kontingent rutschen sanft ab (kein harter Filter). Default 0.3. */
  kontingentGewicht: number;
  /** Stärke des MULTIPLIKATIVEN Kapazitäts-Malus (0..1): skaliert den finalScore
   *  mit `(1-m) + m * kapScore`. Damit fallen ausgelastete MAs deutlich ab —
   *  praktisch immer unter MAs mit freier Kapazität — ohne harten Filter (volle
   *  MAs bleiben im Notfall sichtbar). 0 = aus (altes rein additives Verhalten),
   *  1 = maximal. Default 0.6. */
  auslastungMalus?: number;
  /** Schwelle für „wenig historische Anträge": MAs mit weniger als so vielen
   *  bearbeiteten Anträgen bekommen — sofern eine Kompetenz-Matrix vorliegt —
   *  ein erhöhtes Level-Gewicht (`kompetenzMatrixSparseGewicht`), weil ihr BM25-/
   *  Embedding-Signal dünn ist. Default 5. */
  kompetenzMatrixSparseSchwelle?: number;
  /** Erhöhtes `kompetenzLevelGewicht` (0..1) für MAs unter der Sparse-Schwelle
   *  mit Kompetenz-Matrix. Lässt die PL-Kompetenzbewertung dominieren statt der
   *  dünnen Historie. Default 0.7. */
  kompetenzMatrixSparseGewicht?: number;
  /** Token-Multiplikator für PL-gesetzte manuelle Technologien
   *  (`technologienQuelle === 'pl'`) im BM25-Profil-Doc: jedes Tag wird so oft
   *  als Token eingewoben (höhere Term-Frequenz = stärkeres Match). Default 2.
   *  MA-eigene Tags (`'ma'`) bleiben 1×. */
  plTechnologieGewicht?: number;
  /** Spalten-Schema der Kompetenz-Matrix (Überkat. → Unterkat.-Labels), gesetzt
   *  beim PL-XLSX-Upload. Quelle der Wahrheit für die editierbare Matrix-Tabelle.
   *  Optional → fehlt vor dem ersten Upload. */
  kompetenzSchema?: KompetenzSchemaEntry[];

  // ─── v2.12: Zugangspasswort-Versand per E-Mail ──────────────────────
  /** Betreff-Vorlage fuer den „✉ E-Mail"-Link im Passwort-Dialog. Platzhalter
   *  `{kuerzel}` `{passwort}` `{anonId}`. Optional → Default greift. */
  zugangEmailBetreff?: string;
  /** Body-Vorlage fuer den E-Mail-Versand. Gleiche Platzhalter. Optional. */
  zugangEmailVorlage?: string;
}

/**
 * Antragstyp-Bucket (v2.2) — spiegelt das UI-Filter-Schema der Foerderantraege-
 * Liste (`KategorieLabel` aus `kategorieQuickfilter.ts`). Mappt auf `vb_phase`:
 *  - FuE → 3
 *  - DS  → 5
 *  - DL  → 4
 *  - NW  → 1 oder 2
 *  (Irrlaeufer = vb_phase 9 → kein Bucket, wird nie matched.)
 *
 * Persistiert pro MA in `antragstypBevorzugt` + `antragstypUeberschreibung`.
 */
export type AntragstypBucket = 'FuE' | 'DS' | 'DL' | 'NW';

export const ALL_ANTRAGSTYP_BUCKETS: AntragstypBucket[] = ['FuE', 'DS', 'DL', 'NW'];

/**
 * v2.6: Selbst-Profil eines MA, geschrieben in den persoenlichen Ordner
 * (`ZAH/auslastung-profil.json`). Enthaelt ausschliesslich die
 * MA-pflegbaren Felder — der PL-Einsammel-Schritt
 * (`profil-einsammeln.ts:mergeProfilesIntoMitarbeiter`) merged sie ueber das
 * `kuerzel` in `auslastung.json`, ohne PL-only-Felder (`jahresKapazitaet`,
 * `abschlagProzent`, `aktiv`, `abgemeldet`, `antragstypUeberschreibung`) zu
 * ueberschreiben.
 *
 * Hintergrund: Nicht-Kuratoren haben seit v2.0 nur `read` auf dem Daten-Share
 * und koennen `auslastung.json` nicht direkt schreiben (siehe CLAUDE.md).
 */
export interface PersoenlichesAuslastungProfil {
  version: 1;
  /** Echtes Bearbeiter-Kuerzel. Roh gespeichert; der Einsammel-Schritt
   *  normalisiert via `normalizeKuerzel` (NFC + uppercase, Pitfall #22). */
  kuerzel: string;
  manuelleTechnologien: string[];
  ausgeblendeteAutoTags: string[];
  hauptKategorie: string;
  nebenKategorien: string[];
  antragstypBevorzugt: AntragstypBucket[];
  updatedAt: string;
}

/** IDB-Cache-Key fuer das eigene Auslastungs-Selbst-Profil. Cross-Browser-
 *  Fallback (Pitfall: IDB ist browser-scoped) — der persoenliche Ordner bleibt
 *  Source-of-Truth, der Cache ueberbrueckt Offline-Starts. */
export const PERSOENLICH_AUSLASTUNG_PROFIL_IDB_KEY = 'personal-auslastung-profil-cache';

/**
 * Ein einzelner Übernahme-Wunsch („Kann ich übernehmen") eines MA. Wird im
 * persoenlichen Ordner gehalten (read-only-Daten-Share-Workaround, v2.9) und
 * beim PL-Einsammeln zu einer `Zuweisung{status:'selbst'}` gemerged.
 */
export interface UebernahmeWunsch {
  /** Aktenzeichen des Antrags (Lead-TV des Verbunds, wie auf der Homepage angezeigt). */
  antragId: string;
  quartal: string;
  /** TV-Anzahl des Verbunds zum Klick-Zeitpunkt — fuer Pending-Anzeige + Stunden-
   *  Berechnung beim Merge (anzahlTV × stundenProTV). */
  anzahlTV: number;
  createdAt: string;
}

/**
 * MA-Selbst-Datei mit allen offenen Übernahme-Wünschen. Append/Remove statt
 * Single-Wert, weil ein MA mehrere Anträge gleichzeitig vormerken kann. Die
 * PL reconciled beim Einsammeln gegen diese Liste (Retraktion = Wunsch fehlt).
 */
export interface PersoenlicheUebernahmeWuensche {
  version: 1;
  /** Rohes Bearbeiter-Kuerzel; der Einsammel-Schritt normalisiert via
   *  `normalizeKuerzel` (NFC + uppercase, Pitfall #22). */
  kuerzel: string;
  wuensche: UebernahmeWunsch[];
  updatedAt: string;
}

/** IDB-Cache-Key fuer die eigenen Übernahme-Wünsche (Cross-Browser-Fallback,
 *  analog zum Profil-Cache — persoenlicher Ordner bleibt Source-of-Truth). */
export const PERSOENLICH_AUSLASTUNG_UEBERNAHME_IDB_KEY = 'personal-auslastung-uebernahme-cache';

/** Pro MA: virtuelle Projekte aus Onboarding-Swipe (kommt in Prompt 2). */
export interface VirtuellesProjekt {
  antragId: string;
  /** 0.3 (teilweise), 0.5 (Freitext), 0.7 (ja), 1.0 (echt). */
  confidence: number;
}

// ─── v2.15: PL-Kompetenz-Vorbelegung ────────────────────────────────────────
/** Kompetenz-Level einer Unterkategorie: 1=Grundkenntnisse, 2=vertiefte
 *  Kenntnisse, 3=Expertenwissen. */
export type KompetenzLevel = 1 | 2 | 3;

/** PL-gepflegte Kompetenz-Matrix eines MA: ÜberkatID → (Unterkat.-Label → Level).
 *  Quelle ist der PL-XLSX-Upload (`kompetenz-import.ts`). Unterkat.-Labels werden
 *  getrimmt gespeichert; ihre Reihenfolge + Anzeige-Namen stehen im
 *  `kompetenzSchema` der Config. */
export type KompetenzMatrix = Partial<Record<UeberkategorieId, Record<string, KompetenzLevel>>>;

/** Eine Überkategorie-Spaltengruppe im Kompetenz-Schema (Reihenfolge wie im
 *  hochgeladenen XLSX). */
export interface KompetenzSchemaEntry {
  ueberId: UeberkategorieId;
  /** Anzeige-Label der Überkategorie (XLSX-Header Zeile 1). */
  label: string;
  /** Geordnete Unterkategorie-Labels (XLSX-Header Zeile 2), getrimmt. */
  subKategorien: string[];
}

export interface AnonymerMitarbeiter {
  anonId: string;                  // "MA01"
  /** @deprecated (Juni 2026) Wird nicht mehr gelesen/editiert. Die effektiven
   *  Jahresstunden = Summe der Typ-Stunden (`jahresKapazitaetProTyp`), abgeleitet
   *  via `effektiveJahresStunden()`. Feld bleibt für Legacy-Daten/Migration. */
  jahresKapazitaet: number;        // Stunden/Jahr (deprecated)
  abgemeldet: string[];            // Quartal-Liste
  manuelleTechnologien: string[];
  /** Negativ-Liste: aus den historischen Antraegen aggregierte Tags, die der
   *  MA bewusst ausgeblendet hat (z.B. weil sie nicht zur fachlichen
   *  Kompetenz passen — KI-Querschnittstaeter mit Antraegen in vielen
   *  Branchen-Kontexten). Stored als lowercase-normalisierte Strings; matched
   *  gegen das Output von `readAntragDeskriptoren()`. Auto-Aggregation laeuft
   *  weiter, aber gefilterte Tags fliessen nicht ins Team-Profil. */
  ausgeblendeteAutoTags: string[];

  // Workflow-Revision 1.17: Haupt + Neben (seit v2.3 required;
  // Migration aus Pre-1.17-`ueberKategorien` passiert in normalizeMitarbeiterRecord).
  /** Genau eine Hauptkategorie — "Ich bearbeite grundsaetzlich Antraege
   *  aus diesem Bereich". Bestimmt den Pool fuer Selbsteintragung +
   *  Matching. '' = nicht gesetzt (Setup unvollstaendig). */
  hauptKategorie: string;
  /** 0..n Nebenkategorien — "Bei Antraegen mit diesen Aspekten werde
   *  ich bevorzugt vorgeschlagen". Triggert Aspekt-Bonus im Matching. */
  nebenKategorien: string[];
  /** Pauschal-Abschlag auf die Quartals-Kapazitaet, 0–100. Typischer
   *  Use-Case: 25% fuer QS-MAs die einen Teil ihrer Zeit fuer
   *  Querschnittsthemen aufwenden. Default 0. */
  abschlagProzent: number;

  // ─── Workflow-Revision v2.2: Antragstyp-Praeferenzen ─────────────────
  /** Vom MA selbst gepflegte Praeferenz, welche Antragstypen er bearbeitet
   *  (FuE/DS/DL/NW). Leeres Array oder undefined = alle erlaubt
   *  (Backwards-Kompat). Wirkt sich auf Selbsteintragung + Matching aus. */
  antragstypBevorzugt?: AntragstypBucket[];
  /** PL-Override. Hat Vorrang vor `antragstypBevorzugt` wenn nicht-leer.
   *  Use-Case: PL stellt fuer den MA temporaer einen engeren Filter ein
   *  (z.B. wegen Auslastung in einem Bereich). Leeres Array oder
   *  undefined = MA-Praeferenz gilt. */
  antragstypUeberschreibung?: AntragstypBucket[];

  virtuelleProjekte: VirtuellesProjekt[];
  profilEmbeddingText?: string;
  onboardingAbgeschlossen: boolean;
  /** false = ehemaliger Bearbeiter / nicht mehr im Programm. UI + Matching
   *  blenden inaktive MAs aus; ihre historischen Antraege bleiben aber im
   *  Embedding-Corpus als Kompetenz-Referenz. Default beim Anlegen: true.
   *  Migration alter Daten: ebenfalls true (PL deaktiviert manuell via
   *  Admin-Tab oder ueber den Auto-Vorschlag-Banner). */
  aktiv: boolean;

  // ─── v2.15: PL-Kompetenz-Vorbelegung ─────────────────────────────────
  /** PL-vorbelegte Kompetenz-Matrix (Level 1/2/3 pro Unterkategorie). Optional;
   *  fehlt bei MAs ohne PL-Upload. Speist die Matcher-Gewichtung (Überkat.-Faktor
   *  in der Engine + level-gewichtete BM25-Tokens). */
  kompetenzMatrix?: KompetenzMatrix;
  /** Kapazität pro Antragstyp in **Stunden/Jahr**, PL-gepflegt in der Kompetenz-
   *  Matrix. Einzige Kapazitätsquelle: Summe = effektive Jahresstunden
   *  (`effektiveJahresStunden`); fehlt → 0 (keine Kapazität, keine Pro-Typ-
   *  Deckelung im Matcher). */
  jahresKapazitaetProTyp?: Partial<Record<AntragstypBucket, number>>;
  /** Provenienz der abgeleiteten Kategorien — 'pl-upload' wenn aus der
   *  Kompetenz-XLSX vorbelegt (nur UI-Kennzeichnung). */
  kompetenzQuelle?: 'pl-upload';
  /** Herkunft von `manuelleTechnologien`: 'pl' = von der PL als Vorbelegung
   *  eingetragen (im Matcher höher gewichtet, siehe `plTechnologieGewicht`),
   *  'ma' = vom MA selbst gepflegt (normales Gewicht, kippt beim Profil-
   *  Einsammeln). Undefined = neutral/Legacy (wie 'ma' behandelt). */
  technologienQuelle?: 'pl' | 'ma';
}

export interface Zuweisung {
  antragId: string;
  anonId: string;
  quartal: string;
  stunden: number;
  status: 'vorgeschlagen' | 'freigegeben' | 'abgelehnt' | 'selbst';
  freigegebenAm?: string;
  selbstEingetragen?: boolean;
  /** ISO-Zeitpunkt, zu dem der MA „Kann ich übernehmen" geklickt hat (v2.9).
   *  Stammt aus `UebernahmeWunsch.createdAt`. Erlaubt der PL, bei mehreren
   *  Interessenten zu sehen, wer zuerst wollte (Sortierung asc). Nur fuer
   *  `status:'selbst'`-Eintraege gesetzt. */
  selbstEingetragenAm?: string;
  /** Echte TV-Anzahl des Verbunds (aus CSV). Wenn nicht gesetzt: 1.
   *  Workflow-Revision 1.17 — wird fuer die "Antraege statt Stunden"-Anzeige
   *  benoetigt, damit ein 4-TV-Verbund nicht wie ein 1-TV-Antrag wirkt. */
  anzahlTV?: number;
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
  /** Kalibrierungs-Ergebnisse aus Feature 4b. Optional. */
  kalibrierung?: KalibrierungsState;
}

// ───────────────────────────────────────────────────────────────────────────
// Onboarding + Kalibrierung
// ───────────────────────────────────────────────────────────────────────────

/** Default-Confidence pro Onboarding-Bewertung. */
export const ONBOARDING_CONFIDENCE = {
  kann_ich: 0.7,
  teilweise: 0.3,
  nicht_meins: 0,
} as const;

export type OnboardingBewertung = 'kann_ich' | 'teilweise' | 'nicht_meins';

/** Eintrag aus dem Antrags-Swipe. */
export interface OnboardingBewertungEintrag {
  aktenzeichen: string;
  /** Deskriptoren-Kategorie aus dem Antrag (z.B. "Werkstofftechnik"). */
  kategorie: string;
  /** Abgeleitete Ueberkategorie (z.B. "IND"). */
  ueberKategorie?: string;
  /** VB-Titel (gekuerzt) — fuer Preview. */
  vbTitel?: string;
  bewertung: OnboardingBewertung;
}

/** Ergebnis einer einzelnen Kalibrierungs-Iteration (1 MA, 1 Run). */
export interface KalibrierungsErgebnis {
  anonId: string;
  spearmanKorrelation: number;          // -1..1
  top3Overlap: number;                  // 0..1
  klassifizierungsAccuracy: number;     // 0..1
  anzahlAntraege: number;
  datum: string;                        // ISO
}

export interface KalibrierungsState {
  ergebnisse: KalibrierungsErgebnis[];
  optimaleConfidenceKannIch: number;    // default 0.7
  optimaleConfidenceTeilweise: number;  // default 0.3
  letzteKalibrierung?: string;
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
  /** Anzahl frueherer Antraege dieses MAs vom selben AST (0 = kein Match). */
  astMatchCount: number;
  /** Roher Boost-Beitrag aus dem AST-Match (Score-Komponente). */
  astBoost: number;

  // ─── Workflow-Revision 1.17 — optional waehrend Migration ───────────
  /** Weiches Kapazitaets-Modell: 0..1+ Score statt hartem Filter. 1.0 =
   *  reichlich Kapazitaet, 0..1 = knapper, < 0.2 = ueberbucht. Quartals-
   *  Ende-Bonus eingepreist. */
  kapazitaetsScore?: number;
  /** Bonus-Beitrag aus Aspekt-Matches (Anzahl Treffer × config.aspektBonus). */
  aspektBonus?: number;
  /** Welche Antrag-Aspekte matched diese MA-Nebenkategorien? */
  aspektMatchIds?: string[];
  /** Stunden ueber dem Limit. > 0 bei Ueberbuchung, sonst 0. */
  ueberbuchung?: number;

  // ─── v2.15: Antragstyp-Kontingent ───────────────────────────────────
  /** Kontingent-Score (0..1) fuer den Antragstyp dieses Antrags: 1.0 = kein
   *  Limit oder Rest vorhanden, < 1 wenn das Typ-Kontingent des MAs knapp/
   *  erschoepft ist. */
  kontingentScore?: number;
  /** Verbleibendes Quartals-Kontingent (TVs) fuer diesen Antragstyp, oder
   *  undefined = kein Limit gesetzt. */
  kontingentRest?: number;
  /** Quartals-Kontingent (TVs) fuer diesen Antragstyp, oder undefined =
   *  kein Limit. Fuer die „v/N frei"-Anzeige im Vorschlag (v2.16). */
  kontingentQuartal?: number;
}

// ───────────────────────────────────────────────────────────────────────────
// Konstanten
// ───────────────────────────────────────────────────────────────────────────

/** SMB-Share Pfad fuer Auslastungs-Daten. */
export const AUSLASTUNG_JSON_PATH = '_intern/auslastung.json';

/** Legacy-Pfad vor Mai 2026 — wird beim Laden als Fallback gelesen, danach
 *  beim ersten Save auf den neuen `AUSLASTUNG_JSON_PATH` umgeschrieben. */
export const AUSLASTUNG_JSON_PATH_LEGACY = '_intern/auslastung/data.json';

/** IDB-kv-Prefix fuer Embedding-Cache. */
export const AUSLASTUNG_EMB_PREFIX = 'auslastung-emb:';

/** Canonical-Field-Keys aus dem CSV-Schema. */
export const CANONICAL_AKTENZEICHEN = 'aktenzeichen';
export const CANONICAL_TIB_KUERZ = 'tib_kuerz';
/** Administrativer Bearbeiter (BIB_KUERZ aus dem Foyer-Schema). Wird im
 *  Auslastungs-Modul ausschliesslich informativ angezeigt — nicht Teil der
 *  AnonymMap (siehe CLAUDE.md Pitfall #17), keine zu-verteilende Ressource. */
export const CANONICAL_BIB_KUERZ = 'bib_kuerz';
/** E-Mail des TiB-Bearbeiters (v2.12) — Empfaenger fuer den Zugangspasswort-Versand. */
export const CANONICAL_TIB_MAIL = 'tib_mail';
export const CANONICAL_VERBUND_ID = 'verbund_id';
export const CANONICAL_VERBUND_TITEL = 'verbund_titel';
export const CANONICAL_TITEL = 'titel';
export const CANONICAL_AKRONYM = 'akronym';
/** ISO-Datum YYYY-MM-DD — fuer Aktiv-Heuristik "Antraege im aktuellen Jahr". */
export const CANONICAL_ANTRAGSDATUM = 'antragsdatum';

/** Custom-Field-Keys (nicht canonical, ueber antrag[key] erreichbar). */
/** VB_Inhalt aus dem Foyer-Schema — Inhalts-Zusammenfassung des Vorhabens,
 *  vom Bearbeiter nach Bewilligung gepflegt. Nur fuer historische Antraege. */
export const FIELD_PROJEKTBESCHREIBUNG = 'projektbeschreibung_text';
/** Inhalts-Zusammenfassung des Vorhabens vom Antragsteller (100–300 Worte).
 *  Wird mit dem Antrag eingereicht — verfuegbar fuer neue Antraege, sobald
 *  elektronisch erfasst. Aktuell noch nicht im Schema; das Feld wird im
 *  Verbund-Embedding optional gelesen. */
export const FIELD_VORHABEN_ZUSAMMENFASSUNG_AST = 'vorhaben_zusammenfassung_ast';
/** Aus der PDF-Vorhabensbeschreibung LLM-extrahierte Zusammenfassung. Wie
 *  AST-Zusammenfassung, nur automatisch erzeugt. Auch noch nicht im Schema. */
export const FIELD_VORHABEN_ZUSAMMENFASSUNG_PDF = 'vorhaben_zusammenfassung_pdf';
/** Antragsteller-Typ aus Foyer (ATTR_AUFB). Verteilt im Auslastungs-Match-
 *  Boost: Unternehmen sind thematisch konsistent (starker Boost bei
 *  Wiederholungs-AST), Forschungseinrichtungen breit aufgestellt (schwacher
 *  Boost). */
export const FIELD_AST_TYP = 'ast_typ';
export type AstTyp = 'U' | 'F' | '';

/**
 * 5 vordefinierte Ueberkategorien aus dem FZD-Kontext (Mai 2026).
 * Wird beim ersten Setup als pre-filled angeboten. PL kann im Admin
 * umbenennen, Farben aendern, oder zusaetzliche Kategorien anlegen.
 *
 * Default-Mapping (welche Deskriptoren-Werte gehoeren zu welcher Kategorie)
 * wird zur Build-Zeit aus _labels/*.xlsx generiert + um eine Substring-
 * Heuristik ergaenzt — siehe `services/default-labels.ts`.
 */
import {
  KATEGORIE_KEYWORD_HEURISTIK,
  ZUKUNFTSTECHNOLOGIE_FELDER,
  type UeberkategorieId,
} from './services/default-labels';

function deriveDefaultMappingFor(id: UeberkategorieId): string[] {
  const zt = ZUKUNFTSTECHNOLOGIE_FELDER
    .filter(z => z.defaultUeberKategorie === id)
    .map(z => z.klartext);
  return [...new Set([...zt, ...KATEGORIE_KEYWORD_HEURISTIK[id]])];
}

export const DEFAULT_UEBERKATEGORIEN: UeberKategorie[] = [
  { id: 'IT', name: 'Industrielle Technologien',                  farbe: 'slate',   deskriptorenMapping: deriveDefaultMappingFor('IT') },
  { id: 'DT', name: 'Digitale Technologien',                       farbe: 'blue',    deskriptorenMapping: deriveDefaultMappingFor('DT') },
  { id: 'EU', name: 'Energie- und Umwelttechnologien',             farbe: 'emerald', deskriptorenMapping: deriveDefaultMappingFor('EU') },
  { id: 'LG', name: 'Lebens- und Gesundheitswissenschaften',       farbe: 'rose',    deskriptorenMapping: deriveDefaultMappingFor('LG') },
  { id: 'NM', name: 'Naturwissenschaftliche Methoden',             farbe: 'violet',  deskriptorenMapping: deriveDefaultMappingFor('NM') },
];

/**
 * Default-Jahreskapazitaet pro MA in Stunden — ~Halbzeit-Aequivalent
 * (PL faengt im Auslastungs-Modul typischerweise mit der Annahme an, dass
 * MAs nur einen Teil ihrer Zeit fuer Antragsbearbeitung haben — Rest ist
 * andere Projekte, Verwaltung, Urlaub). PL kann pro MA im Admin
 * ueberschreiben.
 */
export const DEFAULT_JAHRESKAPAZITAET = 800;

/** v2.12: Default-Vorlage fuer den Zugangspasswort-Versand. PL-editierbar in
 *  der Konfiguration (Uebersicht-Tab). Platzhalter `{kuerzel}` `{passwort}`. */
export const DEFAULT_ZUGANG_EMAIL_BETREFF = 'Ihre Zugangsdaten für die Förderanträge-App';
export const DEFAULT_ZUGANG_EMAIL_VORLAGE =
  'Hallo {kuerzel},\n\n' +
  'dein persönliches Passwort für die Förderanträge-App lautet:\n\n' +
  '{passwort}\n\n' +
  'Bitte sicher aufbewahren. Beim Start der App gibst du nur dieses Passwort ein — ' +
  'dein Kürzel wird daraus automatisch ermittelt.\n\n' +
  'Viele Grüße\nDie Projektleitung';

export const DEFAULT_AUSLASTUNG_CONFIG: AuslastungConfig = {
  stundenProTV: 9,
  aktuellesQuartal: deriveCurrentQuartal(),
  gewichtungKompetenz: 0.7,
  gewichtungBalance: 0.3,
  ueberKategorien: DEFAULT_UEBERKATEGORIEN,
  klassifizierungsSchwellwert: 0.15,
  selbsteintragungFristTage: 7,
  stage2Aktiv: true,
  setupAbgeschlossen: false,
  // Workflow-Revision 1.17
  durchschnittTVproAntrag: 2,
  quartalsEndeBonusTage: 21,
  aspektBonus: 0.10,
  // v2.15: PL-Kompetenz-Vorbelegung
  kompetenzLevelGewicht: 0.3,
  kontingentGewicht: 0.3,
  // Multiplikativer Kapazitäts-Malus (ausgelastete MAs deutlich abwerten)
  auslastungMalus: 0.6,
  // Wenig-Historie-Boost + PL-Technologie-Gewicht
  kompetenzMatrixSparseSchwelle: 5,
  kompetenzMatrixSparseGewicht: 0.7,
  plTechnologieGewicht: 2,
  zugangEmailBetreff: DEFAULT_ZUGANG_EMAIL_BETREFF,
  zugangEmailVorlage: DEFAULT_ZUGANG_EMAIL_VORLAGE,
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
