import { useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Badge, SectionHeader, ListItem } from '@/ui';
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
    const timer = setTimeout(() => { search(q, type ? { type } : undefined); }, 300);
    setDebounceTimer(timer);
  }, [search, debounceTimer]);

  const handleQueryChange = (q: string): void => { setQuery(q); handleSearch(q, typeFilter); };
  const handleFilterChange = (type: string): void => { setTypeFilter(type); handleSearch(query, type); };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-4">Suche</h1>
        <div className="relative w-full max-w-xl">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)]" />
          <input value={query} onChange={e => handleQueryChange(e.target.value)}
            placeholder="Suche nach Vorgängen, Dokumenten..." autoFocus
            className="w-full pl-10 pr-4 py-3 text-[14px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius-lg)] outline-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
            style={{ border: '0.5px solid var(--tf-border)' }} />
        </div>
        <div className="flex gap-2 mt-4">
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
          <p className="text-[var(--tf-text-secondary)]">Keine Ergebnisse für &quot;{query}&quot;</p>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <SectionHeader label={`${results.length} Ergebnisse`} />
          {results.map((r, i) => (
            <ListItem key={r.id}
              title={r.title || r.source}
              subtitle={r.text.slice(0, 150) + (r.text.length > 150 ? '...' : '')}
              meta={
                <>
                  <Badge variant="default">{r.type}</Badge>
                  <span className="text-[10px] text-[var(--tf-text-tertiary)]">{r.score.toFixed(1)}</span>
                </>
              }
              last={i === results.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
