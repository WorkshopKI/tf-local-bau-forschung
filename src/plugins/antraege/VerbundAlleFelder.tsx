import { useMemo } from 'react';
import type { Antrag, CsvSchema } from '@/core/services/csv/types';
import { buildDisplayRows, groupDisplayRows, type DisplayGroup } from './buildDisplayRows';
import { AlleFelderSection } from './AlleFelderSection';

interface Props {
  tvs: Antrag[];
  schemas: CsvSchema[];
  sourceNames: Record<string, string>;
  historyCounts: Record<string, number>;
  onOpenHistory: (field: string) => void;
}

/** Felder die per Definition pro TV variieren — werden im Verbund-Verbund-
 *  Gesamtbild aus der ALLE-FELDER-Section ausgeblendet, weil die
 *  TEILVORHABEN-Section sie bereits dediziert pro TV zeigt. */
const TV_SPECIFIC_FIELD_KEYS = new Set([
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
 * Verbund-Variante der ALLE-FELDER-Section. Aggregiert die Feldwerte aus
 * allen TVs zu einem synthetischen "Merged-Antrag", der dann durch die
 * Standard-`AlleFelderSection` läuft:
 *
 * - Pro Feld werden distinct-Values über alle TVs gesammelt.
 * - Einheitlicher Wert → wird normal angezeigt.
 * - Divergente Werte → kommagetrennt mit „ / "-Separator.
 * - Felder, die per Definition TV-spezifisch sind (Aktenzeichen, Titel,
 *   Status, Antragsteller, Fördersumme, Bearbeiter-Kürzel), werden hier
 *   ausgeblendet — sie stehen in der TEILVORHABEN-Section pro TV.
 *
 * Die Source-Tracking-Informationen (`_field_sources`) kommen vom Lead-TV,
 * damit `groupDisplayRows` die richtige Gruppierung über das CSV-Schema
 * findet.
 */
export function VerbundAlleFelder({
  tvs,
  schemas,
  sourceNames,
  historyCounts,
  onOpenHistory,
}: Props): React.ReactElement {
  const groups: DisplayGroup[] = useMemo(() => {
    if (tvs.length === 0) return [];
    const merged = mergeAntraegeForDisplay(tvs);
    const rows = buildDisplayRows(merged).filter(r => !TV_SPECIFIC_FIELD_KEYS.has(r.field));
    return groupDisplayRows(rows, schemas);
  }, [tvs, schemas]);

  return (
    <AlleFelderSection
      groups={groups}
      schemas={schemas}
      sourceNames={sourceNames}
      historyCounts={historyCounts}
      onOpenHistory={onOpenHistory}
    />
  );
}

/**
 * Konstruiert einen synthetischen Antrag mit feldweise aggregierten Werten
 * aus allen TVs. Bei divergent: `value1 / value2 / value3`. Bei einheitlich:
 * der Wert.  Leere Felder bleiben leer. `_field_sources` und Pflicht-Felder
 * (aktenzeichen, programm_id) werden vom Lead-TV übernommen.
 */
function mergeAntraegeForDisplay(tvs: Antrag[]): Antrag {
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
