import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Search, Upload, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, Pin } from 'lucide-react';
import { Button, FileDropZone } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useSearch } from '@/core/hooks/useSearch';
import { DocConverter } from '@/core/services/converter';
import { useDokumenteStore } from './store';
import type { DocumentMeta } from './store';

const converter = new DocConverter();
const PAGE_SIZE = 50;

interface Props {
  /** Wenn ein Side-Panel offen ist, schrumpft die Liste auf die linke Spalte. */
  narrow?: boolean;
}

export function DokumenteListe({ narrow = false }: Props): React.ReactElement {
  const storage = useStorage();
  const { indexDocument, search: hybridSearch, results: searchResults, loading: searchLoading } = useSearch();
  const {
    documents, loading, searchQuery, activeTag, selectedId, pinned,
    loadAll, add, setSelectedId, setSearchQuery, setActiveTag,
  } = useDokumenteStore();
  const dismissRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [converting, setConverting] = useState(false);
  const [showDropZone, setShowDropZone] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState(0);
  const [page, setPage] = useState(0);
  const [showAllTags, setShowAllTags] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isSearchMode = searchQuery.trim().length > 1;

  const handleQueryChange = useCallback((q: string): void => {
    setSearchQuery(q);
    setPage(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length > 1) {
      debounceRef.current = setTimeout(() => hybridSearch(q), 300);
    }
  }, [hybridSearch, setSearchQuery]);

  useEffect(() => { loadAll(storage); }, [storage, loadAll]);

  // Pillen: jede Pille zählt Docs, die diesen Tag tragen (any position).
  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const doc of documents) {
      for (const t of doc.tags) m.set(t, (m.get(t) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [documents]);

  // Filtern nach Suche + Tag
  const filtered = useMemo(() => {
    let result = documents;
    if (activeTag) {
      result = result.filter(d => d.tags.includes(activeTag));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d =>
        d.filename.toLowerCase().includes(q) ||
        d.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [documents, searchQuery, activeTag]);

  const pinnedDocs = useMemo(
    () => filtered.filter(d => pinned.has(d.id)),
    [filtered, pinned],
  );

  const unpinnedDocs = useMemo(
    () => filtered.filter(d => !pinned.has(d.id)),
    [filtered, pinned],
  );

  // Pagination — nur die nicht-angehefteten paginieren.
  const totalPages = Math.ceil(unpinnedDocs.length / PAGE_SIZE);
  const pageDocs = unpinnedDocs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleFiles = async (files: File[]): Promise<void> => {
    setConverting(true);
    setImportErrors([]);
    setImportSuccess(0);
    const errors: string[] = [];
    let success = 0;
    for (const file of files) {
      const exists = documents.some(d => d.filename === file.name);
      if (exists) { errors.push(`${file.name}: bereits vorhanden`); continue; }

      try {
        const result = await converter.convert(file);
        await add({
          filename: result.filename, format: result.format,
          markdown: result.markdown, tags: [], pages: result.pages,
          source: 'upload',
        }, storage);
        indexDocument({
          id: `doc-${Date.now()}`, text: result.markdown,
          title: result.filename, source: result.filename,
          tags: [], type: 'dokument',
        });
        success++;
      } catch (err) {
        console.error('Conversion failed:', file.name, err);
        errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    setImportSuccess(success);
    setImportErrors(errors);
    setConverting(false);
    setShowDropZone(errors.length > 0);
    if (success > 0 && errors.length === 0) {
      if (dismissRef.current) clearTimeout(dismissRef.current);
      dismissRef.current = setTimeout(() => setImportSuccess(0), 4000);
    }
  };

  const containerClass = narrow
    ? 'flex-1 min-w-0 h-full overflow-y-auto'
    : 'flex-1 min-w-0 h-full overflow-y-auto';
  const innerClass = narrow
    ? 'px-6 pt-4 pb-6'
    : 'px-8 pt-4 pb-6 max-w-5xl';

  return (
    <div className={containerClass}>
      <div className={innerClass}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Dokumente</h1>
            <p className="text-[13px] text-[var(--tf-text-tertiary)] mt-0.5">
              {documents.length.toLocaleString('de-DE')} {documents.length === 1 ? 'Datei' : 'Dateien'}
            </p>
          </div>
          {!narrow && (
            <Button variant="secondary" icon={Upload} onClick={() => setShowDropZone(prev => !prev)}>
              Importieren
            </Button>
          )}
        </div>

        {/* Drop-Zone */}
        {showDropZone && !narrow && (
          <div className="mb-5">
            <FileDropZone onFiles={handleFiles} accept=".docx,.pdf,.md,.txt" multiple>
              {converting
                ? <p className="text-[13px] text-[var(--tf-text-secondary)]">Konvertiere...</p>
                : undefined}
            </FileDropZone>
          </div>
        )}

        {/* Import-Feedback */}
        {importSuccess > 0 && (
          <div className="flex items-center gap-2 mb-4 p-2 rounded-[var(--tf-radius)] bg-[var(--tf-success-bg)]">
            <CheckCircle size={14} className="text-[var(--tf-success-text)]" />
            <p className="text-[12px] text-[var(--tf-success-text)]">{importSuccess} Datei(en) importiert</p>
          </div>
        )}
        {importErrors.length > 0 && (
          <div className="mb-4 p-2 rounded-[var(--tf-radius)] bg-[var(--tf-danger-bg)]">
            {importErrors.map((e, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertCircle size={14} className="text-[var(--tf-danger-text)] shrink-0 mt-0.5" />
                <p className="text-[12px] text-[var(--tf-danger-text)]">{e}</p>
              </div>
            ))}
          </div>
        )}

        {/* Volltext-Suche */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)]" />
          <input
            value={searchQuery}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Volltext + semantische Suche …"
            className="w-full pl-9 pr-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          />
        </div>

        {/* Pillen-Filter — Default: nur Tags mit ≥2 Vorkommen, Rest hinter Toggle. */}
        {tagCounts.length > 0 && (() => {
          const visible = showAllTags ? tagCounts : tagCounts.filter(([, c]) => c >= 2);
          const hiddenCount = tagCounts.length - visible.length;
          // Sicherstellen, dass eine aktive Pille immer sichtbar ist (auch wenn count=1).
          const visibleWithActive = activeTag && !visible.some(([t]) => t === activeTag)
            ? [...visible, ...tagCounts.filter(([t]) => t === activeTag)]
            : visible;
          return (
            <div className="flex items-center gap-1.5 mb-5 flex-wrap">
              <PillButton
                label="Alle"
                count={documents.length}
                active={!activeTag}
                onClick={() => { setActiveTag(null); setPage(0); }}
              />
              {visibleWithActive.map(([tag, cnt]) => (
                <PillButton
                  key={tag}
                  label={tag}
                  count={cnt}
                  active={activeTag === tag}
                  onClick={() => { setActiveTag(activeTag === tag ? null : tag); setPage(0); }}
                />
              ))}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllTags(prev => !prev)}
                  className="px-2 py-0.5 text-[11px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
                >
                  {showAllTags ? '− weniger' : `+ ${hiddenCount} weitere`}
                </button>
              )}
            </div>
          );
        })()}

        {documents.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText size={40} className="text-[var(--tf-text-tertiary)] mb-4" />
            <p className="text-[var(--tf-text-secondary)]">Noch keine Dokumente</p>
            <p className="text-[12px] text-[var(--tf-text-tertiary)] mt-1">Dateien importieren oder Dokumentverzeichnisse verbinden</p>
          </div>
        )}

        {/* Hybrid-Suchergebnisse ODER Browse */}
        {isSearchMode ? (
          <>
            {searchLoading && (
              <p className="text-[13px] text-[var(--tf-text-secondary)] py-4">Suche...</p>
            )}
            {!searchLoading && searchResults.length === 0 && (
              <p className="text-[13px] text-[var(--tf-text-secondary)] py-8 text-center">
                Keine Ergebnisse für „{searchQuery}"
              </p>
            )}
            {!searchLoading && searchResults.length > 0 && (
              <div>
                <p className="text-[11px] text-[var(--tf-text-tertiary)] mb-3">
                  {searchResults.length} Ergebnisse
                </p>
                {searchResults.map(r => {
                  const doc = documents.find(d => d.filename === r.source);
                  return (
                    <button
                      key={r.id}
                      onClick={() => doc && setSelectedId(doc.id)}
                      className="w-full text-left py-3 px-2 cursor-pointer hover:bg-[var(--tf-hover)] rounded-[var(--tf-radius)] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-[var(--tf-text)]">{r.title || r.source}</p>
                          <p className="text-[12px] text-[var(--tf-text-secondary)] mt-1 line-clamp-2">
                            {r.text.slice(0, 200)}{r.text.length > 200 ? '...' : ''}
                          </p>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)] rounded shrink-0">
                          {r.method === 'hybrid' ? 'Hybrid' : r.method === 'fulltext' ? 'BM25' : 'Vektor'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {documents.length > 0 && filtered.length === 0 && (
              <p className="text-[13px] text-[var(--tf-text-secondary)] py-8 text-center">
                Keine Dokumente gefunden
              </p>
            )}

            {/* ANGEHEFTET-Section */}
            {pinnedDocs.length > 0 && (
              <DocSection
                label="Angeheftet"
                docs={pinnedDocs}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}

            {/* Hauptliste */}
            {pageDocs.length > 0 && (
              <DocSection
                label={activeTag ?? 'Dokumente'}
                docs={pageDocs}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6 pt-4" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] text-[var(--tf-text-secondary)] cursor-pointer disabled:opacity-30 disabled:cursor-default"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[12px] text-[var(--tf-text-tertiary)]">
                  Seite {page + 1} von {totalPages}
                </span>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] text-[var(--tf-text-secondary)] cursor-pointer disabled:opacity-30 disabled:cursor-default"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PillButton({ label, count, active, onClick }: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 text-[11.5px] rounded-full whitespace-nowrap transition-colors cursor-pointer ${
        active
          ? 'bg-[var(--tf-text)] text-[var(--tf-bg)]'
          : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)]'
      }`}
      style={active ? undefined : { border: '0.5px solid var(--tf-border)' }}
    >
      {label}{' '}
      <span className={active ? 'opacity-70' : 'text-[var(--tf-text-tertiary)]'}>{count}</span>
    </button>
  );
}

function DocSection({ label, docs, selectedId, onSelect }: {
  label: string;
  docs: DocumentMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}): React.ReactElement {
  return (
    <div className="mb-6">
      <div className="flex items-baseline gap-2 mb-2">
        <h3 className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-secondary)] font-medium">
          {label}
        </h3>
        <span className="text-[11px] text-[var(--tf-text-tertiary)]">
          {docs.length} {docs.length === 1 ? 'Datei' : 'Dateien'}
        </span>
      </div>
      <div className="flex flex-col">
        {docs.map(doc => (
          <DocRow
            key={doc.id}
            doc={doc}
            selected={selectedId === doc.id}
            onClick={() => onSelect(doc.id)}
          />
        ))}
      </div>
    </div>
  );
}

function DocRow({ doc, selected, onClick }: {
  doc: DocumentMeta;
  selected: boolean;
  onClick: () => void;
}): React.ReactElement {
  const pinned = useDokumenteStore(s => s.pinned);
  const isPinned = pinned.has(doc.id);
  const subline = [
    doc.tags[0] ?? null,
    doc.vorgangId ? doc.vorgangId : null,
  ].filter((s): s is string => !!s).join(' · ');
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left px-3 py-2.5 rounded-[var(--tf-radius)] transition-colors flex items-start gap-3 ${
        selected ? '' : 'hover:bg-[var(--tf-hover)]'
      }`}
      style={selected
        ? { background: 'var(--tf-bg-secondary)', border: '0.5px solid var(--tf-border-hover)' }
        : { border: '0.5px solid transparent' }}
    >
      <FileText size={14} className="text-[var(--tf-text-tertiary)] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[var(--tf-text)] font-medium truncate">{doc.filename}</span>
          {isPinned ? (
            <Pin size={11} className="text-[var(--tf-text-tertiary)] shrink-0" aria-label="Angeheftet" />
          ) : null}
        </div>
        {subline ? (
          <div className="text-[11.5px] text-[var(--tf-text-tertiary)] truncate mt-0.5">{subline}</div>
        ) : null}
      </div>
      <span className="text-[11px] text-[var(--tf-text-tertiary)] shrink-0 mt-0.5">
        {new Date(doc.created).toLocaleDateString('de-DE')}
      </span>
    </button>
  );
}
