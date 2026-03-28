import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Header, Footer, PageNumber,
} from 'docx';
import { saveAs } from 'file-saver';
import { DOCX_CONFIG } from './docx-templates';
import type { Artifact, Vorgang } from '@/core/types/vorgang';

interface ExportMeta {
  title: string;
  author: string;
  date: string;
  vorgangId: string;
}

function parseMarkdownToParagraphs(markdown: string): Paragraph[] {
  const lines = markdown.split('\n');
  const paragraphs: Paragraph[] = [];
  const cfg = DOCX_CONFIG;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Headings
    if (trimmed.startsWith('### ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: trimmed.slice(4), font: cfg.font, size: cfg.fontSize, bold: true })],
      }));
    } else if (trimmed.startsWith('## ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: trimmed.slice(3), font: cfg.font, size: cfg.heading2Size, bold: true })],
      }));
    } else if (trimmed.startsWith('# ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: trimmed.slice(2), font: cfg.font, size: cfg.heading1Size, bold: true })],
      }));
    } else if (trimmed.startsWith('---')) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: '—'.repeat(40), font: cfg.font, size: cfg.fontSize, color: '999999' })] }));
    } else if (trimmed.match(/^\d+\.\s/)) {
      // Numbered list
      const text = trimmed.replace(/^\d+\.\s/, '');
      paragraphs.push(new Paragraph({
        numbering: { reference: 'default-numbering', level: 0 },
        children: parseInlineFormatting(text, cfg),
      }));
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      // Bullet list
      paragraphs.push(new Paragraph({
        bullet: { level: 0 },
        children: parseInlineFormatting(trimmed.slice(2), cfg),
      }));
    } else if (trimmed.startsWith('> ')) {
      paragraphs.push(new Paragraph({
        indent: { left: 720 },
        children: [new TextRun({ text: trimmed.slice(2), font: cfg.font, size: cfg.fontSize, italics: true, color: '666666' })],
      }));
    } else {
      paragraphs.push(new Paragraph({
        spacing: { after: 120, line: cfg.lineSpacing },
        children: parseInlineFormatting(trimmed, cfg),
      }));
    }
  }

  return paragraphs;
}

function parseInlineFormatting(text: string, cfg: typeof DOCX_CONFIG): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index), font: cfg.font, size: cfg.fontSize }));
    }
    if (match[1]) {
      runs.push(new TextRun({ text: match[1], font: cfg.font, size: cfg.fontSize, bold: true }));
    } else if (match[2]) {
      runs.push(new TextRun({ text: match[2], font: cfg.font, size: cfg.fontSize, italics: true }));
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), font: cfg.font, size: cfg.fontSize }));
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text, font: cfg.font, size: cfg.fontSize }));
  }

  return runs;
}

export async function markdownToDocx(markdown: string, meta: ExportMeta): Promise<Blob> {
  const cfg = DOCX_CONFIG;
  const paragraphs = parseMarkdownToParagraphs(markdown);

  const doc = new Document({
    title: meta.title,
    creator: meta.author,
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{ level: 0, format: 'decimal' as const, text: '%1.', alignment: AlignmentType.START }],
      }],
    },
    sections: [{
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: cfg.briefkopf, font: cfg.font, size: 16, color: '999999' })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `${cfg.footerPrefix}${meta.vorgangId} · Seite `, font: cfg.font, size: 16, color: '999999' }),
              new TextRun({ children: [PageNumber.CURRENT], font: cfg.font, size: 16, color: '999999' }),
            ],
          })],
        }),
      },
      children: paragraphs,
    }],
  });

  return Packer.toBlob(doc);
}

export async function exportArtifact(artifact: Artifact, vorgang: Vorgang): Promise<void> {
  const blob = await markdownToDocx(artifact.content, {
    title: `${artifact.type} — ${vorgang.title}`,
    author: artifact.author,
    date: artifact.created,
    vorgangId: vorgang.id,
  });

  const filename = `${artifact.type}_${vorgang.id}_${new Date().toISOString().slice(0, 10)}.docx`;
  saveAs(blob, filename);
}

export async function exportArtifactToFs(
  artifact: Artifact,
  vorgang: Vorgang,
  fs: { writeFile: (path: string, content: string) => Promise<void> },
): Promise<string> {
  const blob = await markdownToDocx(artifact.content, {
    title: `${artifact.type} — ${vorgang.title}`,
    author: artifact.author,
    date: artifact.created,
    vorgangId: vorgang.id,
  });

  const dir = vorgang.type === 'bauantrag' ? 'vorgaenge/bauantraege' : 'vorgaenge/forschung';
  const filename = `${artifact.type}_${new Date().toISOString().slice(0, 10)}.docx`;
  const path = `${dir}/${vorgang.id}/export/${filename}`;

  const arrayBuffer = await blob.arrayBuffer();
  const binary = Array.from(new Uint8Array(arrayBuffer)).map(b => String.fromCharCode(b)).join('');
  await fs.writeFile(path, binary);

  return `export/${filename}`;
}
