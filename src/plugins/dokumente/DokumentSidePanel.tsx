import { useCallback, useEffect, useRef, useState } from 'react';
import { X, FolderOpen, FileText, Pin, ExternalLink, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer, TagInput } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useTags } from '@/core/hooks/useTags';
import { useDokumenteStore } from './store';
import type { DocumentFull } from './store';

const WIDTH_KEY = 'teamflow_dokumente_sidepanel_width';
const DEFAULT_WIDTH = 560;
const MIN_WIDTH = 380;
const MAX_WIDTH = 900;
const PREVIEW_CHARS = 1200;

function loadWidth(): number {
  try {
    const v = Number(localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(v) && v >= MIN_WIDTH && v <= MAX_WIDTH) return v;
  } catch { /* ignore */ }
  return DEFAULT_WIDTH;
}

export function DokumentSidePanel(): React.ReactElement | null {
  const storage = useStorage();
  const { suggest, addTag } = useTags();
  const {
    documents, selectedId, setSelectedId, pinned, togglePin,
    setViewingFullDoc, updateTags, remove, loadDocument,
  } = useDokumenteStore();
  const [toast, setToast] = useState<string | null>(null);
  const [width, setWidth] = useState(loadWidth);
  const [full, setFull] = useState<DocumentFull | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const meta = documents.find(d => d.id === selectedId);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingDoc(true);
    setPreviewExpanded(false);
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
      // Side-Panel ist rechts → nach links ziehen vergrößert die Breite.
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

  if (!meta) return null;

  const isPinned = pinned.has(meta.id);
  const showToast = (msg: string): void => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  const handleTagsChange = (tags: string[]): void => {
    tags.forEach(t => addTag(t));
    updateTags(meta.id, tags, storage);
  };

  const handleDelete = (): void => {
    if (!window.confirm(`„${meta.filename}" wirklich löschen?`)) return;
    remove(meta.id, storage);
  };

  // Mockup: zeige bis zu 2 andere Docs als „verknüpft".
  const linkedMockup = documents.filter(d => d.id !== meta.id).slice(0, 2);

  // Preview-Logik: erste N Zeichen oder voller Inhalt (Toggle).
  const previewMd = full?.markdown ?? '';
  const truncated = previewMd.length > PREVIEW_CHARS;
  const previewText = previewExpanded || !truncated
    ? previewMd
    : previewMd.slice(0, PREVIEW_CHARS).trimEnd();

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
        className="flex-1 min-w-0 h-full overflow-y-auto"
        style={{ borderLeft: '0.5px solid var(--tf-border)' }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-[var(--tf-bg)]"
          style={{ borderBottom: '0.5px solid var(--tf-border)' }}
        >
          <span className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
            Vorschau
          </span>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
            aria-label="Vorschau schließen"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5">
          {/* Title */}
          <h2 className="text-[16px] font-medium text-[var(--tf-text)] leading-snug break-words">
            {meta.filename}
          </h2>

          {/* Pills: Format · vorgangId · Datum */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {meta.vorgangId ? <Pill text={meta.vorgangId} mono /> : null}
            <Pill text={meta.format.toUpperCase()} />
            <Pill text={new Date(meta.created).toLocaleDateString('de-DE')} />
            {meta.pages ? <Pill text={`${meta.pages} ${meta.pages === 1 ? 'Seite' : 'Seiten'}`} /> : null}
          </div>

          {/* Action-Buttons */}
          <div className="flex flex-wrap gap-2 mt-5">
            <Button
              size="sm"
              onClick={() => setViewingFullDoc(true)}
            >
              <FolderOpen size={13} /> Öffnen
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!meta.vorgangId}
              onClick={() => showToast('Vorgangs-Verknüpfung kommt mit Phase-2-Doc-Index')}
              title={meta.vorgangId ? `Zum Vorgang ${meta.vorgangId}` : 'Kein Vorgang verknüpft'}
            >
              <ExternalLink size={13} /> Im Vorgang
            </Button>
            <Button
              size="sm"
              variant={isPinned ? 'default' : 'outline'}
              onClick={() => togglePin(meta.id)}
            >
              <Pin size={13} /> {isPinned ? 'Lösen' : 'Anheften'}
            </Button>
          </div>

          {/* Tags — editierbar */}
          <Section icon={null} label="Tags">
            <TagInput value={meta.tags} onChange={handleTagsChange} suggestions={suggest} />
          </Section>

          {/* Inhalt-Vorschau */}
          <Section icon={<FileText size={11} />} label="Inhalt">
            {loadingDoc ? (
              <p className="text-[12.5px] text-[var(--tf-text-tertiary)] italic py-2">
                Lädt …
              </p>
            ) : !previewMd ? (
              <p className="text-[12.5px] text-[var(--tf-text-tertiary)] italic">
                Kein Textinhalt verfügbar.
              </p>
            ) : (
              <>
                <div
                  className="rounded-[var(--tf-radius)] p-3 text-[12.5px] leading-relaxed bg-[var(--tf-bg-secondary)] overflow-hidden"
                  style={{ border: '0.5px solid var(--tf-border)' }}
                >
                  <MarkdownRenderer content={previewText} />
                  {truncated && !previewExpanded ? (
                    <span className="text-[var(--tf-text-tertiary)]"> …</span>
                  ) : null}
                </div>
                {truncated ? (
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPreviewExpanded(prev => !prev)}
                      className="text-[11.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
                    >
                      {previewExpanded ? '− Vorschau kürzen' : '+ Vorschau erweitern'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewingFullDoc(true)}
                      className="text-[11.5px] text-[var(--tf-primary)] hover:underline cursor-pointer"
                    >
                      Vollbild öffnen →
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </Section>

          {/* KI-Zusammenfassung — Platzhalter */}
          <Section icon={<Sparkles size={11} />} label="Dokumentauffassung (KI)">
            <p className="text-[12.5px] text-[var(--tf-text-tertiary)] italic leading-relaxed">
              Wird beim Dokumenten-Scan automatisch erstellt — Phase 2.
            </p>
          </Section>

          {/* Verknüpfte Dokumente — Mockup */}
          <Section icon={<FileText size={11} />} label="Verknüpfte Dokumente">
            {linkedMockup.length === 0 ? (
              <p className="text-[12.5px] text-[var(--tf-text-tertiary)] italic">
                Keine verknüpften Dokumente.
              </p>
            ) : (
              <div className="flex flex-col">
                {linkedMockup.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => showToast('Verknüpfungs-Logik folgt mit Phase-2')}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] cursor-pointer text-left"
                  >
                    <FileText size={12} className="text-[var(--tf-text-tertiary)] shrink-0" />
                    <span className="text-[12.5px] text-[var(--tf-text)] truncate flex-1">{d.filename}</span>
                  </button>
                ))}
                <p className="mt-2 text-[10.5px] text-[var(--tf-text-tertiary)] italic">
                  Mockup — echte Verknüpfung folgt mit dem Dokumenten-Scan.
                </p>
              </div>
            )}
          </Section>

          {/* Dezenter Löschen-Button am Ende */}
          <div
            className="mt-8 pt-4 flex justify-end"
            style={{ borderTop: '0.5px solid var(--tf-border)' }}
          >
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-2 py-1 text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer transition-colors"
            >
              <Trash2 size={12} />
              Dokument löschen
            </button>
          </div>
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

function Pill({ text, mono = false }: { text: string; mono?: boolean }): React.ReactElement {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[11px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] ${mono ? 'font-mono' : ''}`}
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      {text}
    </span>
  );
}

function Section({ icon, label, children }: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mt-6 pt-5" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
      <h3 className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-[var(--tf-text-secondary)] font-medium mb-2">
        {icon ? <span className="text-[var(--tf-text-tertiary)]">{icon}</span> : null}
        {label}
      </h3>
      {children}
    </div>
  );
}
