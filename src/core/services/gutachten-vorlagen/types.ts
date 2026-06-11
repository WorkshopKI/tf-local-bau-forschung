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

export interface FillResult {
  mappedFields: MappedField[];
  /** Codes ohne Mapping (Teilmenge von mappedFields mit befuellbar=false). */
  unfilledCodes: string[];
  /** Wurde der Kurzfassung-Anker gefunden (und der Text eingefügt)? */
  anchorFound: boolean;
  /** Nur im Nicht-Dry-Run gesetzt. */
  blob?: Blob;
  /** Vorgeschlagener Ausgabe-Dateiname. */
  filename: string;
}
