import { useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '@/ui';
import { useSearch } from '@/core/hooks/useSearch';

const FILTER_CHIPS = [
  { id: '', label: 'Alle' },
  { id: 'bauantrag', label: 'Bauanträge' },
  { id: 'dokument', label: 'Dokumente' },
];

export function SuchSeite(): React.ReactElement {
  const { search, results, loading, documentCount } = useSearch();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout>>();

  const handleSearch = useCallback((q: string, type: string) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      search(q, type ? { type } : undefined);
    }, 300);
    setDebounceTimer(timer);
  }, [search, debounceTimer]);

  const handleQueryChange = (q: string): void => {
    setQuery(q);
    handleSearch(q, typeFilter);
  };

  const handleFilterChange = (type: string): void => {
    setTypeFilter(type);
    handleSearch(query, type);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-2xl font-semibold text-[var(--tf-text)] mb-4">Suche</h1>
        <div className="relative w-full max-w-2xl">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--tf-text-secondary)]" />
          <input
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Suche nach Vorgängen, Dokumenten..."
            autoFocus
            className="w-full pl-12 pr-4 py-3 text-base bg-[var(--tf-bg)] text-[var(--tf-text)] border border-[var(--tf-border)] rounded-[var(--tf-radius)] outline-none focus:ring-2 focus:ring-[var(--tf-primary)]"
          />
        </div>
        <div className="flex gap-2 mt-4">
          {FILTER_CHIPS.map(chip => (
            <button
              key={chip.id}
              onClick={() => handleFilterChange(chip.id)}
              className={`px-3 py-1 text-sm rounded-full border cursor-pointer transition-colors ${
                typeFilter === chip.id
                  ? 'bg-[var(--tf-primary)] text-white border-[var(--tf-primary)]'
                  : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-[var(--tf-text-secondary)] text-center">Suche...</p>}

      {!query && !loading && (
        <div className="text-center py-16">
          <Search size={48} className="text-[var(--tf-text-secondary)] mx-auto mb-4" />
          <p className="text-[var(--tf-text-secondary)]">{documentCount} Dokumente im Index</p>
        </div>
      )}

      {query && !loading && results.length === 0 && (
        <div className="text-center py-16">
          <p className="text-lg text-[var(--tf-text-secondary)]">Keine Ergebnisse für &quot;{query}&quot;</p>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <p className="text-sm text-[var(--tf-text-secondary)] mb-4">{results.length} Ergebnisse</p>
          <div className="space-y-3">
            {results.map(r => (
              <div key={r.id} className="p-4 border border-[var(--tf-border)] rounded-[var(--tf-radius)] bg-[var(--tf-bg)]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-[var(--tf-text)]">{r.title || r.source}</span>
                  <Badge variant="info">Keyword</Badge>
                  <Badge variant="default">{r.type}</Badge>
                </div>
                <p className="text-sm text-[var(--tf-text-secondary)] line-clamp-2">
                  {r.text.slice(0, 200)}{r.text.length > 200 ? '...' : ''}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-[var(--tf-text-secondary)]">Score: {r.score.toFixed(1)}</span>
                  {r.tags.map(t => <Badge key={t}>{t}</Badge>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
