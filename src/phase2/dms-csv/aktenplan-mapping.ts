/**
 * Aktenplanzuordnung → interner doc_type.
 *
 * Default-Map ist als JS-Konstante hinterlegt; ein Override aus
 * `_intern/aktenplan-mapping.json` (auf dem Daten-Share) wird beim
 * App-Start drüber gelegt. Der Loader macht die Override-Lese-Operation,
 * diese Datei stellt nur die Defaults und eine pure-Funktion bereit.
 *
 * Quelle der Defaults: dms-sample.csv aus docs/phase-2/ + Brief-Beispiele
 * ("6.1 QS zum Antrag" → gutachten_qs).
 */

import type { AktenplanLookup, DocType } from '../types';

/**
 * Default-Mapping. Keys werden _case-insensitive_ und _trim_ verglichen.
 * Lookups erfolgen über `lookupAktenplan()`.
 *
 * Numerische Präfixe ("0.2 Checklisten") und reine Text-Werte ("Betreuung")
 * werden gleich behandelt — der Aktenplan im DMS ist hierarchisch, aber
 * wir flachen ihn hier auf den führenden String ab.
 */
export const DEFAULT_AKTENPLAN_MAPPING: Record<string, AktenplanLookup> = {
  // Anträge & Bescheide
  '0.2 Checklisten': { doc_type: 'checkliste', irrelevant: true },
  '2.1 Bescheide': { doc_type: 'bescheid', irrelevant: false },
  '2.7 De-minimis': { doc_type: 'de_minimis', irrelevant: false },

  // Verwendungsnachweis
  'Verwendungsnachweis': { doc_type: 'verwendungsnachweis', irrelevant: false },
  '5. Verwendungsnachweis': { doc_type: 'verwendungsnachweis', irrelevant: false },

  // Gutachten / QS
  '6.1 QS zum Antrag': { doc_type: 'gutachten_qs', irrelevant: false },
  '6.2 QS zur Betreuung': { doc_type: 'gutachten_qs', irrelevant: false },

  // Allgemeine Korrespondenz / Betreuung
  'Betreuung': { doc_type: 'korrespondenz', irrelevant: false },

  // Explizit als irrelevant gekennzeichnet
  '7 Irrelevante Unterlagen': { doc_type: 'irrelevant', irrelevant: true },

  // Weitere übliche DMS-Kategorien (Brief erwähnt sie als typische Werte)
  'Nachforderung': { doc_type: 'nachforderung', irrelevant: false },
  'Änderungsbescheid': { doc_type: 'aenderungsbescheid', irrelevant: false },
  'Gutachten': { doc_type: 'gutachten', irrelevant: false },
  'Projektbeschreibung': { doc_type: 'projektbeschreibung', irrelevant: false },
};

/** Override-Datenstruktur (von _intern/aktenplan-mapping.json). */
export interface AktenplanMappingOverride {
  version: 1;
  mapping: Record<string, AktenplanLookup>;
}

/** Normalisiert einen Aktenplan-Wert für Map-Lookup. */
function normKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Effektive Map aus Defaults + Override.
 * Override-Keys gewinnen, Defaults bleiben für nicht-überschriebene Werte.
 */
export function buildEffectiveMapping(
  override?: AktenplanMappingOverride | null,
): Map<string, AktenplanLookup> {
  const m = new Map<string, AktenplanLookup>();
  for (const [k, v] of Object.entries(DEFAULT_AKTENPLAN_MAPPING)) {
    m.set(normKey(k), v);
  }
  if (override?.mapping) {
    for (const [k, v] of Object.entries(override.mapping)) {
      m.set(normKey(k), v);
    }
  }
  return m;
}

/**
 * Lookup eines Aktenplan-Werts. Gibt null zurück wenn weder Default noch
 * Override greift — Caller markiert das Dokument typischerweise als
 * `doc_type: 'sonstiges'` und lässt es weiter durch die Pipeline.
 */
export function lookupAktenplan(
  effective: Map<string, AktenplanLookup>,
  rawValue: string | null | undefined,
): AktenplanLookup | null {
  if (!rawValue) return null;
  return effective.get(normKey(rawValue)) ?? null;
}

/** Hilfs-Predicate: direkt aus DocType auf "irrelevant per Default" mappen. */
export function isDocTypeIrrelevant(docType: DocType): boolean {
  return docType === 'irrelevant' || docType === 'checkliste';
}
