/**
 * Kompakte Einbettung des Chats als andockendes „Assistenten"-Panel (Journey-
 * Paket 1, Phase 4). Nutzt `useChatController` + `useChatStore` UNVERÄNDERT
 * (kein Fork) — nur das Layout ist schlank: eigener Kopf mit Verlauf-Dropdown
 * statt der breiten `ConversationSidebar`, ein optionaler Kontext-Chip aus den
 * aktuellen Suchtreffern und dieselben Bausteine (MessageList/Composer/
 * EmptyState/SourcePanel). Gescopt unter `.chat-app.assistant-panel`.
 *
 * **Die Unterhaltung ist an die Suche gebunden, unter der sie entstand** (v4.80).
 * Das Panel öffnet immer frisch, verwerfen steht im Kopf, und zieht die Suche
 * weiter, sagt eine Zeile über dem Thread, wohin er gehört. Automatisch gelöscht
 * wird er NICHT: die Stichwortsuche läuft je Tastendruck, ein Reset an „neue
 * Anfrage" nähme dem Nutzer die Antwort weg, die er gerade liest.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { History, Paperclip, Pencil, Pin, SquarePen, Trash2, MessageSquare, X } from 'lucide-react';
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
import {
  waehleKontextTreffer, baueKontextBlock, kontextChipLabel, threadHinweis,
} from '@/plugins/suche/assistentKontext';
import './chat.css';

interface ChatPanelHostProps {
  /** Panel schließen (X im Kopf). */
  onClose: () => void;
  /** Aktuelle Suchtreffer — Quelle des angehefteten Kontexts (leer = kein Chip). */
  contextResults: readonly UnifiedSearchResult[];
  /** Aktuelle Suchanfrage — bei Änderung wird ein zuvor entfernter Kontext neu angeheftet. */
  contextQuery: string;
  /**
   * Vorbelegung des Eingabefeldes — die natürlichsprachige Suche legt hier ihre
   * Frage ab. Wird gesetzt, nicht gesendet (siehe `Composer.vorbelegung`).
   */
  vorbelegung?: string;
}

