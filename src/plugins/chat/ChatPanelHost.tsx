/**
 * Kompakte Einbettung des Chats als andockendes „Assistenten"-Panel (Journey-
 * Paket 1, Phase 4). Nutzt `useChatController` + `useChatStore` UNVERÄNDERT
 * (kein Fork) — nur das Layout ist schlank: eigener Kopf mit Verlauf-Dropdown
 * statt der breiten `ConversationSidebar`, ein optionaler Kontext-Chip aus den
 * aktuellen Suchtreffern und dieselben Bausteine (MessageList/Composer/
 * EmptyState/SourcePanel). Gescopt unter `.chat-app.assistant-panel`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { History, Paperclip, SquarePen, Trash2, MessageSquare, X } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { useChatStore } from './store';
import { useChatController } from './useChatController';
import { groupConversations } from './conversation-groups';
import { MessageList, type ActivePanel } from './components/MessageList';
import { Composer } from './components/Composer';
import { EmptyState } from './components/EmptyState';
import { SourcePanel } from './components/SourcePanel';
import { buildTrefferKontext, kontextChipLabel } from '@/plugins/suche/assistentKontext';
import './chat.css';

interface ChatPanelHostProps {
  /** Panel schließen (X im Kopf). */
  onClose: () => void;
  /** Aktuelle Suchtreffer — Quelle des angehefteten Kontexts (leer = kein Chip). */
  contextResults: UnifiedSearchResult[];
  /** Aktuelle Suchanfrage — bei Änderung wird ein zuvor entfernter Kontext neu angeheftet. */
  contextQuery: string;
}

export function ChatPanelHost({ onClose, contextResults, contextQuery }: ChatPanelHostProps): React.ReactElement {
  const storage = useStorage();
  const conversations = useChatStore(s => s.conversations);
  const activeId = useChatStore(s => s.activeId);
  const activeMessages = useChatStore(s => s.activeMessages);
  const docDirs = storage.getDocDirectories();

  const [verlaufOpen, setVerlaufOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null);
  const [kontextDismissed, setKontextDismissed] = useState(false);
  const verlaufWrap = useRef<HTMLDivElement>(null);

  // Angehefteter Kontext aus den obersten Treffern (RAG-`extraContext`-Pfad,
  // nicht `setConversationFkz`). Leer, wenn entfernt oder keine Treffer.
  const pinnedKontext = useMemo(
    () => (!kontextDismissed && contextResults.length > 0 ? buildTrefferKontext(contextResults) : ''),
    [kontextDismissed, contextResults],
  );
  const controller = useChatController({ getPinnedContext: () => pinnedKontext });

  const empty = activeMessages.length === 0 && !controller.busy;

  // Neue Suche → zuvor entfernten Kontext wieder anheften.
  useEffect(() => { setKontextDismissed(false); }, [contextQuery]);
  // Quellen-Overlay beim Konversationswechsel schließen.
  useEffect(() => { setActivePanel(null); }, [activeId]);
  // Verlauf-Dropdown bei Außenklick schließen.
  useEffect(() => {
    if (!verlaufOpen) return;
    const onDoc = (e: MouseEvent): void => {
      if (verlaufWrap.current && !verlaufWrap.current.contains(e.target as Node)) setVerlaufOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [verlaufOpen]);

  const activeSrc = useMemo(() => {
    if (!activePanel) return null;
    const m = activeMessages.find(x => x.id === activePanel.mid);
    return m?.sources?.find(s => s.n === activePanel.n) ?? null;
  }, [activePanel, activeMessages]);

  const onCite = (mid: string, n: number): void => {
    setActivePanel(prev => (prev && prev.mid === mid && prev.n === n ? null : { mid, n }));
  };
  const onFeedback = (mid: string, fb: 'up' | 'down'): void => {
    void useChatStore.getState().setMessageFeedback(mid, fb, storage);
  };

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

  // Init: Metas laden, letzte Unterhaltung reaktivieren (wie ChatView früher).
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

  const selectAction = useAsyncAction((id: string) => useChatStore.getState().select(id, storage));
  const deleteAction = useAsyncAction((id: string) => useChatStore.getState().deleteConversation(id, storage));

  const newChat = (): void => { useChatStore.getState().newConversation(); setVerlaufOpen(false); };
  const { sections } = groupConversations(conversations, { filter: 'all', query: '', now: Date.now() });

  return (
    <div className="chat-app assistant-panel">
      <div className="convo">
        <div className="convo-head">
          <span className="assistant-badge">Assistent</span>
          <div className="head-spacer" />
          <div className="head-actions">
            <div ref={verlaufWrap} style={{ position: 'relative' }}>
              <button className="icon-btn" title="Verlauf" aria-label="Verlauf"
                onClick={() => setVerlaufOpen(o => !o)}>
                <History size={16} />
              </button>
              {verlaufOpen && (
                <div className="pop" style={{ top: 38, right: 0, minWidth: 240, maxWidth: 300 }}
                  onMouseDown={e => e.stopPropagation()}>
                  <button className="pop-item" onClick={newChat}>
                    <SquarePen size={16} />Neue Unterhaltung
                  </button>
                  {sections.length === 0 ? (
                    <div className="pop-label">Keine Unterhaltungen</div>
                  ) : (
                    <>
                      <div className="pop-sep" />
                      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                        {sections.map(g => (
                          <div key={g.name}>
                            <div className="pop-label">{g.name}</div>
                            {g.items.map(c => (
                              <div key={c.id} className="flex items-center gap-1">
                                <button
                                  className={`pop-item flex-1 min-w-0 ${c.id === activeId ? 'text-[var(--tf-primary)]' : ''}`}
                                  title={c.title}
                                  onClick={() => { selectAction.run(c.id); setVerlaufOpen(false); }}
                                >
                                  <MessageSquare size={15} />
                                  <span className="truncate flex-1 text-left">{c.title}</span>
                                </button>
                                <button
                                  className="shrink-0 p-1.5 rounded-[var(--tf-radius)] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] hover:bg-[var(--tf-hover)] cursor-pointer"
                                  title="Löschen"
                                  aria-label="Unterhaltung löschen"
                                  onClick={() => deleteAction.run(c.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <button className="icon-btn" title="Neue Unterhaltung" aria-label="Neue Unterhaltung" onClick={newChat}>
              <SquarePen size={16} />
            </button>
            <button className="icon-btn" title="Assistent schließen" aria-label="Assistent schließen" onClick={onClose}>
              <X size={17} />
            </button>
          </div>
        </div>

        {pinnedKontext && (
          <div className="assistant-ctxchip">
            <Paperclip size={12} />
            <span>{kontextChipLabel(contextResults.length)}</span>
            <button type="button" onClick={() => setKontextDismissed(true)}
              title="Kontext entfernen" aria-label="Kontext entfernen">
              <X size={12} />
            </button>
          </div>
        )}

        {empty ? (
          <EmptyState {...composerProps} onSuggestion={text => { void controller.send(text); }} />
        ) : (
          <>
            <MessageList
              messages={activeMessages}
              busy={controller.busy}
              error={controller.error}
              activePanel={activePanel}
              onCite={onCite}
              onRetry={() => { void controller.retry(); }}
              onRegenerate={() => { void controller.regenerate(); }}
              onFeedback={onFeedback}
            />
            <div className="composer-wrap">
              <Composer {...composerProps} />
            </div>
          </>
        )}

        {activeSrc && <SourcePanel src={activeSrc} onClose={() => setActivePanel(null)} />}
      </div>
    </div>
  );
}
