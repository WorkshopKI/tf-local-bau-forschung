/**
 * Lädt die gefilterte DMS-CSV (Output von scripts/filter-dms-csv.mjs)
 * und das optionale Aktenplan-Override-JSON vom Daten-Share.
 */

import { readText } from '../../core/services/infrastructure/atomic-write';
import {
  AKTENPLAN_MAPPING_PATH,
  DMS_INDEX_FILTERED_PATH,
} from '../../core/services/infrastructure/types';
import type { DmsEntry } from '../types';
import { parseCsvText } from './parser';
import {
  buildEffectiveMapping,
  type AktenplanMappingOverride,
} from './aktenplan-mapping';

export interface DmsLoadResult {
  entries: Map<string, DmsEntry>;
  /** Effective Aktenplanzuordnung-Map (Defaults + Override). */
  aktenplan: Map<string, ReturnType<typeof buildEffectiveMapping> extends Map<infer _, infer V> ? V : never>;
  source: 'shared' | 'absent';
}

/** Liest die gefilterte DMS-CSV vom Daten-Share und baut die Lookup-Map. */
export async function loadDmsCsvFromShare(
  datenShare: FileSystemDirectoryHandle,
): Promise<DmsLoadResult> {
  const csvText = await readText(datenShare, DMS_INDEX_FILTERED_PATH);
  const overrideText = await readText(datenShare, AKTENPLAN_MAPPING_PATH);

  let override: AktenplanMappingOverride | null = null;
  if (overrideText) {
    try {
      const parsed = JSON.parse(overrideText) as AktenplanMappingOverride;
      if (parsed && parsed.version === 1 && typeof parsed.mapping === 'object') {
        override = parsed;
      } else {
        console.warn('[phase2/dms-csv] aktenplan-mapping.json hat ungültige Struktur, ignoriert.');
      }
    } catch (e) {
      console.warn('[phase2/dms-csv] aktenplan-mapping.json nicht parsbar, ignoriert.', e);
    }
  }

  const aktenplan = buildEffectiveMapping(override);

  if (!csvText) {
    return { entries: new Map(), aktenplan, source: 'absent' };
  }

  const entries = parseDmsCsv(csvText);
  return { entries, aktenplan, source: 'shared' };
}

/**
 * Parst den Text einer gefilterten DMS-CSV und baut die DocID → DmsEntry Map.
 *
 * Erwartet die Spalten Storno|Markierung|...|DocID|Typ|Bezeichnung|Von|...|
 * Aktenplanzuordnung|...|extracted_fkz (vom Vorfilter angefügt).
 *
 * Tolerant gegenüber fehlender extracted_fkz-Spalte (extrahiert dann lazy
 * aus der Bezeichnung).
 */
export function parseDmsCsv(text: string): Map<string, DmsEntry> {
  const { header, rows } = parseCsvText(text, ';');
  const idx = (name: string) => header.findIndex(h => h.trim().toLowerCase() === name.toLowerCase());
  const docIdIdx = idx('DocID');
  const bezIdx = idx('Bezeichnung');
  const typIdx = idx('Typ');
  const aktenplanIdx = idx('Aktenplanzuordnung');
  const vonIdx = idx('Von');
  const datumIdx = idx('Datum');
  const fkzIdx = idx('extracted_fkz');

  if (docIdIdx < 0 || bezIdx < 0) {
    console.warn('[phase2/dms-csv] CSV ohne DocID/Bezeichnung-Spalte — nichts geladen.');
    return new Map();
  }

  const map = new Map<string, DmsEntry>();
  for (const row of rows) {
    const docId = (row[docIdIdx] ?? '').trim();
    if (!docId) continue;
    const bezeichnung = (row[bezIdx] ?? '').trim();
    let extractedFkz: string | null = fkzIdx >= 0 ? (row[fkzIdx] ?? '').trim() || null : null;
    if (!extractedFkz) {
      // Lazy fallback wenn extracted_fkz-Spalte fehlt
      const m = /(\d{2}[A-Z]{2})\d{6}(?!\d)/.exec(bezeichnung);
      extractedFkz = m ? m[0] : null;
    }
    const entry: DmsEntry = {
      docId,
      bezeichnung,
      aktenplan: aktenplanIdx >= 0 ? (row[aktenplanIdx] ?? '').trim() : '',
      typ: typIdx >= 0 ? (row[typIdx] ?? '').trim() : '',
      von: vonIdx >= 0 ? ((row[vonIdx] ?? '').trim() || null) : null,
      datum: datumIdx >= 0 ? ((row[datumIdx] ?? '').trim() || null) : null,
      extractedFkz,
    };
    // Map-Keys grundsätzlich lowercase — Stage 0 lookup normalisiert den
    // Scanner-Filename ebenfalls. Eine Quelle der Wahrheit, ein Eintrag pro
    // Zeile. `entry.docId` behält die Original-Schreibweise für UI/Debug.
    map.set(docId.toLowerCase(), entry);
  }
  return map;
}
