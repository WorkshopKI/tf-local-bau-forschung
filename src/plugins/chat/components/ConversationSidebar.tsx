import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/ui';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import type { ConversationMeta } from '../types';

interface ConversationSidebarProps {
  conversations: ConversationMeta[];
  activeId: string | null;
  onSelect: (id: string) => Promise<void>;
  onNew: () => void;
  onDelete: (id: string) => Promise<void>;
}

export function ConversationSidebar({
  conversations, activeId, onSelect, onNew, onDelete,
}: ConversationSidebarProps): React.ReactElement {
  const selectAction = useAsyncAction(onSelect);
  const deleteAction = useAsyncAction(onDelete);

  return (
    <div className="w-60 shrink-0 flex flex-col" style={{ borderRight: '0.5px solid var(--tf-border)' }}>
      <div className="p-3">
        <Button variant="secondary" size="sm" icon={Plus} className="w-full justify-center" onClick={onNew}>
          Neuer Chat
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 && (
          <p className="px-2 py-1 text-[12px] text-[var(--tf-text-tertiary)]">
            Noch keine Unterhaltungen
          </p>
        )}
        {conversations.map(conv => (
          <div
            key={conv.id}
            className={`group flex items-center gap-1 rounded-[var(--tf-radius)] ${
              conv.id === activeId ? 'bg-[var(--tf-bg-secondary)]' : 'hover:bg-[var(--tf-hover)]'
            }`}
          >
            <button
              onClick={() => selectAction.run(conv.id)}
              className="flex-1 min-w-0 text-left px-2 py-2 text-[13px] text-[var(--tf-text)] truncate cursor-pointer"
              title={conv.title}
            >
              {conv.title}
            </button>
            <button
              onClick={() => deleteAction.run(conv.id)}
              className="shrink-0 p-1.5 mr-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] opacity-0 group-hover:opacity-100 cursor-pointer"
              title="Unterhaltung löschen"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {(selectAction.error ?? deleteAction.error) && (
          <p className="px-2 py-1 text-[11px] text-[var(--tf-danger-text)]">
            {selectAction.error ?? deleteAction.error}
          </p>
        )}
      </div>
    </div>
  );
}
