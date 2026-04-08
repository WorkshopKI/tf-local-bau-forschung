import type { DocumentMetadata } from './metadata-extractor';

export interface ContextualChunk {
  id: string;
  text: string;
  prefixedText: string;
  source: string;
  level: 'summary' | 'chunk';
  heading?: string;
}

export function contextualChunk(
  docId: string,
  filename: string,
  text: string,
  metadata: DocumentMetadata | null,
  chunkSize = 200,
  overlap = 50,
): ContextualChunk[] {
  const chunks: ContextualChunk[] = [];

  if (metadata?.macro_summary && metadata.macro_summary.length > 50) {
    const summaryPrefix = metadata.doc_type !== 'Sonstiges'
      ? `[${metadata.doc_type}] `
      : '';
    chunks.push({
      id: `${docId}-summary`,
      text: metadata.macro_summary,
      prefixedText: `${summaryPrefix}${metadata.macro_summary}`,
      source: filename,
      level: 'summary',
    });
  }

  const words = text.split(/\s+/);
  let chunkIndex = 0;

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunkWords = words.slice(i, i + chunkSize);
    const chunkText = chunkWords.join(' ');
    if (chunkText.trim().length < 50) continue;

    const textBefore = words.slice(0, i + chunkSize).join(' ');
    const headingMatch = textBefore.match(/##\s+([^\n]+)/g);
    const heading = headingMatch ? headingMatch[headingMatch.length - 1]?.replace(/^##\s+/, '') : undefined;

    let prefixedText = chunkText;
    if (metadata && metadata.micro_summary && metadata.doc_type !== 'Sonstiges') {
      prefixedText = `[${metadata.doc_type}] ${metadata.micro_summary}\n${chunkText}`;
    }

    chunks.push({
      id: `${docId}-${chunkIndex}`,
      text: chunkText,
      prefixedText,
      source: filename,
      level: 'chunk',
      heading,
    });

    chunkIndex++;
    if (i + chunkSize >= words.length) break;
  }

  return chunks;
}
