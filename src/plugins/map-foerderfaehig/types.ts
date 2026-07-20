/**
 * Datenmodell der MAP-Förderfähigkeitsprüfung.
 *
 * Bewusst KEIN `Antrag`-Record: die Einreichung ist eine eigene Entität im
 * `kv`-Store (`map-einreichung:<id>`), analog zu `gutachten-kurzfassung:<key>`
 * und `aufbereitung:<antragKey>`. Damit bleibt die produktive CSV-/Antrags-
 * Pipeline unberührt und es braucht keinen IDB-Version-Bump (der unter `file://`
 * mit parallel offenen Varianten ein `onblocked`-Upgrade auslöst).
 *
 * Datenschutz-Kernprinzip: aus der Plattform-Einreichung werden ausschliesslich
 * PM-Summen und Kürzel/N.N. übernommen. Personalbogen-Detaildaten, Bankverbindung,
 * Ansprechpartner und Telemetrie werden vom Adapter verworfen — siehe
 * `import/redaktion.ts` (Deny-Liste + Nachweis-Scan).
 */

/** Erkannte Schema-Generation der Einreichungsplattform. */
export type MapSchemaId = 'zim-2025' | 'zim-2026';

/** Schweregrad eines Befundes/einer Meldung — steuert nur die Anzeige. */
export type MapSchwere = 'fehler' | 'warnung' | 'hinweis';

// ---------------------------------------------------------------------------
// Einreichung (Strukturmodell nach Import)
// ---------------------------------------------------------------------------

export interface MapStammdaten {
  titel: string | null;
  akronym: string | null;
  kurzfassung: string | null;
}

export interface MapLaufzeit {
  start: string | null;
  ende: string | null;
  /**
   * GERECHNET — die Quelle führt kein Monatsfeld. Siehe `import/laufzeit.ts`.
   * Dummy: 2025-06-01 → 2027-04-30 = 23 Monate.
   */
  monate: number | null;
}

export interface MapArbeitspaket {
  /** Aus `number`. Der EINZIGE belastbare Join-Schlüssel zur Einsatzplanung. */
  laufnummer: number | null;
  /** Anzeigename, im Dummy ein Code (`"AP1"`), im Echtfall ein Klartext-Titel. */
  name: string;
  start: string | null;
  ende: string | null;
  aufwandPm: number | null;
  /** Position im Quell-Array — Diagnose, wenn `number` fehlt. */
  quellIndex: number;
}

/**
 * Mitarbeiter-Bezug einer Einsatzplanungs-Zeile.
 *
 * Die Quelle liefert hier ein Label `"<nr> | <Vorname> <Nachname>"`. Übernommen
 * wird davon AUSSCHLIESSLICH die führende Personalnummer (ein antragslokales
 * Pseudonym) und das N.N.-Flag — der Klarname wird verworfen. Das N.N.-Flag ist
 * fachlich nötig: die Prüfung fragt, ob die wesentlichen FuE-Aufgaben durch
 * benanntes Personal abgedeckt sind.
 */
export interface MapMitarbeiterKurz {
  /** Führende Personalnummer aus dem Label; `null`, wenn keine erkennbar war. */
  personalNr: string | null;
  istNn: boolean;
  pm: number | null;
}

export interface MapEinsatzZeile {
  /** Aus `laufnummer` → Join gegen `MapArbeitspaket.laufnummer`. */
  laufnummer: number | null;
  /**
   * Rohwert des Feldes `arbeitspacket` (Tippfehler der Quelle, ohne „e").
   * NUR Diagnose — der Join läuft nie über den Namen (vier inkompatible
   * Referenz-Formate, u. a. abweichende Gross-/Kleinschreibung).
   */
  apRefRoh: string | null;
  aufwandPm: number | null;
  gesamtkosten: number | null;
  mitarbeiter: MapMitarbeiterKurz[];
  /**
   * Kalenderjahre, auf die diese Zeile Personenmonate verteilt (aufsteigend,
   * ohne Dubletten). Die Quelle führt Jahresscheiben `jahr1`…`jahr4`; sie können
   * über das Laufzeitende hinausreichen — im Dummy bis 2028, obwohl das Vorhaben
   * am 30.04.2027 endet. Genau das prüft Rechencheck d.
   */
  jahre: number[];
}

export interface MapSummen {
  /** `einsatzplanung.gesamtpersonenmonate` */
  personenmonateEinsatz: number | null;
  /** `arbeitspakete.gesamtarbeitsaufwand` */
  arbeitsaufwandAp: number | null;
  /** Gerechnet aus den Einsatzzeilen. Dummy: 10 von 16 PM = 0.625. */
  nnAnteil: number | null;
}

