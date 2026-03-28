import { useState, useEffect } from 'react';
import { X, MessageSquare, Check, RotateCcw } from 'lucide-react';
import { Button } from './Button';
import { reviewService } from '@/core/services/review/review-service';
import { useStorage } from '@/core/hooks/useStorage';
import type { ReviewSession, ReviewComment } from '@/core/types/review';

interface ReviewPanelProps {
  documentId: string;
  onClose: () => void;
  pendingAnchor?: { from: number; to: number; quotedText: string } | null;
  onClearPending?: () => void;
}

export function ReviewPanel({ documentId, onClose, pendingAnchor, onClearPending }: ReviewPanelProps): React.ReactElement {
  const storage = useStorage();
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    reviewService.loadReviews(documentId, storage).then(s => setSession(s));
  }, [documentId, storage]);

  const save = async (s: ReviewSession): Promise<void> => {
    setSession(s);
    await reviewService.saveReviews(documentId, s, storage);
  };

  const handleAddComment = async (): Promise<void> => {
    if (!newCommentText.trim() || !pendingAnchor) return;
    const updated = reviewService.addComment(session, {
      documentId, author: '', text: newCommentText, anchor: pendingAnchor,
    });
    await save(updated);
    setNewCommentText('');
    onClearPending?.();
  };

  const handleReply = async (commentId: string): Promise<void> => {
    if (!replyText.trim() || !session) return;
    const updated = reviewService.addReply(session, commentId, { author: '', text: replyText });
    await save(updated);
    setReplyText('');
    setReplyingTo(null);
  };

  const handleResolve = async (commentId: string): Promise<void> => {
    if (!session) return;
    await save(reviewService.resolveComment(session, commentId));
  };

  const handleReopen = async (commentId: string): Promise<void> => {
    if (!session) return;
    await save(reviewService.reopenComment(session, commentId));
  };

  const comments = session?.comments ?? [];
  const filtered = filter === 'all' ? comments : comments.filter(c => c.status === filter);
  const openCount = comments.filter(c => c.status === 'open').length;
  const resolvedCount = comments.filter(c => c.status === 'resolved').length;

  const formatRelative = (iso: string): string => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'gerade';
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
  };

  return (
    <div className="w-[240px] shrink-0 flex flex-col h-full" style={{ borderLeft: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-center justify-between px-3 py-3" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
        <span className="text-[13px] font-medium text-[var(--tf-text)]">Review</span>
        <button onClick={onClose} className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"><X size={14} /></button>
      </div>

      {/* Filter */}
      <div className="flex gap-1 px-3 py-2" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
        {([['all', 'Alle'], ['open', `Offen (${openCount})`], ['resolved', `Erledigt (${resolvedCount})`]] as const).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-2 py-0.5 text-[11px] rounded-full cursor-pointer ${filter === f ? 'bg-[var(--tf-text)] text-[var(--tf-bg)]' : 'text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)]'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* New comment (when anchor pending) */}
      {pendingAnchor && (
        <div className="px-3 py-3" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
          <div className="text-[11px] text-[var(--tf-text-tertiary)] mb-1 pl-2" style={{ borderLeft: '2px solid var(--tf-border-hover)' }}>
            &ldquo;{pendingAnchor.quotedText.slice(0, 60)}{pendingAnchor.quotedText.length > 60 ? '...' : ''}&rdquo;
          </div>
          <textarea value={newCommentText} onChange={e => setNewCommentText(e.target.value)} placeholder="Kommentar..."
            rows={2} autoFocus
            className="w-full px-2 py-1.5 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none mt-2 resize-none placeholder:text-[var(--tf-text-tertiary)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }} />
          <div className="flex gap-1 mt-1">
            <Button size="sm" onClick={handleAddComment} disabled={!newCommentText.trim()}>Senden</Button>
            <Button variant="ghost" size="sm" onClick={onClearPending}>Abbrechen</Button>
          </div>
        </div>
      )}

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-center">
            <MessageSquare size={20} className="text-[var(--tf-text-tertiary)] mx-auto mb-2" />
            <p className="text-[11px] text-[var(--tf-text-tertiary)]">Keine Kommentare</p>
          </div>
        )}
        {filtered.map(c => (
          <CommentItem key={c.id} comment={c}
            replyingTo={replyingTo} replyText={replyText}
            onSetReplyingTo={setReplyingTo} onSetReplyText={setReplyText}
            onReply={handleReply} onResolve={handleResolve} onReopen={handleReopen}
            formatRelative={formatRelative} />
        ))}
      </div>
    </div>
  );
}

function CommentItem({ comment, replyingTo, replyText, onSetReplyingTo, onSetReplyText, onReply, onResolve, onReopen, formatRelative }: {
  comment: ReviewComment; replyingTo: string | null; replyText: string;
  onSetReplyingTo: (id: string | null) => void; onSetReplyText: (t: string) => void;
  onReply: (id: string) => void; onResolve: (id: string) => void; onReopen: (id: string) => void;
  formatRelative: (iso: string) => string;
}): React.ReactElement {
  const isResolved = comment.status === 'resolved';
  return (
    <div className={`px-3 py-3 ${isResolved ? 'opacity-60' : ''}`} style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[11px] text-[var(--tf-text-tertiary)]">{formatRelative(comment.timestamp)}</span>
        {comment.anchor.orphaned && <span className="text-[10px] text-[var(--tf-warning-text)]" title="Text geändert">⚠</span>}
      </div>
      <div className="text-[11px] text-[var(--tf-text-secondary)] mb-1.5 pl-2" style={{ borderLeft: '2px solid var(--tf-border-hover)' }}>
        &ldquo;{comment.anchor.quotedText.slice(0, 50)}{comment.anchor.quotedText.length > 50 ? '...' : ''}&rdquo;
      </div>
      <p className="text-[12px] text-[var(--tf-text)]">{comment.text}</p>

      {comment.replies.map(r => (
        <div key={r.id} className="ml-3 mt-2 pl-2" style={{ borderLeft: '0.5px solid var(--tf-border)' }}>
          <p className="text-[11px] text-[var(--tf-text-tertiary)]">{formatRelative(r.timestamp)}</p>
          <p className="text-[11px] text-[var(--tf-text)]">{r.text}</p>
        </div>
      ))}

      <div className="flex gap-1 mt-2">
        <button onClick={() => onSetReplyingTo(comment.id)} className="text-[10px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer">Antworten</button>
        {isResolved
          ? <button onClick={() => onReopen(comment.id)} className="text-[10px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer flex items-center gap-0.5"><RotateCcw size={8} />Öffnen</button>
          : <button onClick={() => onResolve(comment.id)} className="text-[10px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer flex items-center gap-0.5"><Check size={8} />Erledigt</button>
        }
      </div>

      {replyingTo === comment.id && (
        <div className="mt-2">
          <textarea value={replyText} onChange={e => onSetReplyText(e.target.value)} rows={2} autoFocus placeholder="Antwort..."
            className="w-full px-2 py-1 text-[11px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none resize-none placeholder:text-[var(--tf-text-tertiary)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onReply(comment.id); } }} />
          <div className="flex gap-1 mt-1">
            <Button size="sm" onClick={() => onReply(comment.id)} disabled={!replyText.trim()}>Senden</Button>
            <Button variant="ghost" size="sm" onClick={() => onSetReplyingTo(null)}>Abbrechen</Button>
          </div>
        </div>
      )}
    </div>
  );
}
