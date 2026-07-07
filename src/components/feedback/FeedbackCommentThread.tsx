// Kommentar-Thread + Eingabe (Redesign v2.199) für den Detail-Drawer.
// Append-only über `addComment` (useAsyncAction, kein silent-fail). Ohne Identität
// (meId) ist die Eingabe deaktiviert (Read-only-Anzeige).

import { useState } from 'react';
import { Send } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { addComment } from '@/core/services/feedback';
import type { FeedbackItem } from '@/core/types/feedback';
import { formatShortDate } from './feedbackUi';
import { FeedbackAvatar } from './FeedbackAvatar';

interface Props {
  ticket: FeedbackItem;
  meId?: string;
  meName?: string;
  onChanged: () => void;
}

export function FeedbackCommentThread({ ticket, meId, meName, onChanged }: Props): React.ReactElement {
  const storage = useStorage();
  const [text, setText] = useState('');
  const comments = ticket.comments ?? [];

  const submit = useAsyncAction(async () => {
    if (!meId || !text.trim()) return;
    const res = await addComment(storage, ticket.id, meId, text, meName);
    if (res.ok) { setText(''); onChanged(); }
  });

  return (
    <div className="space-y-2.5">
      <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] font-medium">
        Kommentare{comments.length > 0 ? ` (${comments.length})` : ''}
      </p>

      {comments.length === 0 ? (
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)] italic">Noch keine Kommentare.</p>
      ) : (
        <div className="space-y-2.5">
          {comments.map(c => {
            const name = c.user_display_name || c.user_id;
            return (
              <div key={c.id} className="flex gap-2">
                <FeedbackAvatar name={name} size={20} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-1.5 text-[11px]">
                    <span className="font-medium text-[var(--tf-text)]">{name}</span>
                    <span className="text-[var(--tf-text-tertiary)]">{formatShortDate(c.created_at)}</span>
                  </p>
                  <p className="text-[13px] text-[var(--tf-text-secondary)] whitespace-pre-wrap leading-snug">{c.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Eingabe */}
      {meId ? (
        <div className="flex gap-2 items-start pt-0.5">
          <FeedbackAvatar name={meName || meId} size={20} className="mt-1.5" />
          <div className="flex-1 min-w-0 flex items-end gap-1.5">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Kommentar schreiben …"
              rows={1}
              className="flex-1 min-w-0 px-2.5 py-1.5 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none resize-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
              style={{ border: '0.5px solid var(--tf-border)' }}
            />
            <button
              type="button"
              onClick={() => submit.run()}
              disabled={!text.trim() || submit.busy}
              className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-[var(--tf-radius)] bg-[var(--tf-primary)] text-[var(--tf-on-primary)] cursor-pointer disabled:opacity-40 disabled:cursor-default"
              aria-label="Kommentar senden"
              title="Kommentar senden"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-[var(--tf-text-tertiary)] italic">
          Zum Kommentieren im Profil anmelden.
        </p>
      )}
    </div>
  );
}
