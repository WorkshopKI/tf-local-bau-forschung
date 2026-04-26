import * as XLSX from 'xlsx';
import { bestMatch } from './fuzzy';
import { CANONICAL_FIELDS } from '../constants';
import type { AmbiguousMergeResolution, CanonicalField } from '../types';

/** Ein Eintrag pro CSV-Spalte aus dem hierarchischen Label-XLS. */
export interface ColumnLabelEntry {
  csv_column: string;
  /** Label aus Zeile N-1; Fallback = csv_column bei leerer Zelle. */
  label: string;
  /** Gruppen-Pfad aus Zeilen 1..N-2, leere Ebenen entfernt. */
  group_path: string[];
}

export interface MergeRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

/** Ein Merge, der die Label-Zeile zusammen mit mindestens einer Gruppen-Zeile umspannt. */
export interface AmbiguousMerge {
  /** Signatur für State-Map: "<value>@<startRow>:<startCol>". */
  signature: string;
  value: string;
  /** CSV-Spaltennamen (aus Zeile N) der betroffenen Spalten. */
  affected_columns: string[];
  merge_range: MergeRange;
  span_header_rows: number;
  default_resolution: AmbiguousMergeResolution;
}

export interface LabelParseResult {
  columnEntries: ColumnLabelEntry[];
  ambiguousMerges: AmbiguousMerge[];
}

export interface LabelSuggestion {
  csvColumn: string;
  label: string;
  canonical: CanonicalField | null;
  confidence: number;
}

/**
 * Parst eine XLSX-Datei mit N Header-Zeilen (2-8).
 *
 * Konvention:
 *  - Zeile N (letzte):   kryptische CSV-Spaltennamen (Join zur CSV)
 *  - Zeile N-1:          individuelles Label pro Spalte (kann leer sein -> Fallback csv_column)
 *  - Zeilen 1..N-2:      Gruppen-Ebenen (horizontal merged cells); bei N=2 nicht vorhanden
 *
 * Sonderfall: Eine merged cell kann vertikal mehrere Header-Zeilen umspannen
 * (typisch: Gruppen- und Label-Zeile zusammen). Der Parser sammelt solche Fälle
 * in `ambiguousMerges` und wendet default "als Gruppe" an (value wird letzte Gruppen-Ebene,
 * Label bleibt CSV-Name).
 */
export async function parseLabelXlsx(
  file: File,
  headerRowCount: number,
): Promise<LabelParseResult> {
  if (!Number.isInteger(headerRowCount) || headerRowCount < 2 || headerRowCount > 8) {
    throw new Error('headerRowCount muss zwischen 2 und 8 liegen.');
  }

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return { columnEntries: [], ambiguousMerges: [] };
  const ws = wb.Sheets[firstSheetName];
  if (!ws) return { columnEntries: [], ambiguousMerges: [] };

  const merges = ws['!merges'] ?? [];

  const csvRow = headerRowCount - 1;       // 0-indexed: N=4 -> Index 3
  const labelRow = headerRowCount - 2;     // 0-indexed: N=4 -> Index 2
  const groupRowStart = 0;
  const groupRowEnd = headerRowCount - 3;  // -1 wenn N=2 (keine Gruppen)

  function findMerge(row: number, col: number): MergeRange | null {
    const m = merges.find(
      mr => row >= mr.s.r && row <= mr.e.r && col >= mr.s.c && col <= mr.e.c,
    );
    if (!m) return null;
    return { startRow: m.s.r, endRow: m.e.r, startCol: m.s.c, endCol: m.e.c };
  }

  function getCellValue(row: number, col: number): string {
    if (!ws) return '';
    const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
    return cell?.v !== undefined && cell.v !== null ? String(cell.v).trim() : '';
  }

  function getMergedValue(row: number, col: number): string {
    const m = findMerge(row, col);
    if (m) return getCellValue(m.startRow, m.startCol);
    return getCellValue(row, col);
  }

  const columnEntries: ColumnLabelEntry[] = [];
  const ambiguousMap = new Map<string, AmbiguousMerge>();
  const MAX_COLS = 500;

  for (let col = 0; col < MAX_COLS; col++) {
    const csvName = getCellValue(csvRow, col);
    if (!csvName) break; // Tabellen-Ende

    // Label: Fallback auf csv_column wenn leer
    const rawLabel = getMergedValue(labelRow, col);
    const label = rawLabel !== '' ? rawLabel : csvName;

    // Ambiger Merge: Label-Zelle ist Teil eines Merges der mind. eine Gruppen-Zeile umspannt
    const labelMerge = findMerge(labelRow, col);
    const isAmbiguous =
      !!labelMerge &&
      labelMerge.startRow < labelRow &&
      groupRowEnd >= groupRowStart; // nur möglich wenn überhaupt Gruppen-Zeilen existieren

    // Group path: Zeilen 1..N-2 top-down, leere Ebenen überspringen
    const groupPath: string[] = [];
    if (groupRowEnd >= groupRowStart) {
      for (let r = groupRowStart; r <= groupRowEnd; r++) {
        const val = getMergedValue(r, col);
        if (val !== '') groupPath.push(val);
      }
    }

    if (isAmbiguous && labelMerge) {
      // default "als Gruppe": Wert landet als zusätzliche Gruppen-Ebene wenn nicht bereits drin,
      // Label fällt auf CSV-Name zurück.
      const mergeValue = getCellValue(labelMerge.startRow, labelMerge.startCol);
      const finalLabel = csvName;
      const finalGroupPath = [...groupPath];
      if (mergeValue && !finalGroupPath.includes(mergeValue)) {
        finalGroupPath.push(mergeValue);
      }

      columnEntries.push({
        csv_column: csvName,
        label: finalLabel,
        group_path: finalGroupPath,
      });

      const sig = `${mergeValue}@${labelMerge.startRow}:${labelMerge.startCol}`;
      const existing = ambiguousMap.get(sig);
      if (existing) {
        existing.affected_columns.push(csvName);
      } else {
        ambiguousMap.set(sig, {
          signature: sig,
          value: mergeValue,
          affected_columns: [csvName],
          merge_range: labelMerge,
          span_header_rows: labelMerge.endRow - labelMerge.startRow + 1,
          default_resolution: 'group',
        });
      }
    } else {
      columnEntries.push({
        csv_column: csvName,
        label,
        group_path: groupPath,
      });
    }
  }

  return { columnEntries, ambiguousMerges: Array.from(ambiguousMap.values()) };
}

