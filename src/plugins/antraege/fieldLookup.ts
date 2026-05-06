import type { Antrag } from '@/core/services/csv/types';

/** Normalisiert Feld-Bezeichner fuer robustes Lookup: lowercase + alle Trenner raus. */
function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[\s_\-.]/g, '');
}

/**
 * Findet einen Wert auf dem Antrag fuer einen oder mehrere Kandidaten-Bezeichner.
 *
 * Hintergrund: CSV-Spalten landen im Antrag-Objekt entweder als snake_case-Custom-Key
 * (`vb_inhalt`), als lowercase mit Leerzeichen (`vb inhalt`) oder als canonical-Key
 * (`titel`, `branche`). Der genaue Schluessel haengt vom CSV-Schema und Column-Mapping ab.
 *
 * Diese Helper-Funktion vergleicht case-insensitive und ohne Trenner — `findFieldValue(a,
 * ['vb_inhalt'])` matcht `a['vb inhalt']`, `a['Vb_Inhalt']`, `a['vbinhalt']` etc.
 */
export function findFieldValue(antrag: Antrag, candidates: string[]): unknown {
  const targets = new Set(candidates.map(normalizeKey));
  for (const [key, value] of Object.entries(antrag)) {
    if (key.startsWith('_')) continue;
    if (targets.has(normalizeKey(key))) return value;
  }
  return undefined;
}
