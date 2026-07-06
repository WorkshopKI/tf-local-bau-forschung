/**
 * Verbund-Aggregation der Feldwerte (aus `VerbundAlleFelder` herausgelöst,
 * Journey-Paket 2 Phase 7 — rein + testbar). Feldweise distinct über alle TVs;
 * divergente Werte `a / b / c`. Zusätzlich `verbundFelderStats` für die
 * Kontext-Vorschau der kollabierten „Alle Felder"-Sektion.
 */
import type { Antrag, CsvSchema } from '@/core/services/csv/types';
import { buildDisplayRows } from './buildDisplayRows';

/** Felder, die per Definition pro TV variieren — im Verbund-Gesamtbild
 *  ausgeblendet (die TEILVORHABEN-Section zeigt sie dediziert pro TV). */
export const TV_SPECIFIC_FIELD_KEYS = new Set<string>([
  'aktenzeichen',
  'titel',
  'status',
  'antragsteller',
  'foerdersumme',
  'tib_kuerz',
  'bib_kuerz',
  'ztp_kuerz',
  'pfm_kuerz',
]);

/**
 * Konstruiert einen synthetischen Antrag mit feldweise aggregierten Werten aus
 * allen TVs. Divergent → `value1 / value2 / value3`; einheitlich → der Wert; leer
 * bleibt leer. `_field_sources` + Pflicht-Felder (aktenzeichen, programm_id) vom
 * Lead-TV.
 */
export function mergeAntraegeForDisplay(tvs: Antrag[]): Antrag {
  const lead = tvs[0]!;
  const merged: Record<string, unknown> = {};

  const fieldKeys = new Set<string>();
  for (const tv of tvs) {
    for (const k of Object.keys(tv)) {
      if (k.startsWith('_')) continue;
      if (k === 'aktenzeichen' || k === 'programm_id') continue;
      fieldKeys.add(k);
    }
  }

  for (const k of fieldKeys) {
    const distinct: string[] = [];
    let firstRaw: unknown = null;
    for (const tv of tvs) {
      const v = (tv as unknown as Record<string, unknown>)[k];
      if (v === undefined || v === null || v === '') continue;
      const s = typeof v === 'string' ? v : String(v);
      if (!distinct.includes(s)) {
        distinct.push(s);
        if (firstRaw === null) firstRaw = v;
      }
    }
    if (distinct.length === 0) {
      merged[k] = null;
    } else if (distinct.length === 1) {
      merged[k] = firstRaw;
    } else {
      merged[k] = distinct.join(' / ');
    }
  }

  return {
    ...merged,
    aktenzeichen: lead.aktenzeichen,
    programm_id: lead.programm_id,
    _field_sources: lead._field_sources ?? {},
    _updated_at: lead._updated_at,
  } as unknown as Antrag;
}

/**
 * Feld-Kennzahlen des Verbund-Gesamtbilds für die Kontext-Vorschau: `gesamt` =
 * angezeigte Felder (TV-spezifische ausgeblendet), `mitWerten` = davon mit einem
 * echten Wert (nicht „—"). `tvs` leer → 0/0.
 */
export function verbundFelderStats(tvs: Antrag[], schemas: CsvSchema[]): { gesamt: number; mitWerten: number } {
  if (tvs.length === 0) return { gesamt: 0, mitWerten: 0 };
  const rows = buildDisplayRows(mergeAntraegeForDisplay(tvs), schemas)
    .filter(r => !TV_SPECIFIC_FIELD_KEYS.has(r.field));
  const mitWerten = rows.filter(r => r.value !== '—' && r.value.trim() !== '').length;
  return { gesamt: rows.length, mitWerten };
}
