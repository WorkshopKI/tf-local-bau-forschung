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
  /** Standard-Stunden pro Teilvorhaben (Fallback). Wird benutzt, wenn fuer den
   *  Antragstyp kein eigener Wert in `stundenProTVProTyp` gepflegt ist, sowie in
   *  allen typ-uebergreifenden Aggregat-Anzeigen ("X TVs frei"). */
  stundenProTV: number;
  /** Antragstyp-spezifische Stunden pro Teilvorhaben (FuE/DS/DL/NW). Ueber-
   *  schreibt pro Typ den `stundenProTV`-Standard. Fehlender/0-Eintrag → Standard
   *  greift (siehe `stundenProTVFor`). Optional/leer → voll abwaertskompatibel
   *  (alle Typen nutzen den Standard wie vor v2.31). */
  stundenProTVProTyp?: Partial<Record<AntragstypBucket, number>>;
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
  /** Rollierendes Verteil-Fenster in Monaten: nur Anträge, deren Antragsdatum in
   *  den letzten N Monaten bis zum aktuellen Quartalsende liegt, erscheinen in der
   *  Klassifizierungs- UND der Zuweisungs-Liste. Gleitet sauber über den
   *  Jahreswechsel (Dezember-Anträge bleiben im Januar sichtbar). Default 6. */
  verteilLookbackMonate: number;
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
  /** v2.31: Gewicht (0..1) der PL-Kompetenztabelle im 50/50-Blend mit der
   *  Historie. Der Kompetenz-Score ist `(1-w)·Historie + w·Tabellen-Level` —
   *  bei w=0.5 zählen beide gleich, die Tabelle kann einen MA also ANHEBEN
   *  (nicht nur dämpfen). Ohne Tabellen-Eintrag für die Primärkat. zählt nur
   *  die Historie. 0 = Tabelle ignoriert (nur Historie), 1 = nur Tabelle.
   *  Default 0.5. */
  kompetenzMatrixMatchGewicht?: number;
  /** @deprecated v2.31 — ersetzt durch `kompetenzMatrixMatchGewicht` (additiver
   *  50/50-Blend statt multiplikativer Dämpfer). Feld bleibt für die Rückwärts-
   *  Last bestehender `auslastung.json`, wird von der Engine nicht mehr gelesen. */
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
  /** @deprecated v2.31 — der Wenig-Historie-Boost ist obsolet, seit die Tabelle
   *  additiv-parallel zur Historie zählt (`kompetenzMatrixMatchGewicht`). Feld
   *  bleibt für die Rückwärts-Last bestehender `auslastung.json`. */
  kompetenzMatrixSparseSchwelle?: number;
  /** @deprecated v2.31 — siehe `kompetenzMatrixSparseSchwelle`. Wird von der
   *  Engine nicht mehr gelesen. */
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
 * Effektive Stunden pro Teilvorhaben fuer einen Antragstyp (v2.31). Liefert den
 * typ-spezifischen Wert aus `config.stundenProTVProTyp[bucket]`, faellt sonst auf
 * den globalen `config.stundenProTV`-Standard zurueck (und ultimativ auf 9). Ohne
 * `bucket` (typ-uebergreifende Aggregat-Anzeigen) wird direkt der Standard
 * benutzt. Pure — zentraler Aufloeser fuer alle Kapazitaets-/Matching-Pfade.
 */
export function stundenProTVFor(
  config: Pick<AuslastungConfig, 'stundenProTV' | 'stundenProTVProTyp'>,
  bucket?: AntragstypBucket | null,
): number {
  const perTyp = bucket ? config.stundenProTVProTyp?.[bucket] : undefined;
  const v = typeof perTyp === 'number' && perTyp > 0 ? perTyp : config.stundenProTV;
  return typeof v === 'number' && v > 0 ? v : 9;
}

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

