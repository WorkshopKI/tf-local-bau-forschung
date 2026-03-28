import { useState, useEffect } from 'react';
import { History, MessageSquare } from 'lucide-react';
import { MarkdownEditor } from './MarkdownEditor';
import { MarkdownRenderer } from './MarkdownRenderer';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import { ReviewPanel } from './ReviewPanel';
import { reviewService } from '@/core/services/review/review-service';
import { useStorage } from '@/core/hooks/useStorage';
import type { Extension } from '@codemirror/state';

interface MarkdownEditorWithPreviewProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  extensions?: Extension[];
  toolbar?: React.ReactNode;
  documentId?: string;
}

type ViewMode = 'split' | 'editor' | 'preview';

export function MarkdownEditorWithPreview({
  value, onChange, placeholder, readOnly, extensions, toolbar, documentId,
}: MarkdownEditorWithPreviewProps): React.ReactElement {
  const storage = useStorage();
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [showHistory, setShowHistory] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [openComments, setOpenComments] = useState(0);
  const [pendingAnchor, setPendingAnchor] = useState<{ from: number; to: number; quotedText: string } | null>(null);

  useEffect(() => {
    if (documentId) {
      reviewService.loadReviews(documentId, storage).then(s => {
        setOpenComments(reviewService.getOpenCount(s));
      });
    }
  }, [documentId, storage]);

  const handleAddComment = (): void => {
    // Simple approach: use prompt to get selected text range
    const sel = window.getSelection();
    if (sel && sel.toString().trim()) {
      const quotedText = sel.toString();
      const from = value.indexOf(quotedText);
      if (from >= 0) {
        setPendingAnchor({ from, to: from + quotedText.length, quotedText });
        setShowReview(true);
      }
    }
  };

  const btnClass = (active: boolean): string =>
    `px-2.5 py-1 text-[12px] rounded-[var(--tf-radius)] cursor-pointer transition-colors flex items-center gap-1 ${
      active ? 'bg-[var(--tf-text)] text-[var(--tf-bg)]' : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
    }`;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          {(['editor', 'split', 'preview'] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`px-2.5 py-1 text-[12px] rounded-[var(--tf-radius)] cursor-pointer transition-colors ${
                viewMode === mode ? 'bg-[var(--tf-text)] text-[var(--tf-bg)]' : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
              }`}>
              {mode === 'editor' ? 'Editor' : mode === 'preview' ? 'Vorschau' : 'Split'}
            </button>
          ))}
          {documentId && (
            <>
              <button onClick={() => { setShowHistory(prev => !prev); setShowReview(false); }} className={btnClass(showHistory)}>
                <History size={12} /> Verlauf
              </button>
              <button onClick={() => { setShowReview(prev => !prev); setShowHistory(false); }} className={btnClass(showReview)}>
                <MessageSquare size={12} /> Review
                {openComments > 0 && <span className="ml-0.5 px-1.5 py-px text-[9px] bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)] rounded-full">{openComments}</span>}
              </button>
            </>
          )}
          {!readOnly && viewMode !== 'preview' && (
            <button onClick={handleAddComment} className="px-2.5 py-1 text-[12px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer" title="Text markieren + klicken">
              💬
            </button>
          )}
        </div>
        {toolbar}
      </div>

      <div className="flex">
        <div className="flex-1 flex gap-0">
          {(viewMode === 'editor' || viewMode === 'split') && (
            <div className={viewMode === 'split' ? 'flex-1' : 'w-full'}>
              <MarkdownEditor value={value} onChange={onChange} placeholder={placeholder} readOnly={readOnly}
                minHeight="300px" maxHeight="500px" extensions={extensions} />
            </div>
          )}
          {viewMode === 'split' && <div className="w-px bg-[var(--tf-border)] mx-2" />}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className={`${viewMode === 'split' ? 'flex-1' : 'w-full'} p-4 rounded-[var(--tf-radius)] overflow-auto`}
              style={{ border: '0.5px solid var(--tf-border)', minHeight: '300px', maxHeight: '500px' }}>
              <MarkdownRenderer content={value} />
            </div>
          )}
        </div>

        {showHistory && documentId && (
          <VersionHistoryPanel documentId={documentId} currentText={value} onRestore={onChange} onClose={() => setShowHistory(false)} />
        )}

        {showReview && documentId && (
          <ReviewPanel documentId={documentId} onClose={() => setShowReview(false)}
            pendingAnchor={pendingAnchor} onClearPending={() => setPendingAnchor(null)} />
        )}
      </div>
    </div>
  );
}
