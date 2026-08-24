import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';
import * as pdfjsLib from 'pdfjs-dist';
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';
import { buildConversionReport, type ConversionReport, type PdfStrukturStufe } from './conversion-report';
import { istFehlendesPdfAsset, sammlePdfWarnungen, PDF_ASSET_MELDUNG } from './pdf-assets';
import { pdfPageToMarkdown, pdfSeitenZeilen, type PdfTextFragment } from './pdf-tables';
import { pdfStrukturSeiteZuMarkdown, type PdfMarkiertesElement, type PdfStrukturKnoten } from './pdf-struktur';
import { ermittleUeberschriftsSkala, ueberschriftStufe, type GroessenZeile } from './pdf-ueberschriften';

export type { ConversionReport, ConversionWarning, ConversionLevel, PdfStrukturStufe } from './conversion-report';
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

/**
 * PDF → Text. Der ganze Lauf steckt in `sammlePdfWarnungen`, weil pdf.js ein
 * fehlendes CMap-/Schrift-/WASM-Asset NICHT wirft, sondern warnt und weniger
 * Text liefert (siehe `pdf-assets.ts`). Wirft es doch, wird der Wurf in einen
 * lesbaren Satz übersetzt statt roh durchgereicht.
 */
async function convertPdf(
  arrayBuffer: ArrayBuffer,
): Promise<{ text: string; pages: number; cmapFehlt: boolean; stufe: PdfStrukturStufe }> {
  try {
    const { ergebnis, cmapFehlt } = await sammlePdfWarnungen(
      () => leseAllePdfSeiten(arrayBuffer),
    );
    return { ...ergebnis, cmapFehlt };
  } catch (err) {
    if (istFehlendesPdfAsset(err)) throw new Error(PDF_ASSET_MELDUNG);
    throw err;
  }
}

/**
 * Der Tag-Baum gilt nur, wenn er den Text auch WIRKLICH trägt: teilgetaggte
 * PDFs (Word-Serienbriefe, nachträglich zusammengeheftete Seiten) liefern einen
 * Baum, der nur ein paar Absätze kennt. Unter diesem Anteil am Flattext ist die
 * Positions-Rekonstruktion die ehrlichere Quelle.
 */
const MIN_STRUKTUR_ANTEIL = 0.6;

const SEITEN_TRENNER = '\n\n---\n\n';

/** Eine gelesene Seite in beiden Lesarten — Tag-Baum und Positionen. */
interface SeitenLesung {
  strukturiert: string;
  frags: PdfTextFragment[];
}

/**
 * PDF-Seiten in drei Sprossen lesen (Reihenfolge = absteigende Verlässlichkeit):
 *
 *  1. `strukturiert` — der Tag-Baum trägt die Gliederung (Word-Export). Echte
 *     Überschriften, Listen, Tabellen; Kopf-/Fußzeilen fallen als Artefakte weg.
 *  2. `geschaetzt` — kein (brauchbarer) Baum, aber die Schriftgrößen trennen
 *     Überschrift von Fließtext.
 *  3. `flach` — nur Text. Wie bisher, und der Bericht sagt es dem Bearbeiter.
 */
async function leseAllePdfSeiten(
  arrayBuffer: ArrayBuffer,
): Promise<{ text: string; pages: number; stufe: PdfStrukturStufe }> {
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const seiten: SeitenLesung[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    // EIN Lauf für beide Lesarten: die Marker kommen zusätzlich zwischen die
    // Textstücke, die Textstücke selbst bleiben unverändert.
    const content = await page.getTextContent({ includeMarkedContent: true });
    let baum: PdfStrukturKnoten | null = null;
    try {
      baum = (await page.getStructTree()) as PdfStrukturKnoten | null;
    } catch {
      baum = null; // ungetaggtes PDF — Sprosse 2/3 übernehmen
    }

    const frags: PdfTextFragment[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const t = item as { str: string; transform: number[]; width?: number; height?: number };
      if (!t.str) continue;
      frags.push({
        str: t.str,
        x: t.transform[4] ?? 0,
        y: t.transform[5] ?? 0,
        width: t.width ?? 0,
        groesse: t.height ?? 0,
      });
    }

    seiten.push({
      strukturiert: pdfStrukturSeiteZuMarkdown(baum, content.items as PdfMarkiertesElement[]).trim(),
      frags,
    });
  }

  const flachLaenge = seiten.reduce((n, s) => n + s.frags.reduce((m, f) => m + f.str.length, 0), 0);
  const strukturLaenge = seiten.reduce((n, s) => n + s.strukturiert.length, 0);
  const hatUeberschriften = seiten.some(s => /^#{1,6} /m.test(s.strukturiert));

  if (hatUeberschriften && strukturLaenge >= flachLaenge * MIN_STRUKTUR_ANTEIL) {
    return {
      text: seiten.map(s => s.strukturiert).join(SEITEN_TRENNER),
      pages: doc.numPages,
      stufe: 'strukturiert',
    };
  }

  // Sprosse 2: Skala über ALLE Seiten, dann je Seite anwenden.
  const alleZeilen: GroessenZeile[] = seiten.flatMap(s => pdfSeitenZeilen(s.frags)).filter(z => z.text.length > 0);
  const skala = ermittleUeberschriftsSkala(alleZeilen);
  const stufeFuer = skala.stufen.length > 0
    ? (z: GroessenZeile): number | null => ueberschriftStufe(z, skala)
    : undefined;

  return {
    text: seiten.map(s => pdfPageToMarkdown(s.frags, stufeFuer).trim()).join(SEITEN_TRENNER),
    pages: doc.numPages,
    stufe: stufeFuer ? 'geschaetzt' : 'flach',
  };
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
      markdown = makeFrontmatter(file.name, 'pdf', { pages: result.pages, struktur: result.stufe }) + result.text;
      pages = result.pages;
      report = buildConversionReport({
        format, text: result.text, pages: result.pages, pdfCmapFehlt: result.cmapFehlt,
        pdfStruktur: result.stufe,
      });
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
