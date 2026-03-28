import mammoth from 'mammoth';
import TurndownService from 'turndown';
import * as pdfjsLib from 'pdfjs-dist';

// Disable the separate PDF worker — run single-threaded in our inline worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
});

function makeFrontmatter(filename: string, format: string, extra?: Record<string, unknown>): string {
  const lines = [`filename: ${filename}`, `format: ${format}`, `converted: ${new Date().toISOString()}`];
  if (extra) {
    for (const [k, v] of Object.entries(extra)) lines.push(`${k}: ${String(v)}`);
  }
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
      if (lastY !== null && Math.abs(y - lastY) > 5) {
        pageText += '\n\n';
      } else if (lastY !== null) {
        pageText += ' ';
      }
      pageText += textItem.str;
      lastY = y;
    }
    pageTexts.push(pageText.trim());
  }

  return { text: pageTexts.join('\n\n---\n\n'), pages: doc.numPages };
}

self.onmessage = async (e: MessageEvent) => {
  const { type, arrayBuffer, filename, format } = e.data as {
    type: string;
    arrayBuffer: ArrayBuffer;
    filename: string;
    format: 'docx' | 'md' | 'txt' | 'pdf';
  };

  if (type !== 'convert') return;

  try {
    let markdown: string;
    let html = '';
    const warnings: string[] = [];
    let pages: number | undefined;

    if (format === 'pdf') {
      const result = await convertPdf(arrayBuffer);
      markdown = makeFrontmatter(filename, 'pdf', { pages: result.pages }) + result.text;
      pages = result.pages;
    } else if (format === 'docx') {
      const result = await mammoth.convertToHtml({ arrayBuffer });
      html = result.value;
      markdown = turndown.turndown(html);
      warnings.push(...result.messages.map(m => m.message));
      markdown = makeFrontmatter(filename, format) + markdown;
    } else {
      const decoder = new TextDecoder();
      markdown = makeFrontmatter(filename, format) + decoder.decode(arrayBuffer);
    }

    self.postMessage({ type: 'result', markdown, html, warnings, pages });
  } catch (err) {
    self.postMessage({ type: 'error', error: `Konvertierung fehlgeschlagen: ${String(err)}` });
  }
};
