import mammoth from 'mammoth';
import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
});

function makeFrontmatter(filename: string, format: string): string {
  return `---\nfilename: ${filename}\nformat: ${format}\nconverted: ${new Date().toISOString()}\n---\n\n`;
}

self.onmessage = async (e: MessageEvent) => {
  const { type, arrayBuffer, filename, format } = e.data as {
    type: string;
    arrayBuffer: ArrayBuffer;
    filename: string;
    format: 'docx' | 'md' | 'txt';
  };

  if (type !== 'convert') return;

  try {
    let markdown: string;
    let html = '';
    const warnings: string[] = [];

    if (format === 'docx') {
      const result = await mammoth.convertToHtml({ arrayBuffer });
      html = result.value;
      markdown = turndown.turndown(html);
      warnings.push(...result.messages.map(m => m.message));
    } else {
      const decoder = new TextDecoder();
      markdown = decoder.decode(arrayBuffer);
    }

    markdown = makeFrontmatter(filename, format) + markdown;
    self.postMessage({ type: 'result', markdown, html, warnings });
  } catch (err) {
    self.postMessage({ type: 'error', error: String(err) });
  }
};
