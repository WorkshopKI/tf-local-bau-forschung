/** Datentypen des Gutachten-Vorlagen-Füllers. */

/** Eintrag aus dem live gelesenen Vorlagen-Verzeichnis. */
export interface VorlageEintrag {
  name: string;
  /** Epoch-ms (aus File.lastModified). */
  lastModified: number;
}

/** Ein Vorlagen-Feld (`&F:…&` / `&C:…&`) mit seinem aufgelösten Wert. */
export interface MappedField {
  /** Code ohne Klammern, z.B. `VMS VB Projekt`. */
  code: string;
  /** Roh-Platzhalter wie im Dokument gefunden (z.B. `&F:VMS VB Projekt&`). */
  placeholder: string;
  /** Wert aus TeamFlow oder null, wenn kein Mapping existiert. */
  value: string | null;
  /** false = unbekannter Code, bleibt unverändert in der Vorlage. */
  befuellbar: boolean;
}

/** Abschnitts-ID eines ZIM-Gutachtens (deckungsgleich mit dem Workflow-`StepId`). */
export type AbschnittId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

/**
 * Generischer Einfüge-Block (Artefakt-Engine): ein Abschnitt (GA) ODER ein
 * Baustein (NF). `id` ist bewusst OFFEN (Abschnitts-ID `'A'..'G'`, Baustein-ID
 * `'G1.1'` …); der Füller nutzt nur `anker` (Such-Überschrift) + `finalerText`
 * und meldet die `id` im Status zurück.
 */
export interface ArtefaktBlock {
  id: string;
  /** Anker-Überschriftentext in der Vorlage (whitespace-tolerant gesucht). */
  anker: string;
  finalerText: string;
}

/** Ein einzufügender (freigegebener) GA-Abschnitt — verengt `ArtefaktBlock.id` auf A–G. */
export interface AbschnittEinfuegung extends ArtefaktBlock {
  id: AbschnittId;
}

/** Status eines übergebenen Blocks nach dem Füllen (für den Dialog). */
export interface AbschnittStatus {
  /** Block-ID (`'A'..'G'` ODER eine Baustein-ID) — offen wie `ArtefaktBlock.id`. */
  id: string;
  anker: string;
  /** Anker-Überschrift in der Vorlage gefunden? */
  anchorFound: boolean;
  /** Tatsächlich eingefügt (== anchorFound für übergebene, freigegebene Blöcke). */
  eingefuegt: boolean;
}

/** Anzeige-Zeile A–G für den „Abschnitte"-Block im Vorlagen-Dialog. */
export interface AbschnittAnzeige {
  id: AbschnittId;
  label: string;
  anker: string;
  /** Ist der Abschnitt freigegeben (wird also überhaupt zum Einfügen versucht)? */
  freigegeben: boolean;
}

export interface FillResult {
  mappedFields: MappedField[];
  /** Codes ohne Mapping (Teilmenge von mappedFields mit befuellbar=false). */
  unfilledCodes: string[];
  /** Status je übergebenem (freigegebenem) Abschnitt — Anker gefunden/eingefügt. */
  sections: AbschnittStatus[];
  /** Anzahl tatsächlich eingefügter Abschnitte (Anker gefunden). */
  eingefuegteAnzahl: number;
  /** Nur im Nicht-Dry-Run gesetzt. */
  blob?: Blob;
  /** Vorgeschlagener Ausgabe-Dateiname. */
  filename: string;
  /**
   * SHA-256-Hex der gelesenen Vorlagen-Bytes (Artefakt-Engine: Audit/Reproduzier-
   * barkeit, stempelt `WorkflowRun.vorlageRef.hash`). Fehlt im Fehlerfall.
   */
  hash?: string;
  /**
   * Gesetzt, wenn die Vorlage nicht lesbar/kein gültiges DOCX war. Dann ist kein
   * `blob`/`hash` gesetzt und es wurde NICHT geworfen — der Aufrufer zeigt die
   * Meldung und degradiert sauber.
   */
  fehler?: string;
}
