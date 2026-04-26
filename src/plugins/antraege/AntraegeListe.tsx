import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { applyFilters } from '@/core/services/csv';
import { menuLabel } from '@/config/feature-flags';
import { useAntraegeStore } from './store';
import { useFilterState } from './filter/useFilterState';
import { FilterSidebar } from './filter/FilterSidebar';
import { ActiveFilterChips } from './filter/ActiveFilterChips';
import type { Antrag } from '@/core/services/csv/types';

const GROUP_TOGGLE_KEY = 'teamflow_antraege_group_by_verbund';
const NO_VERBUND_KEY = '__no_verbund__';

interface VerbundGroup {
  key: string;
  verbund_id: string | null;
  akronym: string | null;
  antraege: Antrag[];
}

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

  const [groupByVerbund, setGroupByVerbund] = useState<boolean>(() => {
    try { return localStorage.getItem(GROUP_TOGGLE_KEY) === '1'; } catch { return false; }
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => { void loadAll(storage.idb); }, [loadAll, storage.idb]);

  useEffect(() => {
    if (programmId) void init(storage.idb, programmId);
  }, [programmId, storage.idb, init]);

  useEffect(() => {
    try { localStorage.setItem(GROUP_TOGGLE_KEY, groupByVerbund ? '1' : '0'); } catch { /* ignore */ }
  }, [groupByVerbund]);

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
      const verbundAkronym = typeof a.verbund_id === 'string' ? verbundMap.get(a.verbund_id) : undefined;
      return (
        a.aktenzeichen.toLowerCase().includes(q) ||
        (typeof a.akronym === 'string' && a.akronym.toLowerCase().includes(q)) ||
        (typeof a.titel === 'string' && a.titel.toLowerCase().includes(q)) ||
        (typeof a.verbund_id === 'string' && a.verbund_id.toLowerCase().includes(q)) ||
        (typeof verbundAkronym === 'string' && verbundAkronym.toLowerCase().includes(q))
      );
    });
  }, [antraege, active, definitions, search, verbundMap]);

  const groups = useMemo<VerbundGroup[] | null>(() => {
    if (!groupByVerbund) return null;
    const map = new Map<string, VerbundGroup>();
    for (const a of filtered) {
      const vid = typeof a.verbund_id === 'string' && a.verbund_id ? a.verbund_id : NO_VERBUND_KEY;
      let g = map.get(vid);
      if (!g) {
        g = {
          key: vid,
          verbund_id: vid === NO_VERBUND_KEY ? null : vid,
          akronym: vid !== NO_VERBUND_KEY ? verbundMap.get(vid) ?? null : null,
          antraege: [],
        };
        map.set(vid, g);
      }
      g.antraege.push(a);
    }
    const arr = Array.from(map.values());
    arr.sort((g1, g2) => {
      if (g1.key === NO_VERBUND_KEY) return 1;
      if (g2.key === NO_VERBUND_KEY) return -1;
      const l1 = (g1.akronym ?? g1.verbund_id ?? '').toLowerCase();
      const l2 = (g2.akronym ?? g2.verbund_id ?? '').toLowerCase();
      return l1.localeCompare(l2);
    });
    return arr;
  }, [filtered, groupByVerbund, verbundMap]);

  const toggleGroup = (key: string): void => {
    setCollapsedGroups(s => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
          <div className="flex items-center justify-between mb-4 gap-3">
            <h1 className="text-[22px] font-medium text-[var(--tf-text)]">{menuLabel('antraege', 'Förderanträge')}</h1>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setGroupByVerbund(v => !v)}
                className={
                  groupByVerbund
                    ? 'px-2.5 py-1 rounded-full text-[11.5px] bg-[var(--tf-text)] text-[var(--tf-bg)]'
                    : 'px-2.5 py-1 rounded-full text-[11.5px] text-[var(--tf-text-secondary)] border-[0.5px] border-[var(--tf-border)] hover:bg-[var(--tf-bg-secondary)]'
                }
                title="Anträge nach Verbund gruppieren"
              >
                Nach Verbund gruppieren
              </button>
              <div className="text-[12.5px] text-[var(--tf-text-tertiary)]">
                {loading ? 'Lade …' : `${filtered.length} von ${antraege.length} Einträgen`}
              </div>
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
                    {!groupByVerbund ? <th className="p-3">Verbund</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {groups
                    ? groups.flatMap(g => {
                        const collapsed = collapsedGroups.has(g.key);
                        const headerLabel = g.verbund_id
                          ? `${g.akronym ?? g.verbund_id}`
                          : 'Einzelanträge ohne Verbund';
                        const rows: React.ReactNode[] = [];
                        rows.push(
                          <tr
                            key={`g-${g.key}`}
                            className="bg-[var(--tf-bg-subtle)] cursor-pointer hover:bg-[var(--tf-bg-secondary)]"
                            style={{ borderTop: '0.5px solid var(--tf-border)' }}
                            onClick={() => toggleGroup(g.key)}
                          >
                            <td colSpan={5} className="p-3">
                              <div className="flex items-center gap-2">
                                {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                <span className="font-medium text-[var(--tf-text)]">{headerLabel}</span>
                                {g.verbund_id ? (
                                  <span className="font-mono text-[11px] text-[var(--tf-text-tertiary)]">{g.verbund_id}</span>
                                ) : null}
                                <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                                  ({g.antraege.length} {g.antraege.length === 1 ? 'Antrag' : 'Teilanträge'})
                                </span>
                                {g.verbund_id ? (
                                  <button
                                    className="ml-auto text-[11.5px] text-[var(--tf-primary)] hover:underline"
                                    onClick={e => {
                                      e.stopPropagation();
                                      openVerbund(g.verbund_id as string);
                                    }}
                                  >
                                    Verbund-Detail →
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>,
                        );
                        if (!collapsed) {
                          for (const a of g.antraege) {
                            rows.push(
                              <tr
                                key={`a-${a.aktenzeichen}`}
                                className="cursor-pointer hover:bg-[var(--tf-bg-secondary)]"
                                style={{ borderTop: '0.5px solid var(--tf-border)' }}
                                onClick={() => openAntrag(a.aktenzeichen)}
                              >
                                <td className="p-3 pl-8 font-mono text-[12px]">{a.aktenzeichen}</td>
                                <td className="p-3">{str(a.akronym)}</td>
                                <td className="p-3 max-w-[320px] truncate">{str(a.titel)}</td>
                                <td className="p-3">{str(a.antragsteller)}</td>
                                <td className="p-3">{str(a.status)}</td>
                              </tr>,
                            );
                          }
                        }
                        return rows;
                      })
                    : filtered.map(a => (
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
