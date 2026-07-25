/**
 * Datenmodell der Bearbeitungs-Meilensteine (Fristen-Monitoring).
 *
 * Zweite Achse neben dem amtlichen Status: der Status sagt WO ein Verbund steht,
 * der Meilenstein-Plan sagt, ob er dort RECHTZEITIG steht. Anker ist der
 * Antragseingang, Ziel die vollständige Bearbeitung binnen `gesamtfristTage`
 * (Default 90 = `ANTRAG_SLA_DAYS`).
 *
 * Drei bewusste Abgrenzungen:
 * - Die Anzeige-`Prominenz = 'meilenstein'` des Status-Katalogs
 *   ([status/typen.ts](../status/typen.ts)) bleibt ein reiner Timeline-Marker.
 *   Sie wird hier NICHT umgedeutet.
 * - Die CSV-Spalten `MS01_*`–`MS03_*` (Begleitphase, `*_DPLAN`/`*_DIST`) sind
 *   **Projekt**-Meilensteine des bewilligten Vorhabens — eigener Lebenszyklus,
 *   nicht Gegenstand dieses Moduls.
 * - Die Erfüllungs-Bedingung ist die bestehende `Bedingung` aus dem
 *   Status-System; ausgewertet wird sie vom geteilten Evaluator
 *   ([status/bedingung.ts](../status/bedingung.ts)) — es gibt keinen zweiten.
 *
 * Der Plan ist **kuratierte Team-Daten**: die PL pflegt ihn, alle lesen ihn.
 */
import type { Bedingung } from '@/core/status';
import type { AntragstypBucket } from '@/core/utils/vb-phase-mappings';

export type { AntragstypBucket };

/**
 * Ein (Unter-)Meilenstein. Die Tiefe ist frei — MST 1 → 1.4 → 1.4.2 ist ein
 * Baum über `elternId`, keine feste Ebenenzahl. Wie viele Meilensteine es gibt,
 * entscheidet ausschließlich der Plan.
 */
export interface MeilensteinKnoten {
  /** Stabile ID, z.B. `mst-1-4-2`. Referenziert aus Ergebnissen + Risiko-Meldungen. */
  id: string;
  /** `null` = Wurzel-Meilenstein. */
  elternId: string | null;
  /** Anzeige-Nummer, z.B. „1.4.2". Rein kosmetisch — die Ordnung macht `sortierung`. */
  nummer: string;
  label: string;
  beschreibung?: string;
  /** Soll-Termin = Ende der n-ten Woche nach Antragseingang. */
  sollWoche: number;
  /** Zählt in die Prognose zur Gesamtfrist. Rein informative Knoten: `false`. */
  relevantFuerFrist: boolean;
  /** Gilt nur für diese Antragstypen; leer = alle. */
  nurTypen: AntragstypBucket[];
  aktiv: boolean;
  /** Erfüllt, sobald diese Bedingung über das Feld-Ensemble wahr wird. */
  bedingung: Bedingung;
  /**
   * Feld, dessen Datumswert als Ist-Termin gilt (z.B. `D_AZ1_1` für die
   * Erstentscheidung). Fehlt es, wird der Ist-Termin aus dem Status-Event-Log
   * abgeleitet; fehlt auch der, gilt der Meilenstein als erreicht ohne Datum.
   */
  istDatumFeld?: string;
  /** Sortierung unter Geschwistern (aufsteigend). */
  sortierung: number;
  /**
   * Vom Seed vorbelegt und noch nicht von der PL bestätigt. Die App zeigt solche
   * Knoten mit Hinweis an — die verbindliche Zuordnung Rohspalte→Meilenstein
   * kennt nur das Team.
   */
  unbestaetigt?: boolean;
}

/** Eine archivierte Fassung des Plans (Historie, newest-first). */
export interface MeilensteinPlanSnapshot {
  version: number;
  stand: string;
  autor: string | null;
  kommentar?: string;
  status: MeilensteinPlanStatus;
  gesamtfristTage: number;
  knoten: MeilensteinKnoten[];
}

export type MeilensteinPlanStatus = 'entwurf' | 'freigegeben';

/**
 * Der aktuelle Meilenstein-Plan. Versioniert + freigebbar wie der
 * Textbaustein-Katalog: bearbeiten erhöht die Version, `freigegeben` ist eine
 * eigene Achse. Nur ein freigegebener Plan wird ausgewertet.
 */
export interface MeilensteinPlan {
  version: number;
  stand: string;
  autor: string | null;
  kommentar?: string;
  status: MeilensteinPlanStatus;
  /** Gesamt-Bearbeitungsfrist ab Antragseingang in Tagen. */
  gesamtfristTage: number;
  knoten: MeilensteinKnoten[];
  historie: MeilensteinPlanSnapshot[];
}

// --- Bewertung -------------------------------------------------------------

/**
 * Zustand eines Meilensteins für einen konkreten Verbund.
 * `faellig` ist eine Vorwarnstufe von `offen` (Soll-Termin binnen `FAELLIG_FENSTER_TAGE`).
 */
export type MstZustand = 'erreicht' | 'offen' | 'faellig' | 'gerissen' | 'nichtRelevant';

/** Prognose zur Gesamtfrist. */
export type Prognose = 'imPlan' | 'gefaehrdet' | 'nichtHaltbar' | 'abgeschlossen' | 'unbekannt';

export interface MstErgebnis {
  knotenId: string;
  zustand: MstZustand;
  /** Anker + `sollWoche * 7`. `null` ohne Ankerdatum. */
  sollDatum: string | null;
  /** Tatsächlicher Erfüllungstermin, falls bekannt. */
  istDatum: string | null;
  /** `istDatum − sollDatum` in Tagen (negativ = früher als geplant). `null` wenn nicht berechenbar. */
  abweichungTage: number | null;
  /** Bei `erreicht` über die Kinder statt über die eigene Bedingung. */
  ueberKinder?: boolean;
}

export interface VerbundMeilensteine {
  verbundId: string;
  /** Maßgebliches Antragsdatum des Verbunds (spätestes TV-Antragsdatum). */
  antragsdatum: string | null;
  typ: AntragstypBucket | null;
  /** Laufende Bearbeitungswoche (1 = erste Woche nach Eingang). `null` ohne Anker. */
  wocheAktuell: number | null;
  /** Anker + `gesamtfristTage`. */
  fristDatum: string | null;
  /** Tage bis zur Gesamtfrist (negativ = überfällig). */
  restTage: number | null;
  ergebnisse: MstErgebnis[];
  prognose: Prognose;
}

// --- Risiko-Meldungen (User → PL) ------------------------------------------

/**
 * „Ich weiß, dass ich diesen Meilenstein nicht halten kann." Wird in den
 * persönlichen Ordner geschrieben und von der PL eingesammelt — der Daten-Share
 * wird dafür nicht beschrieben (Pitfall #24/#26).
 */
export interface MeilensteinRisiko {
  id: string;
  verbundId: string;
  knotenId: string;
  /** Bearbeiter-Kürzel des Melders (via `useMeinKuerzel`). */
  kuerzel: string;
  text: string;
  /** Selbsteinschätzung der Verzögerung; optional. */
  erwarteteVerzoegerungTage?: number;
  gemeldetAm: string;
  /** Vom Melder als erledigt markiert — bleibt sichtbar, wird nie gelöscht. */
  erledigt?: boolean;
}
