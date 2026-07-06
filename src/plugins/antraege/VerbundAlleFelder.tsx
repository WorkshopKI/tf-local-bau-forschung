import { useMemo } from 'react';
import type { Antrag, CsvSchema } from '@/core/services/csv/types';
import { buildDisplayRows, groupDisplayRows, type DisplayGroup, AlleFelderSection } from './alleFelder';
import { mergeAntraegeForDisplay, TV_SPECIFIC_FIELD_KEYS } from './alleFelder/verbundMerge';

interface Props {
  tvs: Antrag[];
  schemas: CsvSchema[];
  sourceNames: Record<string, string>;
  historyCounts: Record<string, number>;
  onOpenHistory: (field: string) => void;
}

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
    const rows = buildDisplayRows(merged, schemas).filter(r => !TV_SPECIFIC_FIELD_KEYS.has(r.field));
    return groupDisplayRows(rows, schemas);
  }, [tvs, schemas]);

  return (
    <AlleFelderSection
      groups={groups}
      schemas={schemas}
      sourceNames={sourceNames}
      historyCounts={historyCounts}
      onOpenHistory={onOpenHistory}
      headerVariant="section"
    />
  );
}