export function ChatPanelHost({
  onClose, contextResults, contextQuery, vorbelegung,
}: ChatPanelHostProps): React.ReactElement {
  const storage = useStorage();
  const conversations = useChatStore(s => s.conversations);
  const activeId = useChatStore(s => s.activeId);
  const activeMessages = useChatStore(s => s.activeMessages);
  const docDirs = storage.getDocDirectories();

  const [verlaufOpen, setVerlaufOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null);
  const [kontextDismissed, setKontextDismissed] = useState(false);
  /**
   * Die Suche, unter der diese Unterhaltung begonnen hat — `null`, solange nichts
   * gesendet wurde (oder bei einer aus dem Verlauf geholten, deren Suche niemand
   * kennt: dort zu raten wäre schlimmer als zu schweigen).
   *
   * Gemerkt wird beim ERSTEN Senden, nicht bei jedem: sonst wanderte die Bindung
   * mit der Anfrage mit und der Hinweis erschiene nie.
   */
  const [threadQuery, setThreadQuery] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const verlaufWrap = useRef<HTMLDivElement>(null);
  const renameCancelRef = useRef(false);

  // Angehefteter Kontext aus den obersten Treffern (RAG-`extraContext`-Pfad,
  // nicht `setConversationFkz`). Leer, wenn entfernt oder keine Treffer.
  //
  // Die Auswahl fällt EINMAL; Block und Chip lesen dieselbe Liste. Getrennt
  // gerechnet stand über einem Prompt mit acht Treffern der Chip „Kontext: 558
  // Suchtreffer" — der Chip zählte die Trefferliste, der Block seinen Auszug.
  const kontextTreffer = useMemo(
    () => (kontextDismissed ? [] : waehleKontextTreffer(contextResults)),
    [kontextDismissed, contextResults],
  );
  const pinnedKontext = useMemo(
    () => baueKontextBlock(kontextTreffer, contextResults.length),
    [kontextTreffer, contextResults],
  );
  const controller = useChatController({ getPinnedContext: () => pinnedKontext });

  const empty = activeMessages.length === 0 && !controller.busy;
  const hinweis = threadHinweis(threadQuery, contextQuery, activeMessages.length > 0);

  // Neue Suche → zuvor entfernten Kontext wieder anheften.
  useEffect(() => { setKontextDismissed(false); }, [contextQuery]);
  // Quellen-Overlay beim Konversationswechsel schließen.
  useEffect(() => { setActivePanel(null); }, [activeId]);
  // Verlauf zu → laufende Umbenennung verwerfen.
  useEffect(() => { if (!verlaufOpen) { setRenamingId(null); renameCancelRef.current = false; } }, [verlaufOpen]);
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

  // Beim ersten Senden bindet sich die Unterhaltung an die Suche, unter der sie
  // entsteht. Nur so kann später auffallen, dass die Treffer weitergezogen sind.
  const sendeUndBinde = async (text: string): Promise<void> => {
    setThreadQuery(q => (q === null ? contextQuery : q));
    await controller.send(text);
  };

  const composerProps = {
    onSend: sendeUndBinde,
    onStop: controller.stop,
    busy: controller.busy,
    providerName: controller.providerName,
    useRAG: controller.useRAG,
    setUseRAG: controller.setUseRAG,
    vectorReady: controller.vectorReady,
    docDirs,
    selectedDirs: controller.selectedDirs,
    toggleDir: controller.toggleDir,
    vorbelegung,
  };

  // Init: Metas laden, dann IMMER frisch beginnen.
  //
  // Bis v4.79 schlug das Panel die jüngste Unterhaltung wieder auf (gemeldet) — geerbt von
  // der früheren Vollbild-Chatseite, wo „weitermachen, wo ich war" richtig ist.
  // Hier hängt der Chat an den Treffern, die gerade darunter liegen: der alte
  // Thread gehörte zu einer anderen Suche, stand aber unkommentiert über den
  // neuen Treffern — und seine Antwort ging als Verlauf in den nächsten Prompt.
  // Verloren geht nichts: persistierte Unterhaltungen liegen im Verlauf.
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    void (async () => {
      await useChatStore.getState().loadAll(storage);
      useChatStore.getState().newConversation();
    })();
  }, [storage]);

  const selectAction = useAsyncAction((id: string) => useChatStore.getState().select(id, storage));
  const deleteAction = useAsyncAction((id: string) => useChatStore.getState().deleteConversation(id, storage));
  const pinAction = useAsyncAction((id: string) => useChatStore.getState().togglePin(id, storage));
  const renameAction = useAsyncAction((id: string, title: string) =>
    useChatStore.getState().renameConversation(id, title, storage));

  const startRename = (id: string, title: string): void => { setRenamingId(id); setRenameDraft(title); };
  const commitRename = (id: string): void => {
    if (renameCancelRef.current) { renameCancelRef.current = false; setRenamingId(null); return; }
    const val = renameDraft.trim();
    setRenamingId(null);
    if (val) void renameAction.run(id, val);
  };

  /** Verwerfen = löschen UND frisch beginnen; ohne das Zweite bliebe das Panel
   *  ohne aktive Unterhaltung stehen (`deleteConversation` setzt `activeId` auf
   *  null) und der nächste Tastendruck hätte nichts, woran er hängt. */
  const verwerfenAction = useAsyncAction(async (id: string) => {
    await useChatStore.getState().deleteConversation(id, storage);
    useChatStore.getState().newConversation();
  });

  const newChat = (): void => {
    useChatStore.getState().newConversation();
    setThreadQuery(null);
    setVerlaufOpen(false);
  };
  const verwerfeAktive = (): void => {
    if (!activeId) return;
    setThreadQuery(null);
    void verwerfenAction.run(activeId);
  };
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
                              renamingId === c.id ? (
                                <div key={c.id} className="flex items-center px-1 py-0.5">
                                  <input
                                    autoFocus
                                    className="flex-1 min-w-0 rounded-[var(--tf-radius)] border border-[var(--tf-border-hover)] bg-[var(--tf-bg)] px-2 py-1 text-[length:var(--tf-text-base)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)]"
                                    value={renameDraft}
                                    aria-label="Unterhaltung umbenennen"
                                    onChange={e => setRenameDraft(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                                      else if (e.key === 'Escape') { e.preventDefault(); renameCancelRef.current = true; e.currentTarget.blur(); }
                                    }}
                                    onBlur={() => commitRename(c.id)}
                                  />
                                </div>
                              ) : (
                              <div key={c.id} className="flex items-center gap-0.5">
                                <button
                                  className={`pop-item flex-1 min-w-0 ${c.id === activeId ? 'text-[var(--tf-primary)]' : ''}`}
                                  title={c.title}
                                  onClick={() => {
                                    selectAction.run(c.id);
                                    // Zu welcher Suche eine geholte Unterhaltung
                                    // gehört, weiß niemand — also keine Bindung
                                    // behaupten.
                                    setThreadQuery(null);
                                    setVerlaufOpen(false);
                                  }}
                                >
                                  <MessageSquare size={15} />
                                  <span className="truncate flex-1 text-left">{c.title}</span>
                                </button>
                                <button
                                  className={`shrink-0 p-1.5 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] cursor-pointer ${c.pinned ? 'text-[var(--tf-primary)] hover:text-[var(--tf-primary)]' : 'text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]'}`}
                                  title={c.pinned ? 'Anheftung entfernen' : 'Anheften'}
                                  aria-label={c.pinned ? 'Anheftung entfernen' : 'Anheften'}
                                  onClick={() => pinAction.run(c.id)}
                                >
                                  <Pin size={14} />
                                </button>
                                <button
                                  className="shrink-0 p-1.5 rounded-[var(--tf-radius)] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer"
                                  title="Umbenennen"
                                  aria-label="Unterhaltung umbenennen"
                                  onClick={() => startRename(c.id, c.title)}
                                >
                                  <Pencil size={14} />
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
                              )
                            ))}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {/* Verwerfen gehört in den Kopf, nicht nur zwei Klicks tief in den
                Verlauf: gemeldet wurde „es gibt keine Möglichkeit, den zu
                löschen". Nur da, wenn es etwas zu verwerfen gibt — eine leere
                Unterhaltung ist noch gar nicht gespeichert. */}
            {activeMessages.length > 0 && (
              <button
                className="icon-btn"
                title="Diese Unterhaltung löschen"
                aria-label="Diese Unterhaltung löschen"
                disabled={verwerfenAction.busy}
                onClick={verwerfeAktive}
              >
                <Trash2 size={16} />
              </button>
            )}
            <button className="icon-btn" title="Neue Unterhaltung" aria-label="Neue Unterhaltung" onClick={newChat}>
              <SquarePen size={16} />
            </button>
            <button className="icon-btn" title="Assistent schließen" aria-label="Assistent schließen" onClick={onClose}>
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Die Treffer unter dem Panel sind weitergezogen, die Unterhaltung
            nicht. Statt sie still zu verwerfen (die Stichwortsuche läuft je
            Tastendruck — ein Nachschärfen der Anfrage löschte sonst die Antwort,
            die man gerade liest) wird gesagt, wohin sie gehört. */}
        {hinweis && (
          <div className="assistant-threadhint">
            <span>{hinweis}</span>
            <button type="button" onClick={newChat}>neu beginnen</button>
          </div>
        )}

        {pinnedKontext && (
          <div className="assistant-ctxchip">
            <Paperclip size={12} />
            <span>{kontextChipLabel(kontextTreffer.length, contextResults.length)}</span>
            <button type="button" onClick={() => setKontextDismissed(true)}
              title="Kontext entfernen" aria-label="Kontext entfernen">
              <X size={12} />
            </button>
          </div>
        )}

        {empty ? (
          <EmptyState {...composerProps} />
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
