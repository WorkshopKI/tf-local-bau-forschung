import { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorage } from '@/core/hooks/useStorage';
import { applyFilters } from '@/core/services/csv';
import { menuLabel } from '@/config/feature-flags';
import { useAntraegeStore } from './store';
import { useFilterState } from './filter/useFilterState';
import { FilterSidebar } from './filter/FilterSidebar';
import { ActiveFilterChips } from './filter/ActiveFilterChips';

export function AntraegeListe(): React.ReactElement {
  const storage = useStorage();
  const navigate = useNavigate();
  const {
    antraege,
    verbuende,
    search,
    loading,
    programmId,
    loadAll,
    setSearch,
  } = useAntraegeStore();
  const openAntrag = (az: string): void => navigate(`/antraege/${encodeURIComponent(az)}`);
  const openVerbund = (vid: string): void => navigate(`/antraege/verbund/${encodeURIComponent(vid)}`);
  const { definitions, active, clearFilter, init } = useFilterState();

  useEffect(() => { void loadAll(storage.idb); }, [loadAll, storage.idb]);

  useEffect(() => {
    if (programmId) void init(storage.idb, programmId);
  }, [programmId, storage.idb, init]);

  const verbundMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of verbuende) m.set(v.verbund_id, v.akronym ?? v.verbund_id);
    return m;
  }, [verbuende]);

  const filtered = useMemo(() => {
    const base = applyFilters(antraege, active, definitions);
    const q = search.trim().toLowerCase();
    const sorted = [...base].sort((a, b) => a.aktenzeichen.localeCompare(b.aktenzeichen));
    if (!q) return sorted;
    return sorted.filter(a => {
      return (
        a.aktenzeichen.toLowerCase().includes(q) ||
        (typeof a.akronym === 'string' && a.akronym.toLowerCase().includes(q)) ||
        (typeof a.titel === 'string' && a.titel.toLowerCase().includes(q))
      );
    });
  }, [antraege, active, definitions, search]);

  return (
    <div className="flex h-full min-h-[calc(100vh-60px)] overflow-hidden">
      <aside
        className="w-[320px] shrink-0 flex flex-col max-h-[calc(100vh-60px)]"
        style={{ borderRight: '0.5px solid var(--tf-border)' }}
      >
        <FilterSidebar
          antraege={antraege}
          search={search}
          onSearchChange={setSearch}
        />
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-[22px] font-medium text-[var(--tf-text)]">{menuLabel('antraege', 'Förderanträge')}</h1>
            <div className="text-[12.5px] text-[var(--tf-text-tertiary)]">
              {loading ? 'Lade …' : `${filtered.length} von ${antraege.length} Einträgen`}
            </div>
          </div>

          <ActiveFilterChips
            active={active}
            definitions={definitions}
            onRemove={clearFilter}
          />

          {antraege.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">
              Noch keine Anträge. Erst CSV-Source registrieren und importieren (Kuration → CSV-Quellen).
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">
              Keine Anträge matchen die aktuellen Filter.
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ border: '0.5px solid var(--tf-border)', borderRadius: 12 }}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
                    <th className="p-3">Aktenzeichen</th>
                    <th className="p-3">Akronym</th>
                    <th className="p-3">Titel</th>
                    <th className="p-3">Antragsteller</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Verbund</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <tr
                      key={a.aktenzeichen}
                      className="cursor-pointer hover:bg-[var(--tf-bg-secondary)]"
                      style={{ borderTop: '0.5px solid var(--tf-border)' }}
                      onClick={() => openAntrag(a.aktenzeichen)}
                    >
                      <td className="p-3 font-mono text-[12px]">{a.aktenzeichen}</td>
                      <td className="p-3">{str(a.akronym)}</td>
                      <td className="p-3 max-w-[320px] truncate">{str(a.titel)}</td>
                      <td className="p-3">{str(a.antragsteller)}</td>
                      <td className="p-3">{str(a.status)}</td>
                      <td className="p-3">
                        {typeof a.verbund_id === 'string' && a.verbund_id ? (
                          <button
                            className="text-[var(--tf-primary)] hover:underline"
                            onClick={e => {
                              e.stopPropagation();
                              openVerbund(a.verbund_id as string);
                            }}
                          >
                            {verbundMap.get(a.verbund_id) ?? a.verbund_id}
                          </button>
                        ) : (
                          <span className="text-[var(--tf-text-tertiary)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function str(v: unknown): string {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'string') return v;
  return String(v);
}
