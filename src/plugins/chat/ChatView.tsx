/**
 * Layout-Shell des Chat-Plugins: Konversations-Sidebar links, Message-Liste +
 * Input rechts. Logik liegt in useChatController (Senden/Kontext) und
 * useChatStore (Persistenz) — diese Datei verdrahtet nur.
 */
import { useEffect, useRef } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useChatStore } from './store';
import { useChatController } from './useChatController';
import { ConversationSidebar } from './components/ConversationSidebar';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';

export function ChatView(): React.ReactElement {
  const storage = useStorage();
  const conversations = useChatStore(s => s.conversations);
  const activeId = useChatStore(s => s.activeId);
  const activeMessages = useChatStore(s => s.activeMessages);
  const controller = useChatController();
  const docDirs = storage.getDocDirectories();

  // Init: Metas + Settings laden, letzte Unterhaltung reaktivieren
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    void (async () => {
      await useChatStore.getState().loadAll(storage);
      const s = useChatStore.getState();
      if (s.activeId) return;
      if (s.conversations.length > 0) await s.select(s.conversations[0]!.id, storage);
      else s.newConversation();
    })();
  }, [storage]);

  return (
    <div className="flex h-full">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={id => useChatStore.getState().select(id, storage)}
        onNew={() => useChatStore.getState().newConversation()}
        onDelete={id => useChatStore.getState().deleteConversation(id, storage)}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <MessageList
          messages={activeMessages}
          busy={controller.busy}
          error={controller.error}
          onRetry={() => { void controller.retry(); }}
          onRegenerate={() => { void controller.regenerate(); }}
          providerName={controller.providerName}
        />
        <ChatInput
          onSend={controller.send}
          onStop={controller.stop}
          busy={controller.busy}
          docDirs={docDirs}
          selectedDirs={controller.selectedDirs}
          toggleDir={controller.toggleDir}
          useRAG={controller.useRAG}
          setUseRAG={controller.setUseRAG}
          vectorReady={controller.vectorReady}
          providerName={controller.providerName}
        />
      </div>
    </div>
  );
}
