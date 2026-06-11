/**
 * Pure Zuordnungslogik der Dokumenten-Aufnahmefläche (testbar ohne React).
 *
 * Die Aufnahme läuft auf Verbund-Ebene. Bekannte Kennungen (`knownIds`) sind die
 * Verbund-ID UND die Aktenzeichen aller Teilvorhaben — alle zählen als zugehörig
 * (manchmal reichen mehrere TVs dieselbe Projektbeschreibung ein, jeweils mit dem
 * eigenen TV-FKZ; auch der Verbund-FKZ kommt im Dateinamen vor).
 *
 * Erkennung per Substring-Match auf dem normalisierten Dateinamen — das fängt auch
 * Verbund-IDs (z.B. `ZEP…`), die der 16XX-FKZ-Extraktor nicht kennt. Ist der
 * Dateiname nicht eindeutig zuordenbar, ordnet der Bearbeiter manuell zu
 * (Prinzip „lieber Bearbeiter entscheiden lassen als falsch raten").
 */
import { extractFkz } from '@/phase2/matcher/fkz-extractor';

export type FkzCase = 'match' | 'ambig';

export interface FkzClassification {
  /** FKZ laut 16XX-Extraktor (nur zur Anzeige; null wenn keiner erkannt). */
  detectedFkz: string | null;
  /** Welche bekannte Kennung (Verbund-ID / TV-Az) im Dateinamen steckt, oder null. */
  matchedId: string | null;
  /** `match` = eindeutig diesem Verbund zuzuordnen; `ambig` = Bearbeiter entscheidet. */
  fkzCase: FkzCase;
}

/** Normalisiert für den Substring-Vergleich (Großschreibung, ohne Trenner). */
export function normId(s: string): string {
  return s.toUpperCase().replace(/[\s_.\-/]+/g, '');
}

export function classifyFkz(filename: string, knownIds: string[]): FkzClassification {
  const detectedFkz = extractFkz(filename)?.fkz ?? null;
  const haystack = normId(filename);
  const matchedId = knownIds.find(id => id.trim().length > 0 && haystack.includes(normId(id))) ?? null;
  return { detectedFkz, matchedId, fkzCase: matchedId ? 'match' : 'ambig' };
}
