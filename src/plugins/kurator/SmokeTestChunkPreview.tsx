import type { DocumentMetadata } from '@/core/services/search/metadata-extractor';
import { contextualChunk } from '@/core/services/search/contextual-chunker';
import type { ContextualChunk } from '@/core/services/search/contextual-chunker';
import { useMemo } from 'react';

interface SmokeTestChunkPreviewProps {
  docId: string;
  filename: string;
  markdown: string;
  metadata: DocumentMetadata;
}

export function SmokeTestChunkPreview({ docId, filename, markdown, metadata }: SmokeTestChunkPreviewProps): React.ReactElement {
  const chunks = useMemo(
    () => contextualChunk(docId, filename, markdown, metadata),
    [docId, filename, markdown, metadata],
  );

  const summaryChunk = chunks.find(c => c.level === 'summary');
  const firstNormal = chunks.find(c => c.level === 'chunk');

  if (!summaryChunk && !firstNormal) {
    return (
      <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-3">
        Keine Chunks erzeugt.
      </p>
    );
  }

  return (
    <details className="mt-3 text-[11px] text-[var(--tf-text-tertiary)]">
      <summary className="cursor-pointer hover:text-[var(--tf-text-secondary)]">
        Contextual-Chunking Preview
      </summary>
      <div className="mt-2 space-y-3">
        <p className="text-[11px] text-[var(--tf-text-secondary)]">
          So würden die Chunks mit Metadata-Prefixen aussehen:
        </p>

        {summaryChunk && (
          <ChunkBlock label="Summary-Chunk (level: 'summary')" chunk={summaryChunk} showPrefixed />
        )}

        {firstNormal && (
          <>
            <ChunkBlock label="Erster Chunk — mit Prefix" chunk={firstNormal} showPrefixed />
            <ChunkBlock label="Erster Chunk — ohne Prefix (Vergleich)" chunk={firstNormal} showPrefixed={false} />
          </>
        )}
      </div>
    </details>
  );
}

function ChunkBlock({ label, chunk, showPrefixed }: {
  label: string; chunk: ContextualChunk; showPrefixed: boolean;
}): React.ReactElement {
  const text = showPrefixed ? chunk.prefixedText : chunk.text;
  return (
    <div>
      <p className="text-[11px] font-medium text-[var(--tf-text-secondary)] mb-1">{label}</p>
      <div className="p-2 bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)]">
        <pre className="text-[10px] font-mono whitespace-pre-wrap text-[var(--tf-text)]">
          {text.slice(0, 600)}{text.length > 600 ? '…' : ''}
        </pre>
      </div>
    </div>
  );
}
