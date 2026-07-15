import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';
import * as pdfjsLib from 'pdfjs-dist';
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';
import { buildConversionReport, type ConversionReport } from './conversion-report';
import { pdfPageToMarkdown, type PdfTextFragment } from './pdf-tables';

export type { ConversionReport, ConversionWarning, ConversionLevel } from './conversion-report';
export { maxConversionLevel } from './conversion-report';

// pdfjs-Worker als Blob-URL — einmalig beim Modul-Load, funktioniert unter file://
// eslint-disable-next-line @typescript-eslint/no-explicit-any
pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker() as any;

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
turndown.use(tables);

// Fallback: Tabellen ohne <thead>/<th>-Header (häufig in DOCX)
turndown.addRule('headerlessTable', {
  filter(node) {
    if (node.nodeName !== 'TABLE') return false;
    const rows = (node as HTMLTableElement).rows;
    if (!rows || rows.length === 0) return false;
    const first = rows.item(0);
    if (!first) return false;
    if (first.parentNode?.nodeName === 'THEAD') return false;
    return !Array.from(first.cells).every(c => c.nodeName === 'TH');
  },
  replacement(_content, node) {
    const rows = Array.from((node as HTMLTableElement).rows);
    const first = rows[0];
    if (!first) return '';
    const cellCount = first.cells.length;
    const toLine = (row: HTMLTableRowElement): string =>
      '| ' + Array.from(row.cells).map(c => c.textContent?.trim() || '').join(' | ') + ' |';
    const header = toLine(first);
    const sep = '| ' + Array(cellCount).fill('---').join(' | ') + ' |';
    const body = rows.slice(1).map(toLine);
    return '\n\n' + [header, sep, ...body].join('\n') + '\n\n';
  },
});

export interface ConvertedDoc {
  markdown: string;
  html: string;
  warnings: string[];
  filename: string;
  format: string;
  pages?: number;
  /** Konvertierungs-Qualität (Zeichen, Tabellen/Bilder, Warnungen). */
  report: ConversionReport;
}

function makeFrontmatter(filename: string, format: string, extra?: Record<string, unknown>): string {
  const lines = [`filename: ${filename}`, `format: ${format}`, `converted: ${new Date().toISOString()}`];
  if (extra) for (const [k, v] of Object.entries(extra)) lines.push(`${k}: ${String(v)}`);
  return `---\n${lines.join('\n')}\n---\n\n`;
}

async function convertPdf(arrayBuffer: ArrayBuffer): Promise<{ text: string; pages: number }> {
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Positionierte Fragmente einsammeln; pdfPageToMarkdown rekonstruiert Zeilen +
    // Tabellen daraus (Flattext-Fallback, wo keine Tabelle erkennbar ist).
    const frags: PdfTextFragment[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const t = item as { str: string; transform: number[]; width?: number };
      if (!t.str) continue;
      frags.push({ str: t.str, x: t.transform[4] ?? 0, y: t.transform[5] ?? 0, width: t.width ?? 0 });
    }
    pageTexts.push(pdfPageToMarkdown(frags).trim());
  }

  return { text: pageTexts.join('\n\n---\n\n'), pages: doc.numPages };
}

export class DocConverter {
  async convert(file: File): Promise<ConvertedDoc> {
    const arrayBuffer = await file.arrayBuffer();
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'txt';
    const format = ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : ext === 'md' ? 'md' : 'txt';

    let markdown: string;
    let html = '';
    const warnings: string[] = [];
    let pages: number | undefined;
    let report: ConversionReport;

    if (format === 'pdf') {
      const result = await convertPdf(arrayBuffer);
      markdown = makeFrontmatter(file.name, 'pdf', { pages: result.pages }) + result.text;
      pages = result.pages;
      report = buildConversionReport({ format, text: result.text, pages: result.pages });
    } else if (format === 'docx') {
      const result = await mammoth.convertToHtml({ arrayBuffer });
      html = result.value;
      const body = turndown.turndown(html);
      const mammothMessages = result.messages.map(m => m.message);
      warnings.push(...mammothMessages);
      markdown = makeFrontmatter(file.name, format) + body;
      report = buildConversionReport({ format, text: body, html, mammothMessages });
    } else {
      const text = new TextDecoder().decode(arrayBuffer);
      markdown = makeFrontmatter(file.name, format) + text;
      report = buildConversionReport({ format, text });
    }

    return { markdown, html, warnings, filename: file.name, format, pages, report };
  }

  // Kein Worker mehr — destroy() bleibt für API-Kompatibilität
  destroy(): void { /* no-op */ }
}