export interface MapKosten {
  personal: number | null;
  dritte: number | null;
  fue: number | null;
  temp: number | null;
  uebrige: number | null;
  gesamt: number | null;
  beantragteZuwendung: number | null;
  /** Abgeleitet aus `unternehmensgrossenat_choice` (Dummy: 0.45). */
  foerdersatz: number | null;
  /** Rohwert des Quellfeldes — Nachvollziehbarkeit im Report. */
  foerdersatzQuelle: string | null;
}

/**
 * Eine Checkbox aus der Detailbeschreibung. Die Quelle nutzt ZWEI unvereinbare
 * Kodierungen direkt nebeneinander: `patentsituation_checklist` hat numerische
 * String-Keys `"0"`–`"4"` ganz ohne Beschriftung, `technologieneuerung` deutsche
 * Klartext-Sätze als Keys. `labelHerkunft` macht sichtbar, woher die Anzeige kommt.
 */
export interface MapCheckbox {
  key: string;
  label: string;
  gesetzt: boolean;
  labelHerkunft: 'schema' | 'schluessel' | 'unbekannt';
}

export interface MapMerkmale {
  patentsituation: MapCheckbox[];
  technologieneuerung: MapCheckbox[];
}

/**
 * Anlagen-Referenz — NUR Präsenz-Nachweis. Bewusst ohne `url` und `data.fileUrl`:
 * im Echtfall zeigt letzteres auf einen Quarantäne-Bucket, und ein Download-Link
 * gehört nicht in eine lokal gespeicherte Entität.
 */
export interface MapAnlageRef {
  name: string;
  originalName: string | null;
  groesse: number | null;
  typ: string | null;
  hash: string | null;
  bucket: string | null;
  /** Quell-Feldpfad, damit der Report die Anlagenart benennen kann. */
  quellFeld: string;
}

export interface MapEinreichung {
  version: 1;
  /** Stabil aus Akronym + Titel + Laufzeit — gleiche Einreichung, gleiche id. */
  id: string;
  /** `null` = keine Schema-Definition traf eindeutig zu (Drift-Fall). */
  schemaId: MapSchemaId | null;
  importiertAm: string;
  /** Bearbeiter-Kürzel via `useMeinKuerzel()` (Pitfall #27). */
  importiertVon: string | null;
  dateiname: string;
  /** djb2 über den Roh-Text — erkennt den erneuten Import derselben Datei. */
  quellHash: string;
  stamm: MapStammdaten;
  laufzeit: MapLaufzeit;
  arbeitspakete: MapArbeitspaket[];
  einsatzplanung: MapEinsatzZeile[];
  summen: MapSummen;
  kosten: MapKosten;
  antragsteller: { kurzprofil: string | null };
  merkmale: MapMerkmale;
  anlagen: MapAnlageRef[];
}

// ---------------------------------------------------------------------------
// Import-Report
// ---------------------------------------------------------------------------

export interface MapMeldung {
  schwere: MapSchwere;
  text: string;
  kontext?: string;
}

export interface MapMarkerTreffer {
  pfad: string;
  vorhanden: boolean;
}

export interface MapSchemaKandidat {
  id: MapSchemaId;
  label: string;
  marker: MapMarkerTreffer[];
  /** Anzahl vorhandener Marker. */
  treffer: number;
  /** Alle Marker vorhanden. */
  voll: boolean;
}

export interface MapSchemaErkennung {
  schemaId: MapSchemaId | null;
  /** Genau EIN Kandidat hatte alle Marker. */
  eindeutig: boolean;
  kandidaten: MapSchemaKandidat[];
}

/** Woher der Wert eines Zielfeldes kam — Kernaussage des Import-Reports. */
export interface MapFeldBefund {
  /** Zielfeld-Pfad im Strukturmodell, z. B. `kosten.personal`. */
  ziel: string;
  /** Tatsächlich benutzter Quellpfad; `null`, wenn nichts gefunden wurde. */
  benutzterPfad: string | null;
  status: 'primaer' | 'alias' | 'fehlend';
  pflicht: boolean;
}

export interface MapImportReport {
  dateiname: string;
  erkennung: MapSchemaErkennung;
  zielfelder: MapFeldBefund[];
  /** Quellpfade, die der Adapter bewusst verworfen hat (Datenschutz-Nachweis). */
  redaktion: { verworfenePfade: string[] };
  /** Im Quell-JSON vorhanden, aber von keiner Schema-Definition beansprucht. */
  unbekannteFelder: string[];
  meldungen: MapMeldung[];
  befunde: RechenBefund[];
}

// ---------------------------------------------------------------------------
// Rechenchecks
// ---------------------------------------------------------------------------

/**
 * Ergebnis eines deterministischen Rechenchecks. `id` ist stabil, damit eine
 * Nutzer-Markierung beim Re-Import nicht auf einen fremden Befund wandert
 * (dieselbe Klasse wie `befundKey` in der Antrag-Aufbereitung).
 */
export interface RechenBefund {
  id: string;
  titel: string;
  schwere: MapSchwere;
  erwartet: string;
  gefunden: string;
}
