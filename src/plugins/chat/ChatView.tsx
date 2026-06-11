/**
 * Shell des Chat-Plugins (Design-Handoff): 3 Spalten — Verlauf-Sidebar,
 * Conversation (Header + Thread + Composer) und optionales Quellen-Panel.
 * Logik liegt in useChatController (Senden/Kontext) + useChatStore (Persistenz).
 *
 * Hinweis: Der Thread (MessageList) wird im folgenden Reskin-Schritt durch die
 * neue Nachrichten-/Zitate-Darstellung ersetzt; Composer + Empty-State sind hier
 * bereits final.
 */
import { useEffect, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useChatStore } from './store';
import { useChatController } from './useChatController';
import { ConversationSidebar } from './components/ConversationSidebar';
import { ConversationHeader } from './components/ConversationHeader';
import { MessageList } from './components/MessageList';
import { Composer } from './components/Composer';
import { EmptyState } from './components/EmptyState';
import './chat.css';

export function ChatView(): React.ReactElement {
  const storage = useStorage();
  const conversations = useChatStore(s => s.conversations);
  const activeId = useChatStore(s => s.activeId);
  const activeMessages = useChatStore(s => s.activeMessages);
  const controller = useChatController();
  const docDirs = storage.getDocDirectories();
  const [railCollapsed, setRailCollapsed] = useState(false);

  const activeTitle = conversations.find(c => c.id === activeId)?.title ?? 'Neue Unterhaltung';
  const empty = activeMessages.length === 0 && !controller.busy;

  const composerProps = {
    onSend: controller.send,
    onStop: controller.stop,
    busy: controller.busy,
    providerName: controller.providerName,
    useRAG: controller.useRAG,
    setUseRAG: controller.setUseRAG,
    vectorReady: controller.vectorReady,
    docDirs,
    selectedDirs: controller.selectedDirs,
    toggleDir: controller.toggleDir,
  };

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
    <div className={`chat-app${railCollapsed ? ' rail-collapsed' : ''}`}>
      <ConversationSidebar />
      <div className="convo">
        <ConversationHeader title={activeTitle} onToggleRail={() => setRailCollapsed(c => !c)} />
        {empty ? (
          <EmptyState {...composerProps} onSuggestion={text => { void controller.send(text); }} />
        ) : (
          <>
            <MessageList
              messages={activeMessages}
              busy={controller.busy}
              error={controller.error}
              onRetry={() => { void controller.retry(); }}
              onRegenerate={() => { void controller.regenerate(); }}
              providerName={controller.providerName}
            />
            <div className="composer-wrap">
              <Composer {...composerProps} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