/**
 * Optimistic-Overlay (v2.9-Fix): lokal zurueckgenommene „Pending"-Vormerkungen.
 * Eine Zeile gilt als „Vorgemerkt", solange die PL-eingesammelte `selbst`-
 * Zuweisung im read-only `auslastung.json` steht (`myPendingAktenzeichen`). Da
 * der prod-User die nicht loeschen kann, unterdrueckt dieses browser-lokale Set
 * die „Vorgemerkt"-Anzeige sofort nach „Rückgängig" — bis die PL neu einsammelt
 * und die `selbst`-Zuweisung wegfaellt (dann self-healing prune). KEIN Vertrag:
 * wird NIE auf den SMB-Share geschrieben; der durable Retraktions-Vertrag bleibt
 * „Wunsch fehlt in der persoenlichen Datei" (das liest die PL beim Einsammeln). */
export const PERSOENLICH_AUSLASTUNG_RETRACTED_IDB_KEY = 'personal-auslastung-retracted-pending-cache';

export interface RetractedPendingCache {
  version: 1;
  antragIds: string[];
  updatedAt: string;
}

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

  // ─── v2.19: manueller PL-Eintrag ────────────────────────────────────
  /** true = von der PL manuell hinzugefuegt (nicht vom Matcher vorgeschlagen).
   *  Kein Score; die Card zeigt nur die Kapazitaets-/Kontingent-Angaben + ein
   *  „Manuell"-Badge. */
  manuell?: boolean;

  // ─── v2.48: Transparenz — Score-Aufschluesselung fuer das UI ─────────
  /** Aufschluesselung des `kompetenzScore` in seine Beitraege (Historie vs.
   *  Kompetenztabelle vs. Aspekt). Optional → manuelle Eintraege + Alt-Records
   *  ohne Breakdown bleiben gueltig. Wird von `runMatchingWithContext` gefuellt. */
  breakdown?: ScoreBreakdown;
}

/**
 * Score-Aufschluesselung eines Vorschlags (v2.48) — macht transparent, wieviel
 * die historischen Antraege (`histScore`) und wieviel die PL-Kompetenztabelle
 * (`matrixScore`) zum `kompetenzScore` beitragen. Reine Anzeige-Daten; die
 * Engine berechnet sie ohnehin (siehe `matching-engine.ts` 50/50-Blend).
 */
export interface ScoreBreakdown {
  /** 'haupt' = MA-Hauptkategorie == Antrag-Primaer; 'neben' = nur Nebenkompetenz. */
  matchKind: 'haupt' | 'neben';
  /** Gewaehltes BM25/Embedding-Mischverhaeltnis: 1.0 = nur Wortlaut, 0.2 =
   *  ueberwiegend semantisch, 0.5 = gemischt. */
  alpha: number;
  /** Historie-Signal: clamp01(alpha·bm25 + (1-alpha)·emb + astBoost). */
  histScore: number;
  /** Kompetenztabellen-Signal der Primaerkategorie (0..1) oder `null`, wenn
   *  fuer diese Ueberkategorie keine Zelle gepflegt ist (zaehlt dann nicht). */
  matrixScore: number | null;
  /** 50/50-Blend-Gewicht der Tabelle (config.kompetenzMatrixMatchGewicht). */
  matrixGewicht: number;
}

/** Grund, warum ein kategorie-relevanter MA NICHT vorgeschlagen wird (v2.48).
 *  Macht die bisher stillen Engine-Ausschluesse im UI nachvollziehbar. */
export type AusschlussGrund =
  | 'antragstyp'        // bearbeitet diesen Antragstyp nicht (Praeferenz/Override)
  | 'keine-stunden'     // kein Stunden-Kontingent gepflegt (jahresKapazitaetProTyp leer)
  | 'kein-onboarding'   // kein Onboarding abgeschlossen UND keine Historie
  | 'abgemeldet'        // im aktuellen Quartal abgemeldet
  | 'inaktiv'           // als ehemaliger Bearbeiter markiert (aktiv=false)
  | 'rang';             // gescort, aber unterhalb des Top-N-Schnitts

