import { useEffect, useRef, useState } from 'react';
import { Download, FileText, MoreHorizontal, Pencil, Pin, Search, SquarePen, Trash2 } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useChatStore } from '../store';
import { groupConversations, type ConversationFilter } from '../conversation-groups';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { conversationToMarkdown } from '../services/conversation-markdown';
import type { ConversationFull, ConversationMeta } from '../types';

const FILTERS: Array<[ConversationFilter, string]> = [
  ['all', 'Alle'], ['antrag', 'Anträge'], ['pinned', 'Angeheftet'],
];

const SIDEBAR_MIN = 200, SIDEBAR_MAX = 560, SIDEBAR_DEFAULT = 264;
const SIDEBAR_KEY = 'tf-chat-sidebar-w';
const clampW = (v: number): number => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, v));
function readSidebarWidth(): number {
  try {
    const v = Number.parseInt(localStorage.getItem(SIDEBAR_KEY) ?? '', 10);
    return Number.isFinite(v) ? clampW(v) : SIDEBAR_DEFAULT;
  } catch { return SIDEBAR_DEFAULT; }
}

export function ConversationSidebar(): React.ReactElement {
  const storage = useStorage();
  const conversations = useChatStore(s => s.conversations);
  const activeId = useChatStore(s => s.activeId);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [width, setWidth] = useState(readSidebarWidth);
  const [resizing, setResizing] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { try { localStorage.setItem(SIDEBAR_KEY, String(width)); } catch { /* ignore */ } }, [width]);

  const onResize = (e: React.PointerEvent): void => {
    e.preventDefault();
    setResizing(true);
    const start = { x: e.clientX, w: width };
    const move = (ev: PointerEvent): void => setWidth(clampW(start.w + (ev.clientX - start.x)));
    const up = (): void => {
      setResizing(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const selectAction = useAsyncAction((id: string) => useChatStore.getState().select(id, storage));
  const deleteAction = useAsyncAction((id: string) => useChatStore.getState().deleteConversation(id, storage));
  const copyMdAction = useAsyncAction(async (id: string) => {
    const rec = await storage.idb.get<ConversationFull>(`chat:conv:${id}`);
    if (rec) await navigator.clipboard.writeText(conversationToMarkdown(rec));
  });

  useEffect(() => {
    if (renamingId && renameRef.current) { renameRef.current.focus(); renameRef.current.select(); }
  }, [renamingId]);
  useEffect(() => {
    if (!menuId) return;
    const close = (): void => setMenuId(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuId]);

  const { sections, counts } = groupConversations(conversations, { filter, query, now: Date.now() });

  const startRename = (c: ConversationMeta): void => { setMenuId(null); setRenameVal(c.title); setRenamingId(c.id); };
  const commitRename = (): void => {
    if (renamingId) void useChatStore.getState().renameConversation(renamingId, renameVal, storage);
    setRenamingId(null);
  };

  return (
    <div
      className="side2"
      style={{ ['--side2-w' as string]: `${width}px`, ...(resizing ? { transition: 'none' } : {}) } as React.CSSProperties}
    >
      <div className="side2-resize" title="Breite ändern" onPointerDown={onResize} />
      <div className="side2-pad">
        <div className="side2-row">
          <div className="side2-search">
            <Search size={14} />
            <input
              placeholder="Unterhaltungen durchsuchen"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <button className="side2-compose" title="Neuer Chat" onClick={() => useChatStore.getState().newConversation()}>
            <SquarePen size={16} />
          </button>
        </div>
      </div>

      <div className="side2-filter">
        <ScopeTabs
          variant="pills"
          items={FILTERS.map(([id, label]) => ({ key: id, label, count: counts[id] }))}
          activeKey={filter}
          onChange={key => setFilter(key as ConversationFilter)}
          aria-label="Unterhaltungen filtern"
        />
      </div>

      <div className="side2-list scroll">
        {sections.length === 0 && <div className="side2-empty">Keine Unterhaltungen.</div>}
        {sections.map((g, gi) => (
          <div key={g.name}>
            <div className={`side2-group${gi === 0 ? ' first' : ''}`}>{g.name}</div>
            {g.items.map(c => (
              c.id === renamingId ? (
                <div key={c.id} className="conv2">
                  <div className="c2rename">
                    <input
                      ref={renameRef}
                      value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div
                  key={c.id}
                  className={`conv2${c.id === activeId ? ' active' : ''}${c.pinned ? ' pinned' : ''}`}
                  onClick={() => selectAction.run(c.id)}
                >
                  <div className="c2body">
                    <div className="c2t" title={c.title}>{c.title}</div>
                    {c.fkz && (
                      <div className="c2sub">
                        <FileText size={11} />
                        <span className="c2fkz">{c.fkz}</span>
                      </div>
                    )}
                  </div>
                  <span className="c2pin"><Pin size={13} /></span>
                  <div className="c2acts">
                    <button
                      className={`c2act${c.pinned ? ' on' : ''}`}
                      title={c.pinned ? 'Lösen' : 'Anheften'}
                      onClick={e => { e.stopPropagation(); void useChatStore.getState().togglePin(c.id, storage); }}
                    >
                      <Pin size={14} />
                    </button>
                    <button
                      className="c2act"
                      title="Mehr"
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); setMenuId(menuId === c.id ? null : c.id); }}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                  </div>
                  {menuId === c.id && (
                    <div className="c2menu" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                      <button className="c2mi" onClick={() => { void useChatStore.getState().togglePin(c.id, storage); setMenuId(null); }}>
                        <Pin size={15} />{c.pinned ? 'Lösen' : 'Anheften'}
                      </button>
                      <button className="c2mi" onClick={() => startRename(c)}>
                        <Pencil size={15} />Umbenennen
                      </button>
                      <button className="c2mi" onClick={() => { copyMdAction.run(c.id); setMenuId(null); }}>
                        <Download size={15} />Als Markdown kopieren
                      </button>
                      {c.fkz && (
                        <button className="c2mi" onClick={() => { void useChatStore.getState().setConversationFkz(c.id, undefined, storage); setMenuId(null); }}>
                          <FileText size={15} />Antrag-Verknüpfung lösen
                        </button>
                      )}
                      <div className="c2msep" />
                      <button className="c2mi danger" onClick={() => { deleteAction.run(c.id); setMenuId(null); }}>
                        <Trash2 size={15} />Löschen
                      </button>
                    </div>
                  )}
                </div>
              )
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
