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

/** Ein einzufügender (freigegebener) Abschnitt: ID + Anker-Überschrift + Text. */
export interface AbschnittEinfuegung {
  id: AbschnittId;
  /** Anker-Überschriftentext in der Vorlage (whitespace-tolerant gesucht). */
  anker: string;
  finalerText: string;
}

/** Status eines übergebenen Abschnitts nach dem Füllen (für den Dialog). */
export interface AbschnittStatus {
  id: AbschnittId;
  anker: string;
  /** Anker-Überschrift in der Vorlage gefunden? */
  anchorFound: boolean;
  /** Tatsächlich eingefügt (== anchorFound für übergebene, freigegebene Abschnitte). */
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
}
