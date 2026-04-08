import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';
import * as pdfjsLib from 'pdfjs-dist';
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';

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
    let lastY: number | null = null;
    let pageText = '';

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const textItem = item as { str: string; transform: number[] };
      const y = textItem.transform[5] ?? 0;
      if (lastY !== null && Math.abs(y - lastY) > 5) pageText += '\n\n';
      else if (lastY !== null) pageText += ' ';
      pageText += textItem.str;
      lastY = y;
    }
    pageTexts.push(pageText.trim());
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

    if (format === 'pdf') {
      const result = await convertPdf(arrayBuffer);
      markdown = makeFrontmatter(file.name, 'pdf', { pages: result.pages }) + result.text;
      pages = result.pages;
    } else if (format === 'docx') {
      const result = await mammoth.convertToHtml({ arrayBuffer });
      html = result.value;
      markdown = turndown.turndown(html);
      warnings.push(...result.messages.map(m => m.message));
      markdown = makeFrontmatter(file.name, format) + markdown;
    } else {
      markdown = makeFrontmatter(file.name, format) + new TextDecoder().decode(arrayBuffer);
    }

    return { markdown, html, warnings, filename: file.name, format, pages };
  }

  // Kein Worker mehr — destroy() bleibt für API-Kompatibilität
  destroy(): void { /* no-op */ }
}
