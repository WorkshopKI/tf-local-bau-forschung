/**
 * Read-only Pane mit kindigem Inline-Highlight (Original-Mailtext: PII amber;
 * Finale Antwort: eingesetzte Originale blau). Höhe kommt vom gemeinsamen
 * Resizer (`useSyncedPaneHeight`). Bei `highlight=false` reiner Text.
 */
import { useMemo } from 'react';
import { buildKindedSegments, MARK_CLASS, type KindedRange, type MarkKind } from './highlight';

interface Props {
  text: string;
  ranges: KindedRange[];
  highlight: boolean;
  heightPx: number;
  mono?: boolean;
  emptyHint?: string;
  /** Optional: Ref auf das scrollbare Pane (für Synchron-Scrollen). */
  paneRef?: React.Ref<HTMLDivElement>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}

export function HighlightedText({ text, ranges, highlight, heightPx, mono, emptyHint, paneRef, onScroll }: Props): React.ReactElement {
  const segs = useMemo(
    () => (highlight ? buildKindedSegments(text, ranges) : [{ text, kind: null as MarkKind | null }]),
    [text, ranges, highlight],
  );

  return (
    <div ref={paneRef} onScroll={onScroll} className={`awd-pane${mono ? ' mono' : ''}`} style={{ height: heightPx }}>
      {text
        ? segs.map((s, i) =>
            s.kind
              ? <mark key={i} className={MARK_CLASS[s.kind]}>{s.text}</mark>
              : <span key={i}>{s.text}</span>,
          )
        : <span className="awd-empty">{emptyHint ?? '—'}</span>}
    </div>
  );
}
