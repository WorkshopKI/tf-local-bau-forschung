/**
 * Pure FKZ-Zuordnungslogik der Dokumenten-Aufnahmefläche (testbar ohne React).
 * Nutzt den bestehenden FKZ-Extraktor (kein eigener Regex).
 */
import { extractFkz } from '@/phase2/matcher/fkz-extractor';

export type FkzCase = 'match' | 'other' | 'none';

export interface FkzClassification {
  /** FKZ aus dem Dateinamen (kanonisch) oder null. */
  detectedFkz: string | null;
  /** FKZ des aktuellen Antrags (kanonisch) oder null im ungebundenen Modus. */
  antragFkz: string | null;
  /**
   * - `match`: kein gebundener Antrag ODER Datei-FKZ == Antrag-FKZ → aufnehmen
   * - `other`: Datei-FKZ erkannt, aber anderer Antrag → Warnung
   * - `none`:  kein FKZ im Dateinamen → manuelle Zuordnung
   */
  fkzCase: FkzCase;
}

export function normFkz(s: string): string {
  return s.toUpperCase().replace(/\s+/g, '');
}

/** FKZ des aktuellen Antrags (Förderantrag-Aktenzeichen == FKZ), kanonisch. */
export function resolveAntragFkz(antragAz?: string): string | null {
  if (!antragAz) return null;
  return extractFkz(antragAz)?.fkz ?? normFkz(antragAz);
}

export function classifyFkz(filename: string, antragAz?: string): FkzClassification {
  const detectedFkz = extractFkz(filename)?.fkz ?? null;
  const antragFkz = resolveAntragFkz(antragAz);
  let fkzCase: FkzCase;
  if (!detectedFkz) fkzCase = 'none';
  else if (!antragFkz || detectedFkz === antragFkz) fkzCase = 'match';
  else fkzCase = 'other';
  return { detectedFkz, antragFkz, fkzCase };
}