export interface AusgeschlossenerMa {
  anonId: string;
  grund: AusschlussGrund;
  /** Hauptkategorie des MAs — Kontext fuer die Anzeige (z.B. „Hauptkategorie IT"). */
  hauptKategorie?: string;
  /** Nur bei grund==='rang': der erreichte kompetenzScore (0..1). */
  kompetenzScore?: number;
}

/** Voller Matching-Kontext eines Antrags (v2.48) — Haupt-Vorschlaege, die
 *  getrennt gezeigten Nebenkompetenz-MAs und die ausgeschlossenen MAs mit Grund. */
export interface MatchKontext {
  vorschlaege: MatchResult[];
  nebenkompetenz: MatchResult[];
  ausgeschlossen: AusgeschlossenerMa[];
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
/** Freitext-Bemerkung (T_HINT aus der Master-CSV) — in der Zuweisen-/Klassifizieren-
 *  Detailansicht angezeigt, falls befuellt. */
export const CANONICAL_T_HINT = 't_hint';
/** Vollstaendigkeits-Datum (D_XTEC): gesetzt, sobald alle TVs eines Verbundes
 *  eingegangen + erfasst sind. Maßgeblich fuer FuE (vb_phase 3) + DS (vb_phase 5).
 *  Fehlt das Datum bei einem unverteilten Antrag, gilt er als „nicht vollstaendig"
 *  (Markierung in beiden Tabs + Freigabe/Zuweisung gesperrt). */
export const CANONICAL_D_XTEC = 'd_xtec';
/** Vollstaendigkeits-Datum (D_ADV): Pendant zu D_XTEC fuer DL (vb_phase 4) +
 *  NW (vb_phase 1|2). Gleiche Semantik (Verbund vollstaendig im System erfasst). */
export const CANONICAL_D_ADV = 'd_adv';

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
  stundenProTVProTyp: {},
  aktuellesQuartal: deriveCurrentQuartal(),
  gewichtungKompetenz: 0.7,
  gewichtungBalance: 0.3,
  ueberKategorien: DEFAULT_UEBERKATEGORIEN,
  klassifizierungsSchwellwert: 0.15,
  selbsteintragungFristTage: 7,
  verteilLookbackMonate: 6,
  stage2Aktiv: true,
  setupAbgeschlossen: false,
  // Workflow-Revision 1.17
  durchschnittTVproAntrag: 2,
  quartalsEndeBonusTage: 21,
  aspektBonus: 0.10,
  // v2.15: PL-Kompetenz-Vorbelegung; v2.31: 50/50-Blend Historie ↔ Tabelle
  kompetenzMatrixMatchGewicht: 0.5,
  kompetenzLevelGewicht: 0.3, // @deprecated v2.31 (siehe kompetenzMatrixMatchGewicht)
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

/** Gueltiges Quartal-Label im festen Format "YYYY-Qn" (n = 1..4). */
function isValidQuartalLabel(q: unknown): q is string {
  return typeof q === 'string' && /^\d{4}-Q[1-4]$/.test(q);
}

/**
 * Effektives „aktuelles Quartal" — faellt NIE hinter das Kalenderquartal von
 * `now` zurueck. `config.aktuellesQuartal` wird beim Setup einmal aus dem Datum
 * abgeleitet und persistiert, rollt aber nicht von selbst weiter; ohne diese
 * Anhebung haengt das ganze Modul nach einem Quartalswechsel auf dem alten Wert
 * fest (z.B. Q2 obwohl schon Q3). Ein bewusst in die ZUKUNFT gesetzter Wert
 * (Voraus-Planung) bleibt erhalten — das Format ist fixed-width, daher entspricht
 * der lexikalische Vergleich der chronologischen Reihenfolge (auch ueber
 * Jahresgrenzen: "2026-Q4" < "2027-Q1"). Read-time, kein Config-Write noetig.
 */
export function effektivesAktuellesQuartal(gespeichert: unknown, now: Date = new Date()): string {
  const derived = deriveCurrentQuartal(now);
  if (!isValidQuartalLabel(gespeichert)) return derived;
  return gespeichert >= derived ? gespeichert : derived;
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
