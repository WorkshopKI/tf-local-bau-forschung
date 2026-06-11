import { useState } from 'react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useStorage } from '@/core/hooks/useStorage';
import { useChatStore } from '../store';
import { DEFAULT_SYSTEM_PROMPT } from '../conversation-context';

interface SystemPromptPopoverProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Editierbarer System-Prompt (gilt für alle Konversationen, persistiert in
 * chat:settings). Controlled — geöffnet aus dem „+"-Menü des Composers.
 */
export function SystemPromptPopover({ open, onClose }: SystemPromptPopoverProps): React.ReactElement | null {
  const storage = useStorage();
  const systemPrompt = useChatStore(s => s.systemPrompt);
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? systemPrompt;

  const save = useAsyncAction(async () => {
    await useChatStore.getState().setSystemPrompt(value.trim() || DEFAULT_SYSTEM_PROMPT, storage);
    setDraft(null);
    onClose();
  });

  if (!open) return null;

  return (
    <div className="pop" style={{ bottom: 46, left: 0, width: 420 }} onMouseDown={e => e.stopPropagation()}>
      <div className="pop-label">System-Prompt</div>
      <textarea
        value={value}
        onChange={e => setDraft(e.target.value)}
        rows={6}
        className="composer-sysprompt"
        style={{
          margin: '0 6px', padding: '8px 10px', resize: 'vertical',
          border: '0.5px solid var(--tf-border)', borderRadius: 'var(--tf-radius)',
          background: 'transparent', color: 'var(--tf-text)', font: 'var(--tf-text-base)/1.5 var(--tf-font-sans)',
          outline: 'none',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 6px 4px', gap: 8 }}>
        <button className="lnk-sec" onClick={() => setDraft(DEFAULT_SYSTEM_PROMPT)}>Standard wiederherstellen</button>
        <button className="tool-pill on" onClick={() => save.run()} style={{ height: 28 }}>
          {save.busy ? 'Speichern…' : 'Speichern'}
        </button>
      </div>
      {save.error && <div style={{ padding: '0 8px 6px', color: 'var(--tf-danger-text)', fontSize: 11 }}>{save.error}</div>}
    </div>
  );
}
