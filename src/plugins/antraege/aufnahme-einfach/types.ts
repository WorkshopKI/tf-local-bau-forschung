import type { AufnahmeTyp } from './dateiTyp';

export type ZeilenStatus = 'bereit' | 'konvertiere' | 'konvertiert' | 'fehlgeschlagen' | 'uebersprungen';

/** Eine Datei in der Triage-Liste (aus ZIP oder losem Drop). */
export interface IntakeFile {
  localId: string;
  file: File;
  name: string;
  /** Aus dem Dateinamen erkannt; null = „kein FKZ" (User trägt inline ein). */
  fkz: string | null;
  /** Typ-Vorschlag, vom User überschreibbar. `unklar` = nicht ablegbar. */
  typ: AufnahmeTyp;
  status: ZeilenStatus;
  error?: string;
  /** ZIP-Bundle, aus dem die Datei stammt (für Manifest); leer bei losem Drop. */
  bundleName?: string;
}

export interface AbschlussInfo {
  konvertiert: number;
  fehlgeschlagen: number;
  uebersprungen: number;
  /** Merkliste der FKZ mit neuer VB → Einstieg Teil B. */
  fkzMitVb: string[];
  /** Der Lauf wurde abgebrochen — dann ist dies KEIN Abschluss (v4.124). */
  abgebrochen?: boolean;
  /** Wie viele ablegbare Dateien nach dem Abbruch unverarbeitet blieben. */
  nichtVerarbeitet?: number;
}

export interface Fortschritt {
  aktuell: number;
  gesamt: number;
  name: string;
}
