import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge, SectionHeader } from '@/ui';
import { useUnifiedSearch } from '@/core/hooks/useUnifiedSearch';
import { isBauantraegeEnabled } from '@/config/feature-flags';
import type { UnifiedSearchResult } from '@/core/types/search-result';

type FilterId = '' | 'antrag' | 'dokument' | 'bauantrag';

const METHOD_LABELS: Record<string, string> = {
  fulltext: 'BM25',
  vector: 'Vektor',
  hybrid: 'Hybrid',
};

function matchesFilter(r: UnifiedSearchResult, filter: FilterId): boolean {
  if (filter === '') return true;
  if (filter === 'antrag') return r.type === 'antrag';
  if (filter === 'dokument') return r.type === 'dokument';
  if (filter === 'bauantrag') return r.type === 'dokument' && r.dokumentTyp === 'bauantrag';
  return true;
}

export function SuchSeite(): React.ReactElement {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterId>('');
  const { results, loading, counts, indexInfo, vectorReady } = useUnifiedSearch(query);

  const showBauantraege = isBauantraegeEnabled();

  const filterChips = useMemo(() => {
    const base: Array<{ id: FilterId; label: string; count: number }> = [
      { id: '', label: 'Alle', count: counts.total },
      { id: 'antrag', label: 'Foerderantraege', count: counts.antraege },
      { id: 'dokument', label: 'Dokumente', count: counts.dokumente },
    ];
    if (showBauantraege) {
      base.push({ id: 'bauantrag', label: 'Bauantraege', count: counts.bauantraege });
    }
    return base;
  }, [counts, showBauantraege]);

  const filtered = useMemo(
    () => results.filter(r => matchesFilter(r, typeFilter)),
    [results, typeFilter],
  );

  return (
    <div className="px-8 pt-4 pb-6 max-w-4xl">
      <div className="flex flex-col items-start mb-8">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-4">Suche</h1>
        <div className="relative w-full max-w-xl">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)]" />
          <input
            data-tour="search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Suche nach Foerderantraegen, Dokumenten..."
            autoFocus
            className="w-full pl-10 pr-4 py-3 text-[14px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius-lg)] outline-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          />
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {filterChips.map(chip => {
            const active = typeFilter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setTypeFilter(chip.id)}
                className={`px-3 py-1 text-[12px] rounded-full cursor-pointer transition-colors ${
                  active
                    ? 'bg-[var(--tf-text)] text-[var(--tf-bg)]'
                    : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                }`}
                style={!active ? { border: '0.5px solid var(--tf-border)' } : undefined}
              >
                {chip.label} <span className="opacity-70">{chip.count}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-2 items-center">
          {!vectorReady && <Badge variant="default">Embedding-Modell laedt…</Badge>}
        </div>
      </div>

      {loading && <p className="text-[13px] text-[var(--tf-text-secondary)] text-center">Suche…</p>}

      {!query && !loading && (
        <div className="text-center py-16">
          <Search size={40} className="text-[var(--tf-text-tertiary)] mx-auto mb-4" />
          <p className="text-[var(--tf-text-tertiary)]">
            {indexInfo.dokumenteImIndex.toLocaleString('de-DE')} Dokumente im Index ·{' '}
            {indexInfo.antraegeGeladen.toLocaleString('de-DE')} Antraege geladen
          </p>
        </div>
      )}

      {query && !loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[var(--tf-text-secondary)]">Keine Ergebnisse fuer &quot;{query}&quot;</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div>
          <SectionHeader label={`${filtered.length} Ergebnisse`} />
          {filtered.map((r, i) => (
            <div
              key={`${r.type}:${r.id}`}
              className="py-3"
              style={{ borderBottom: i < filtered.length - 1 ? '0.5px solid var(--tf-border)' : 'none' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-[var(--tf-text)]">{r.title}</p>
                  {r.snippet && (
                    <p className="text-[12px] text-[var(--tf-text-secondary)] mt-1 line-clamp-3">
                      {r.snippet}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1.5 text-[11px] text-[var(--tf-text-tertiary)]">
                    {r.type === 'antrag' && (
                      <>
                        {r.fkz && <span>{r.fkz}</span>}
                        {r.programm && <span>· {r.programm}</span>}
                        {r.status && <span>· {r.status}</span>}
                        {r.antragsdatum && <span>· {r.antragsdatum}</span>}
                      </>
                    )}
                    {r.type === 'dokument' && (
                      <>
                        {r.dateiname && r.dateiname !== r.title && <span>{r.dateiname}</span>}
                        {r.zugehoerigerAntragFkz && <span>· FKZ {r.zugehoerigerAntragFkz}</span>}
                        {r.zugehoerigesProgramm && <span>· {r.zugehoerigesProgramm}</span>}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="default">{r.type === 'antrag' ? 'Antrag' : (r.dokumentTyp ?? 'Dokument')}</Badge>
                  <Badge variant="default">{METHOD_LABELS[r.method] ?? r.method}</Badge>
                  <span className="text-[11px] text-[var(--tf-text-tertiary)]">
                    {r.score.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
