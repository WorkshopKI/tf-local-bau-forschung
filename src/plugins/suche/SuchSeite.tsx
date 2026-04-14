import { useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Badge, SectionHeader } from '@/ui';
import { useSearch } from '@/core/hooks/useSearch';

const FILTER_CHIPS = [
  { id: '', label: 'Alle' },
  { id: 'bauantrag', label: 'Bauanträge' },
  { id: 'dokument', label: 'Dokumente' },
];

const METHOD_LABELS: Record<string, string> = {
  fulltext: 'BM25',
  vector: 'Vektor',
  hybrid: 'Hybrid',
};

export function SuchSeite(): React.ReactElement {
  const { search, results, loading, vectorLoading, documentCount } = useSearch();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout>>();

  const handleSearch = useCallback((q: string, type: string) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => { search(q, type ? { type } : undefined); }, 300);
    setDebounceTimer(timer);
  }, [search, debounceTimer]);

  const handleQueryChange = (q: string): void => { setQuery(q); handleSearch(q, typeFilter); };
  const handleFilterChange = (type: string): void => { setTypeFilter(type); handleSearch(query, type); };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-4">Suche</h1>
        <div className="relative w-full max-w-xl">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)]" />
          <input data-tour="search-input" value={query} onChange={e => handleQueryChange(e.target.value)}
            placeholder="Suche nach Vorgängen, Dokumenten..." autoFocus
            className="w-full pl-10 pr-4 py-3 text-[14px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius-lg)] outline-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
            style={{ border: '0.5px solid var(--tf-border)' }} />
        </div>
        <div className="flex gap-2 mt-3">
          {FILTER_CHIPS.map(chip => (
            <button key={chip.id} onClick={() => handleFilterChange(chip.id)}
              className={`px-3 py-1 text-[12px] rounded-full cursor-pointer transition-colors ${
                typeFilter === chip.id
                  ? 'bg-[var(--tf-text)] text-[var(--tf-bg)]'
                  : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
              }`}
              style={typeFilter !== chip.id ? { border: '0.5px solid var(--tf-border)' } : undefined}>
              {chip.label}
            </button>
          ))}
        </div>
        <div className="mt-2">
          {vectorLoading && <Badge variant="default">Embedding-Modell laedt...</Badge>}
        </div>
      </div>

      {loading && <p className="text-[13px] text-[var(--tf-text-secondary)] text-center">Suche...</p>}

      {!query && !loading && (
        <div className="text-center py-16">
          <Search size={40} className="text-[var(--tf-text-tertiary)] mx-auto mb-4" />
          <p className="text-[var(--tf-text-tertiary)]">{documentCount} Dokumente im Index</p>
        </div>
      )}

      {query && !loading && results.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[var(--tf-text-secondary)]">Keine Ergebnisse fuer &quot;{query}&quot;</p>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <SectionHeader label={`${results.length} Ergebnisse`} />
          {results.map((r, i) => (
            <div key={r.id} className="py-3" style={{ borderBottom: i < results.length - 1 ? '0.5px solid var(--tf-border)' : 'none' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-[var(--tf-text)]">{r.title || r.source}</p>
                  <p className="text-[12px] text-[var(--tf-text-secondary)] mt-1 line-clamp-3">
                    {r.text.slice(0, 300)}{r.text.length > 300 ? '...' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="default">{r.type}</Badge>
                  <Badge variant="default">{METHOD_LABELS[r.method] ?? r.method}</Badge>
                </div>
              </div>
              {r.tags && r.tags.length > 0 && (
                <div className="flex gap-1 mt-1.5">
                  {r.tags.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)] rounded">{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