/**
 * Wendet eine Admin-Resolution auf einen AmbiguousMerge an und liefert
 * modifizierte ColumnLabelEntry-Versionen für die betroffenen Spalten.
 */
export function applyAmbiguousResolution(
  entries: ColumnLabelEntry[],
  merge: AmbiguousMerge,
  resolution: AmbiguousMergeResolution,
): ColumnLabelEntry[] {
  const affected = new Set(merge.affected_columns);
  return entries.map(e => {
    if (!affected.has(e.csv_column)) return e;
    if (resolution === 'group') {
      // Default: Wert bleibt in group_path, Label = csv_column
      const gp = [...e.group_path];
      if (!gp.includes(merge.value)) gp.push(merge.value);
      return { ...e, label: e.csv_column, group_path: gp };
    }
    if (resolution === 'label_repeated') {
      // Value wird individuelles Label jeder Spalte, aus Gruppen-Pfad entfernt
      return {
        ...e,
        label: merge.value,
        group_path: e.group_path.filter(g => g !== merge.value),
      };
    }
    // ignore: Value komplett aus Pfad entfernen, Label = csv_column
    return {
      ...e,
      label: e.csv_column,
      group_path: e.group_path.filter(g => g !== merge.value),
    };
  });
}

/** Mindest-Konfidenz, ab der ein Fuzzy-Match überhaupt als Standardfeld-Vorschlag gilt. */
const MIN_SUGGESTION_CONFIDENCE = 0.5;

/**
 * Matcht Label-Einträge gegen vorhandene Preview-Header und kanonische Feld-Labels.
 * Liefert nur Suggestions mit ausreichender Ähnlichkeit zurück (Konfidenz ≥ 50%);
 * Spalten ohne plausibles Standardfeld-Match werden weggelassen, damit die Liste
 * im Wizard nicht mit Rauschen (0%/17%/29%-Treffern) zugemüllt wird.
 */
export function buildSuggestions(
  previewHeaders: string[],
  result: LabelParseResult,
): LabelSuggestion[] {
  const byColumn = new Map<string, ColumnLabelEntry>();
  for (const e of result.columnEntries) {
    byColumn.set(e.csv_column.toLowerCase().trim(), e);
  }

  const canonicalLabels = CANONICAL_FIELDS.map(f => f.label);

  const suggestions: LabelSuggestion[] = [];
  for (const col of previewHeaders) {
    const entry = byColumn.get(col.toLowerCase().trim());
    if (!entry) continue;
    const match = bestMatch(entry.label, canonicalLabels, 3);
    if (!match || match.confidence < MIN_SUGGESTION_CONFIDENCE) continue;
    const canonField = CANONICAL_FIELDS.find(f => f.label === match.candidate);
    if (!canonField) continue;
    suggestions.push({
      csvColumn: col,
      label: entry.label,
      canonical: canonField.key,
      confidence: match.confidence,
    });
  }
  return suggestions;
}
