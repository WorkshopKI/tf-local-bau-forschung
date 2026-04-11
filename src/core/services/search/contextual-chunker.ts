import type { DocumentMetadata } from './metadata-extractor';
import { chunkByHeadings } from './chunking';

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

  const rawChunks = chunkByHeadings(text);

  for (let i = 0; i < rawChunks.length; i++) {
    const chunkText = rawChunks[i]!;

    const headingMatch = chunkText.match(/^#{2,3}\s+(.+)/);
    const heading = headingMatch ? headingMatch[1] : undefined;

    let prefixedText = chunkText;
    if (metadata && metadata.micro_summary && metadata.doc_type !== 'Sonstiges') {
      prefixedText = `[${metadata.doc_type}] ${metadata.micro_summary}\n${chunkText}`;
    }

    chunks.push({
      id: `${docId}-${i}`,
      text: chunkText,
      prefixedText,
      source: filename,
      level: 'chunk',
      heading,
    });
  }

  return chunks;
}
