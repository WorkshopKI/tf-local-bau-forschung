import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/ui';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useStorage } from '@/core/hooks/useStorage';
import { useChatStore } from '../store';
import { DEFAULT_SYSTEM_PROMPT } from '../conversation-context';

/** Editierbarer System-Prompt (gilt für alle Konversationen, persistiert in chat:settings). */
export function SystemPromptPopover(): React.ReactElement {
  const storage = useStorage();
  const systemPrompt = useChatStore(s => s.systemPrompt);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? systemPrompt;

  const save = useAsyncAction(async () => {
    await useChatStore.getState().setSystemPrompt(value.trim() || DEFAULT_SYSTEM_PROMPT, storage);
    setOpen(false);
    setDraft(null);
  });

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(prev => !prev); setDraft(null); }}
        className={`p-3 rounded-[var(--tf-radius)] cursor-pointer hover:bg-[var(--tf-hover)] ${
          open ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]'
        }`}
        title="System-Prompt anpassen"
      >
        <Settings2 size={16} />
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 bg-[var(--tf-bg)] rounded-[var(--tf-radius)] p-3 w-[420px] z-10"
          style={{ border: '0.5px solid var(--tf-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
        >
          <p className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] mb-1.5">
            System-Prompt
          </p>
          <textarea
            value={value}
            onChange={e => setDraft(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none resize-y placeholder:text-[var(--tf-text-tertiary)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          />
          <div className="flex items-center justify-between mt-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(DEFAULT_SYSTEM_PROMPT)}>
              Standard wiederherstellen
            </Button>
            <Button size="sm" loading={save.busy} onClick={() => save.run()}>
              Speichern
            </Button>
          </div>
          {save.error && (
            <p className="mt-1.5 text-[11px] text-[var(--tf-danger-text)]">{save.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
