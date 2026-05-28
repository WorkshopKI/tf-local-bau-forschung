// TODO(refactor v2.4+): 458 Zeilen — opportunistisch splitten, wenn diese Datei naechstes Mal angefasst wird.
// Vorschlag: DocumentHeader.tsx + DocumentMetadata.tsx + DocumentActions.tsx aus dem Panel-Layout extrahieren.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Pin, MoreHorizontal, Eye, ArrowRight, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TagInput } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useTags } from '@/core/hooks/useTags';
import { useDokumenteStore } from './store';
import type { DocumentFull } from './store';
import { parseMarkdown, type OutlineEntry } from './markdownMeta';

const WIDTH_KEY = 'teamflow_dokumente_sidepanel_width';
const DEFAULT_WIDTH = 580;
const MIN_WIDTH = 380;
const MAX_WIDTH = 900;
const OUTLINE_DEFAULT = 6;

function loadWidth(): number {
  try {
    const v = Number(localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(v) && v >= MIN_WIDTH && v <= MAX_WIDTH) return v;
  } catch { /* ignore */ }
  return DEFAULT_WIDTH;
}

export function DokumentSidePanel(): React.ReactElement | null {
  const storage = useStorage();
  const navigate = useNavigate();
  const { suggest, addTag } = useTags();
  const {
    documents, selectedId, setSelectedId, pinned, togglePin,
    setViewingFullDoc, updateTags, remove, loadDocument,
  } = useDokumenteStore();
  const [toast, setToast] = useState<string | null>(null);
  const [width, setWidth] = useState(loadWidth);
  const [full, setFull] = useState<DocumentFull | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [tagEditMode, setTagEditMode] = useState(false);
  const [showAllOutline, setShowAllOutline] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  const meta = documents.find(d => d.id === selectedId);

  // Markdown laden, wenn sich die Selektion ändert.
  useEffect(() => {
    if (!selectedId) return;
    setLoadingDoc(true);
    setShowAllOutline(false);
    setTagEditMode(false);
    setFull(null);
    loadDocument(selectedId, storage).then(doc => {
      setFull(doc);
      setLoadingDoc(false);
    });
  }, [selectedId, storage, loadDocument]);

  // Resize-Drag.
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const onResizeMouseDown = useCallback((e: React.MouseEvent): void => {
    dragRef.current = { startX: e.clientX, startWidth: width };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent): void => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = drag.startX - ev.clientX;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, drag.startWidth + delta));
      setWidth(next);
    };
    const onUp = (): void => {
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [width]);

  useEffect(() => {
    try { localStorage.setItem(WIDTH_KEY, String(width)); } catch { /* ignore */ }
  }, [width]);

  // Esc schließt das Panel.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, setSelectedId]);

  // More-Menu schließt bei Click außerhalb.
  useEffect(() => {
    if (!moreOpen) return;
    const onClick = (e: MouseEvent): void => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [moreOpen]);

  const parsed = useMemo(
    () => full?.markdown ? parseMarkdown(full.markdown) : null,
    [full?.markdown],
  );

  // Related: Docs mit gleichem vorgangId, aktuelles ausgenommen.
  const related = useMemo(() => {
    if (!meta?.vorgangId) return [];
    return documents.filter(d => d.id !== meta.id && d.vorgangId === meta.vorgangId);
  }, [documents, meta]);

  if (!meta) return null;

  const isPinned = pinned.has(meta.id);
  const category = meta.tags[0] ?? 'Dokument';
  const humanTitle = parsed?.humanTitle ?? meta.filename;
  const author = parsed?.author ?? null;
  const dateStr = new Date(meta.created).toLocaleDateString('de-DE');

  const showToast = (msg: string): void => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  const handleTagsChange = (tags: string[]): void => {
    tags.forEach(t => addTag(t));
    updateTags(meta.id, tags, storage);
  };

  const handleDelete = (): void => {
    setMoreOpen(false);
    if (!window.confirm(`„${meta.filename}" wirklich löschen?`)) return;
    remove(meta.id, storage);
  };

  const goToVorgang = (): void => {
    if (!meta.vorgangId) return;
    navigate(`/antraege/${encodeURIComponent(meta.vorgangId)}`);
  };

  const openOutline = (_o: OutlineEntry): void => {
    // Anchor-Scroll im Reader ist Out-of-Scope für den Side-Panel-Patch — wir
    // öffnen den Vollbild-Reader; das Springen zu einer konkreten Heading
    // kann später nachgezogen werden.
    setViewingFullDoc(true);
  };

  return (
    <div
      className="shrink-0 h-full flex"
      style={{ width, position: 'relative' }}
    >
      {/* Resize-Handle am linken Rand. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Vorschau-Breite ändern"
        onMouseDown={onResizeMouseDown}
        className="shrink-0 w-[4px] h-full cursor-col-resize hover:bg-[var(--tf-border-hover)] transition-colors"
        style={{ borderLeft: '0.5px solid var(--tf-border)' }}
      />

      <aside
        className="flex-1 min-w-0 h-full overflow-y-auto bg-[var(--tf-bg)]"
      >
        {/* Top bar */}
        <div
          className="sticky top-0 z-10 flex items-center px-5 py-3 bg-[var(--tf-bg)]"
          style={{ borderBottom: '0.5px solid var(--tf-border)' }}
        >
          <span
            className="text-[11px] uppercase text-[var(--tf-text-tertiary)]"
            style={{ letterSpacing: '0.6px' }}
          >
            Vorschau
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <IconBtn
              onClick={() => togglePin(meta.id)}
              title={isPinned ? 'Anheftung lösen' : 'Anheften'}
              active={isPinned}
            >
              <Pin size={15} />
            </IconBtn>
            <div className="relative" ref={moreRef}>
              <IconBtn
                onClick={() => setMoreOpen(prev => !prev)}
                title="Weitere Aktionen"
                active={moreOpen}
              >
                <MoreHorizontal size={15} />
              </IconBtn>
              {moreOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-20 min-w-[180px] rounded-[var(--tf-radius)] bg-[var(--tf-bg)] py-1 shadow-md"
                  style={{ border: '0.5px solid var(--tf-border)' }}
                  role="menu"
                >
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer"
                  >
                    <Trash2 size={12} className="text-[var(--tf-text-tertiary)]" />
                    Dokument löschen
                  </button>
                </div>
              )}
            </div>
            <IconBtn
              onClick={() => setSelectedId(null)}
              title="Schließen"
            >
              <X size={16} />
            </IconBtn>
          </div>
        </div>

        {/* Title block */}
        <div className="px-7 pt-6 pb-5">
          <div className="text-[12px] text-[var(--tf-text-tertiary)]">
            {category}
            {meta.vorgangId ? (
              <>
                {' · zu Vorgang '}
                <button
                  type="button"
                  onClick={goToVorgang}
                  className="font-mono text-[var(--tf-primary)] hover:underline cursor-pointer"
                >
                  {meta.vorgangId}
                </button>
              </>
            ) : null}
          </div>
          <h2 className="text-[19px] font-medium text-[var(--tf-text)] leading-snug mt-1.5 break-words">
            {humanTitle}
          </h2>
          {author ? (
            <p className="text-[12px] text-[var(--tf-text-tertiary)] mt-2">{author}</p>
          ) : null}
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-1">
            {dateStr} · {meta.format.toUpperCase()}
          </p>

          <div className="flex flex-wrap gap-2 mt-4">
            <Button size="sm" onClick={() => setViewingFullDoc(true)}>
              <Eye size={13} /> Öffnen
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!meta.vorgangId}
              onClick={() => meta.vorgangId
                ? goToVorgang()
                : showToast('Kein Vorgang verknüpft')}
            >
              Im Vorgang anzeigen
            </Button>
          </div>
        </div>

        {/* Auszug */}
        <Section label="Auszug">
          {loadingDoc ? (
            <p className="text-[12.5px] text-[var(--tf-text-tertiary)] italic py-2">Lädt …</p>
          ) : !parsed?.excerpt ? (
            <p className="text-[12.5px] text-[var(--tf-text-tertiary)] italic">
              Kein Textinhalt verfügbar.
            </p>
          ) : (
            <>
              <p className="text-[13.5px] leading-[1.65] text-[var(--tf-text)] whitespace-pre-wrap">
                {parsed.excerpt}
              </p>
              <button
                type="button"
                onClick={() => setViewingFullDoc(true)}
                className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
              >
                Weiterlesen im Dokument
                <ArrowRight size={12} />
              </button>
            </>
          )}
        </Section>

        {/* Gliederung */}
        {parsed && parsed.outline.length > 0 && (
          <Section label="Gliederung">
            <div className="flex flex-col -mx-2">
              {(showAllOutline ? parsed.outline : parsed.outline.slice(0, OUTLINE_DEFAULT)).map((o, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => openOutline(o)}
                  className={`flex items-start gap-2.5 px-2 py-1 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] cursor-pointer text-left text-[13px] ${
                    o.depth === 2 ? 'pl-7 text-[var(--tf-text-secondary)]' : 'text-[var(--tf-text)]'
                  }`}
                >
                  <span className="font-mono text-[11px] text-[var(--tf-text-tertiary)] min-w-[24px] pt-[1px]">
                    {o.number}
                  </span>
                  <span className="flex-1">{o.title}</span>
                </button>
              ))}
            </div>
            {parsed.outline.length > OUTLINE_DEFAULT && (
              <button
                type="button"
                onClick={() => setShowAllOutline(prev => !prev)}
                className="mt-2 text-[11.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
              >
                {showAllOutline ? '− weniger' : `+ ${parsed.outline.length - OUTLINE_DEFAULT} weitere`}
              </button>
            )}
          </Section>
        )}

        {/* Im selben Vorgang */}
        <Section label={`Im selben Vorgang (${related.length})`}>
          {!meta.vorgangId ? (
            <p className="text-[12.5px] italic text-[var(--tf-text-tertiary)]">
              Kein Vorgang verknüpft.
            </p>
          ) : related.length === 0 ? (
            <p className="text-[12.5px] italic text-[var(--tf-text-tertiary)]">
              Keine weiteren Dokumente in diesem Vorgang.
            </p>
          ) : (
            <div className="flex flex-col">
              {related.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  className="flex items-center gap-2.5 py-2 cursor-pointer hover:bg-[var(--tf-hover)] text-left -mx-2 px-2 rounded-[var(--tf-radius)]"
                  style={{ borderBottom: '0.5px solid var(--tf-border)' }}
                >
                  <FileText size={13} className="text-[var(--tf-text-tertiary)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[var(--tf-text)] truncate">{d.filename}</div>
                    <div className="text-[12px] text-[var(--tf-text-tertiary)] mt-0.5">{d.tags[0] ?? '—'}</div>
                  </div>
                  <span className="text-[12px] text-[var(--tf-text-tertiary)] shrink-0">
                    {new Date(d.created).toLocaleDateString('de-DE')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* Tags — read-only mit "+ Tag" Toggle */}
        <div
          className="px-7 pt-4 pb-7"
          style={{ borderTop: '0.5px solid var(--tf-border)' }}
        >
          {tagEditMode ? (
            <>
              <TagInput value={meta.tags} onChange={handleTagsChange} suggestions={suggest} />
              <button
                type="button"
                onClick={() => setTagEditMode(false)}
                className="mt-2 text-[11.5px] text-[var(--tf-primary)] hover:underline cursor-pointer"
              >
                Fertig
              </button>
            </>
          ) : (
            <div className="flex items-center flex-wrap gap-1.5">
              {meta.tags.length === 0 ? (
                <span className="text-[11.5px] italic text-[var(--tf-text-tertiary)]">Keine Tags.</span>
              ) : (
                meta.tags.map(t => (
                  <span
                    key={t}
                    className="px-2 py-[3px] text-[11px] rounded-full bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]"
                  >
                    {t}
                  </span>
                ))
              )}
              <button
                type="button"
                onClick={() => setTagEditMode(true)}
                className="ml-1 text-[11px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
              >
                + Tag
              </button>
            </div>
          )}
        </div>
      </aside>

      {toast ? (
        <div
          className="fixed bottom-4 right-4 z-[60] max-w-[320px] px-3 py-2 rounded-[var(--tf-radius-lg)] bg-[var(--tf-bg)] text-[12px] text-[var(--tf-text)] shadow-lg"
          style={{ border: '0.5px solid var(--tf-border)' }}
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function IconBtn({ children, onClick, title, active = false }: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex items-center justify-center w-8 h-8 rounded-[var(--tf-radius)] transition-colors cursor-pointer ${
        active
          ? 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]'
          : 'text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]'
      }`}
    >
      {children}
    </button>
  );
}

function Section({ label, children }: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      className="px-7 py-5"
      style={{ borderTop: '0.5px solid var(--tf-border)' }}
    >
      <div
        className="text-[11px] uppercase text-[var(--tf-text-tertiary)] mb-2.5"
        style={{ letterSpacing: '0.6px' }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
