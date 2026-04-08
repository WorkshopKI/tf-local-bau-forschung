import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Search, Upload, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { Button, FileDropZone, SectionHeader } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useSearch } from '@/core/hooks/useSearch';
import { DocConverter } from '@/core/services/converter';
import { useDokumenteStore } from './store';

const converter = new DocConverter();
const PAGE_SIZE = 50;

export function DokumenteListe(): React.ReactElement {
  const storage = useStorage();
  const { indexDocument, search: hybridSearch, results: searchResults, loading: searchLoading } = useSearch();
  const {
    documents, loading, searchQuery, activeTag,
    loadAll, add, remove, setSelectedId, setSearchQuery, setActiveTag,
  } = useDokumenteStore();
  const dismissRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [converting, setConverting] = useState(false);
  const [showDropZone, setShowDropZone] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState(0);
  const [page, setPage] = useState(0);
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

  // Alle einzigartigen Tags sammeln
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const doc of documents) {
      for (const t of doc.tags) tagSet.add(t);
    }
    return Array.from(tagSet).sort();
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

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageDocs = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Gruppierung nach erstem Tag
  const grouped = useMemo(() => {
    const groups: Record<string, typeof pageDocs> = {};
    for (const doc of pageDocs) {
      const group = doc.tags[0] ?? 'Ohne Kategorie';
      if (!groups[group]) groups[group] = [];
      groups[group]!.push(doc);
    }
    return groups;
  }, [pageDocs]);

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
    // Auto-dismiss success after 4s
    if (success > 0 && errors.length === 0) {
      if (dismissRef.current) clearTimeout(dismissRef.current);
      dismissRef.current = setTimeout(() => setImportSuccess(0), 4000);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Dokumente</h1>
          <p className="text-[13px] text-[var(--tf-text-tertiary)]">{documents.length} Dateien</p>
        </div>
        <Button variant="secondary" icon={Upload} onClick={() => setShowDropZone(prev => !prev)}>
          Importieren
        </Button>
      </div>

      {/* Drop-Zone — nur wenn aufgeklappt */}
      {showDropZone && (
        <div className="mb-5">
          <FileDropZone onFiles={handleFiles} accept=".docx,.pdf,.md,.txt" multiple>
            {converting
              ? <p className="text-[13px] text-[var(--tf-text-secondary)]">Konvertiere...</p>
              : undefined}
          </FileDropZone>
        </div>
      )}

      {/* Import-Feedback — sichtbar auch nach DropZone-Schließung */}
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

      {/* Such- und Filter-Leiste */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)]" />
          <input
            value={searchQuery}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Dokumente durchsuchen (Volltext + Bedeutung)..."
            className="w-full pl-9 pr-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          />
        </div>
        {allTags.length > 0 && (
          <select
            value={activeTag ?? ''}
            onChange={e => { setActiveTag(e.target.value || null); setPage(0); }}
            className="px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <option value="">Alle Kategorien</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {documents.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText size={40} className="text-[var(--tf-text-tertiary)] mb-4" />
          <p className="text-[var(--tf-text-secondary)]">Noch keine Dokumente</p>
          <p className="text-[12px] text-[var(--tf-text-tertiary)] mt-1">Dateien importieren oder Dokumentverzeichnisse verbinden</p>
        </div>
      )}

      {/* Hybrid-Suchergebnisse ODER Browse-Ansicht */}
      {isSearchMode ? (
        <>
          {searchLoading && (
            <p className="text-[13px] text-[var(--tf-text-secondary)] py-4">Suche...</p>
          )}
          {!searchLoading && searchResults.length === 0 && (
            <p className="text-[13px] text-[var(--tf-text-secondary)] py-8 text-center">
              Keine Ergebnisse f&uuml;r &ldquo;{searchQuery}&rdquo;
            </p>
          )}
          {!searchLoading && searchResults.length > 0 && (
            <div>
              <p className="text-[11px] text-[var(--tf-text-tertiary)] mb-3">
                {searchResults.length} Ergebnisse
              </p>
              {searchResults.map((r, i) => (
                <div key={r.id}
                  className="py-3 cursor-pointer hover:bg-[var(--tf-hover)] rounded-[var(--tf-radius)] px-2"
                  onClick={() => {
                    const doc = documents.find(d => d.filename === r.source);
                    if (doc) setSelectedId(doc.id);
                  }}
                  style={i < searchResults.length - 1 ? { borderBottom: '0.5px solid var(--tf-border)' } : undefined}
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
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Keine Treffer */}
          {documents.length > 0 && filtered.length === 0 && (
            <p className="text-[13px] text-[var(--tf-text-secondary)] py-8 text-center">
              Keine Dokumente gefunden
            </p>
          )}

          {/* Gruppierte Ergebnisse */}
          {Object.entries(grouped).map(([group, docs]) => (
            <div key={group} className="mb-4">
              <SectionHeader label={`${group} (${docs!.length})`} />
              {docs!.map((doc, i) => (
                <div key={doc.id}
                  className="group flex items-center w-full px-2 py-2.5 hover:bg-[var(--tf-hover)] rounded-[var(--tf-radius)] transition-colors"
                  style={i < docs!.length - 1 ? { borderBottom: '0.5px solid var(--tf-border)' } : undefined}
                >
                  <button onClick={() => setSelectedId(doc.id)}
                    className="flex items-center flex-1 min-w-0 text-left cursor-pointer">
                    <FileText size={14} className="text-[var(--tf-text-tertiary)] shrink-0 mr-3" />
                    <span className="text-[13px] text-[var(--tf-text)] flex-1 truncate">{doc.filename}</span>
                    {doc.vorgangId && (
                      <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)] shrink-0 mx-3">{doc.vorgangId}</span>
                    )}
                    <span className="text-[11px] text-[var(--tf-text-tertiary)] shrink-0">
                      {new Date(doc.created).toLocaleDateString('de-DE')}
                    </span>
                  </button>
                  <button onClick={() => remove(doc.id, storage)}
                    className="p-1 ml-2 opacity-0 group-hover:opacity-100 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer transition-opacity shrink-0"
                    title="Löschen">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          ))}

          {/* Pagination */}
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
  );
}
