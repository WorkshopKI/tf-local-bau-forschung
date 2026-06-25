/**
 * Datenmodell des Moduls „Anfragen": eine E-Mail-Kurzanfrage von der Aufnahme
 * (`.msg`) über die anonymisierte externe Runde bis zur deterministisch
 * wiedereingesetzten finalen Antwort.
 *
 * DSGVO-Kernpunkt: `originalMd` trägt echte Inhalte (nur lokal/intern), `mapping`
 * ist die sensibelste Struktur im ganzen Modul (Platzhalter→Original) und darf
 * NIEMALS serialisiert oder an einen Transport übergeben werden — erzwungen per
 * Convention-Guard `anfrage-no-mapping-in-transport`.
 */

export type PiiTyp =
  | 'person' | 'firma' | 'ort' | 'fkz' | 'email' | 'telefon'
  | 'iban' | 'x500' | 'hostname' | 'sonstiges';

/** Ein Platzhalter↔Original-Paar. Lebt ausschließlich lokal in IndexedDB. */
export interface Mapping {
  platzhalter: string;
  original: string;
  typ: PiiTyp;
}

export type AnfrageStatus =
  | 'aufgenommen'
  | 'anonymisiert'
  | 'export_freigegeben'
  | 'antwort_importiert'
  | 'finalisiert';

export interface Anfrage {
  id: string;
  status: AnfrageStatus;
  // Aufnahme
  absenderEmail: string;   // aus From-Header (SMTP bevorzugt), für mailto
  betreff: string;         // aus Subject, für Re:
  hatAnhaenge: number;     // nur Anzahl zur Anzeige — NICHT verarbeitet
  originalMd: string;      // Body → Markdown (echte Inhalte, NUR lokal/intern)
  // Anonymisierung
  anonymisiertMd: string;  // editierbar durch User
  mapping: Mapping[];      // SENSIBELSTE STRUKTUR — niemals an Transporte
  // Externe Runde
  externeAntwortAnon: string;  // Paste der anonymisierten Antwort
  // Finalisierung
  finaleAntwort: string;   // deterministisch wiedereingesetzt, mail-fertig
  erstelltAm: string;      // ISO
  geaendertAm: string;     // ISO
}
