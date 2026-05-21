/**
 * Export-Modul fuer die Suchtabelle.
 *
 * Drei Formate teilen `buildExportRows`:
 *  - CSV: UTF-8 BOM + Semikolon (deutscher Excel-Standard) + RFC-4180-Quoting
 *  - Clipboard: Tab-Separator, TSV-Style
 *  - XLSX: SheetJS Community Edition (`xlsx@0.18.5`) — kein Cell-Styling
 *    out-of-the-box, daher KEIN Bold-Header (Plan-Disclaimer).
 *
 * Nur die uebergebenen `columns` werden exportiert (Caller filtert auf
 * visible). Die `results`-Liste wird in der Reihenfolge exportiert in der
 * sie kommt — Caller hat sie schon sortiert + spaltengefiltert.
 */
import * as XLSX from 'xlsx';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import type { SearchColumn } from './columns';

export interface ExportRows {
  headers: string[];
  rows: (string | number)[][];
}

export function buildExportRows(
  results: UnifiedSearchResult[],
  columns: SearchColumn[],
): ExportRows {
  const headers = columns.map(c => c.label);
  const rows = results.map(r => columns.map(c => {
    const v = c.accessor(r);
    return v === undefined || v === null ? '' : v;
  }));
  return { headers, rows };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'alle';
}

function isoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function quoteCsvCell(v: string | number): string {
  const s = String(v);
  if (/[;"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // setTimeout damit Firefox/Edge die Download-Verarbeitung abschliessen koennen.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCSV(
  results: UnifiedSearchResult[],
  columns: SearchColumn[],
  query: string,
): void {
  const { headers, rows } = buildExportRows(results, columns);
  const lines = [
    headers.map(quoteCsvCell).join(';'),
    ...rows.map(row => row.map(quoteCsvCell).join(';')),
  ];
  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `teamflow-suche-${slugify(query)}-${isoDate()}.csv`);
}

export async function exportClipboard(
  results: UnifiedSearchResult[],
  columns: SearchColumn[],
): Promise<void> {
  const { headers, rows } = buildExportRows(results, columns);
  const tsv = [
    headers.join('\t'),
    ...rows.map(row => row.map(v => String(v).replace(/\t|\r|\n/g, ' ')).join('\t')),
  ].join('\r\n');
  await navigator.clipboard.writeText(tsv);
}

export function exportXLSX(
  results: UnifiedSearchResult[],
  columns: SearchColumn[],
  query: string,
): void {
  const { headers, rows } = buildExportRows(results, columns);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  // Spaltenbreiten — Excel rechnet in Char-Breiten, ~6 Pixel pro Char.
  ws['!cols'] = columns.map(c => ({
    wch: Math.max(10, Math.round(c.width / 6)),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Suche');
  XLSX.writeFile(wb, `teamflow-suche-${slugify(query)}-${isoDate()}.xlsx`);
}
