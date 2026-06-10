import { Brain } from 'lucide-react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useStorage } from '@/core/hooks/useStorage';
import { useChatStore } from '../store';

/**
 * Schaltet die Denkprozess-Phase (Qwen-Thinking) an/aus — persistiert in
 * chat:settings, wirkt ab der nächsten Nachricht. Aus = deutlich schnellere
 * Antworten, aber weniger gründlich bei komplexen Prompts.
 */
export function ThinkingToggle(): React.ReactElement {
  const storage = useStorage();
  const thinkingEnabled = useChatStore(s => s.thinkingEnabled);

  const toggle = useAsyncAction(async () => {
    await useChatStore.getState().setThinkingEnabled(!thinkingEnabled, storage);
  });

  return (
    <button
      onClick={() => toggle.run()}
      disabled={toggle.busy}
      className={`p-3 rounded-[var(--tf-radius)] cursor-pointer hover:bg-[var(--tf-hover)] ${
        thinkingEnabled ? 'text-[var(--tf-primary)]' : 'text-[var(--tf-text-tertiary)]'
      }`}
      title={thinkingEnabled
        ? 'Denkprozess aktiv — gründlicher, aber langsamer (klicken zum Ausschalten)'
        : 'Denkprozess aus — schnellere Antworten (klicken zum Einschalten)'}
    >
      <Brain size={16} />
    </button>
  );
}
