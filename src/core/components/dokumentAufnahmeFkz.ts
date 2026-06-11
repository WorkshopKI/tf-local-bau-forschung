/**
 * Pure FKZ-Zuordnungslogik der Dokumenten-Aufnahmefläche (testbar ohne React).
 * Nutzt den bestehenden FKZ-Extraktor (kein eigener Regex).
 *
 * Die Aufnahme läuft auf Verbund-Ebene: ein Dokument „gehört hierher", wenn das
 * im Dateinamen erkannte FKZ zu IRGENDEINEM Teilvorhaben des Verbundes gehört
 * (`knownFkz`). Ist die Liste leer (ungebundener Modus), gilt jedes erkannte FKZ.
 */
import { extractFkz } from '@/phase2/matcher/fkz-extractor';

export type FkzCase = 'match' | 'other' | 'none';

export interface FkzClassification {
  /** FKZ aus dem Dateinamen (kanonisch) oder null. */
  detectedFkz: string | null;
  /**
   * - `match`: kein gebundener Kontext ODER Datei-FKZ ∈ knownFkz → aufnehmen
   * - `other`: FKZ erkannt, gehört aber zu keinem TV des Verbundes → Warnung
   * - `none`:  kein FKZ im Dateinamen → manuelle Zuordnung
   */
  fkzCase: FkzCase;
}

export function normFkz(s: string): string {
  return s.toUpperCase().replace(/\s+/g, '');
}

/** Kanonisiert ein Aktenzeichen zu seiner FKZ-Form (Förderantrag-Az == FKZ). */
export function resolveFkz(aktenzeichen: string): string {
  return extractFkz(aktenzeichen)?.fkz ?? normFkz(aktenzeichen);
}

export function classifyFkz(filename: string, knownFkz: string[]): FkzClassification {
  const detectedFkz = extractFkz(filename)?.fkz ?? null;
  let fkzCase: FkzCase;
  if (!detectedFkz) fkzCase = 'none';
  else if (knownFkz.length === 0 || knownFkz.includes(detectedFkz)) fkzCase = 'match';
  else fkzCase = 'other';
  return { detectedFkz, fkzCase };
}
