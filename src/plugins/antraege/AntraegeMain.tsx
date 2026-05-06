import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Filter, Plus, Search } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { applyFilters } from '@/core/services/csv';
import { menuLabel } from '@/config/feature-flags';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAntraegeStore } from './store';
import { useFilterState } from './filter/useFilterState';
import { ActiveFilterChips } from './filter/ActiveFilterChips';
import { SavePresetDialog } from './filter/SavePresetDialog';
import { AntragCard } from './AntragCard';
import { FilterDrawer } from './FilterDrawer';
import { VIEWS, getView, viewCount, type ViewKey } from './views';

const ROW_PAGE = 60;

interface Props {
  /** Wenn ein Detail-Panel offen ist, schrumpft die Liste auf 360 px und blendet Tabs / Action-Buttons aus. */
  narrow?: boolean;
}

export function AntraegeMain({ narrow = false }: Props): React.ReactElement {
  const storage = useStorage();
  const navigate = useNavigate();
  const {
    antraege,
    search,
    loading,
    programmId,
    activeView,
    selectedAktenzeichen,
    loadAll,
    setSearch,
    setActiveView,
  } = useAntraegeStore();
  const openAntrag = (az: string): void => navigate(`/antraege/${encodeURIComponent(az)}`);
  const { definitions, active, clearFilter, init, savePreset } = useFilterState();
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [newToast, setNewToast] = useState<string | null>(null);
  const [visibleRows, setVisibleRows] = useState(ROW_PAGE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  useEffect(() => {
    void loadAll(storage.idb, activeProgrammId ?? undefined);
  }, [loadAll, storage.idb, activeProgrammId]);

  useEffect(() => {
    if (programmId) void init(storage.idb, programmId);
  }, [programmId, storage.idb, init]);

  useEffect(() => {
    setVisibleRows(ROW_PAGE);
  }, [search, active, activeView, programmId]);

  // View-Predicate + Filter + Search + Sort.
  const view = getView(activeView);
  const filtered = useMemo(() => {
    const byView = antraege.filter(a => view.predicate(a));
    const filteredBase = applyFilters(byView, active, definitions);
    const q = search.trim().toLowerCase();
    const matched = q
      ? filteredBase.filter(a =>
          a.aktenzeichen.toLowerCase().includes(q)
          || (typeof a.akronym === 'string' && a.akronym.toLowerCase().includes(q))
          || (typeof a.titel === 'string' && a.titel.toLowerCase().includes(q))
          || (typeof a.antragsteller === 'string' && a.antragsteller.toLowerCase().includes(q)),
        )
      : filteredBase;
    return [...matched].sort(view.compare);
  }, [antraege, view, active, definitions, search]);

  // Counts pro Tab — basieren auf antraege ohne Filter, damit die Tabs-Counts
  // ein konsistentes "Wie viele matchen die View grundsätzlich" zeigen, nicht
  // verzerrt durch die aktuell aktiven Filter.
  const counts = useMemo(() => {
    const m = new Map<ViewKey, number>();
    for (const v of VIEWS) m.set(v.key, viewCount(v.key, antraege));
    return m;
  }, [antraege]);

  // Pagination via IntersectionObserver.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (visibleRows >= filtered.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisibleRows((v) => v + ROW_PAGE);
      },
      { rootMargin: '600px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [filtered, visibleRows]);

  const handleNew = (): void => {
    setNewToast('Antrag-Anlegen-Flow ist noch nicht verfügbar — Anträge kommen über CSV-Import (Kuration → CSV-Quellen).');
    window.setTimeout(() => setNewToast(null), 4000);
  };

  const filterCount = active.length;
  const containerWidth = narrow ? 'w-[360px] shrink-0' : 'flex-1 min-w-0';

  return (
    <div className={`${containerWidth} h-full overflow-y-auto`}>
      <div className={narrow ? 'px-4 py-4' : 'px-8 py-6 max-w-6xl'}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h1 className="text-[22px] font-medium text-[var(--tf-text)]">{menuLabel('antraege', 'Förderanträge')}</h1>
            {!narrow ? (
              <p className="text-[13px] text-[var(--tf-text-secondary)] mt-0.5">
                Ansicht: {view.label} · {filtered.length.toLocaleString('de-DE')} Einträge
              </p>
            ) : (
              <p className="text-[12px] text-[var(--tf-text-secondary)] mt-0.5">
                {filtered.length.toLocaleString('de-DE')} Einträge
              </p>
            )}
          </div>
          {!narrow ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSavePresetOpen(true)}
                disabled={active.length === 0}
              >
                <Bookmark size={14} /> Ansicht speichern
              </Button>
              <Button variant="outline" size="sm" onClick={() => setFilterDrawerOpen(true)}>
                <Filter size={14} /> Filter{filterCount > 0 ? ` (${filterCount})` : ''}
              </Button>
              <Button size="sm" onClick={handleNew}>
                <Plus size={14} /> Neu
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setFilterDrawerOpen(true)}>
              <Filter size={14} /> Filter{filterCount > 0 ? ` (${filterCount})` : ''}
            </Button>
          )}
        </div>

        {/* Tabs (nur in nicht-narrow Modus) */}
        {!narrow && (
          <div
            className="flex items-center gap-5 mb-4 overflow-x-auto"
            style={{ borderBottom: '0.5px solid var(--tf-border)' }}
          >
            {VIEWS.map(v => {
              const isActive = v.key === activeView;
              const cnt = counts.get(v.key) ?? 0;
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setActiveView(v.key)}
                  className={`pb-2.5 text-[13px] whitespace-nowrap cursor-pointer transition-colors ${
                    isActive
                      ? 'text-[var(--tf-text)] font-medium border-b-2 border-[var(--tf-text)] -mb-px'
                      : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
                  }`}
                >
                  {v.label}{' '}
                  <span className={isActive ? 'text-[var(--tf-text-tertiary)]' : 'text-[var(--tf-text-tertiary)]'}>
                    {cnt.toLocaleString('de-DE')}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Search + Sort hint */}
        <div className="mb-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-[480px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)] pointer-events-none" />
            <Input
              placeholder={narrow ? 'Schnellsuche …' : 'Schnellsuche in dieser Ansicht …'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          {!narrow && (
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{view.sortHint}</span>
          )}
        </div>

        {!narrow && (
          <ActiveFilterChips active={active} definitions={definitions} onRemove={clearFilter} />
        )}

        {/* Card list */}
        {antraege.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">
            {loading
              ? 'Lade …'
              : 'Noch keine Anträge. Erst CSV-Source registrieren und importieren (Kuration → CSV-Quellen).'}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">
            Keine Anträge matchen die aktuellen Filter.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {filtered.slice(0, visibleRows).map(a => (
              <AntragCard
                key={a.aktenzeichen}
                antrag={a}
                onClick={() => openAntrag(a.aktenzeichen)}
                selected={selectedAktenzeichen === a.aktenzeichen}
                narrow={narrow}
              />
            ))}
            {visibleRows < filtered.length ? (
              <div ref={sentinelRef} className="py-4 text-center text-[11.5px] text-[var(--tf-text-tertiary)]">
                Lade weitere Einträge …
              </div>
            ) : null}
          </div>
        )}
      </div>

      <FilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        antraege={antraege}
        search={search}
        onSearchChange={setSearch}
      />

      <SavePresetDialog
        open={savePresetOpen}
        onClose={() => setSavePresetOpen(false)}
        onSave={async (name, desc) => {
          await savePreset(storage.idb, name, desc);
        }}
      />

      {newToast && (
        <div
          className="fixed top-4 right-4 z-[60] max-w-[360px] px-3.5 py-2.5 rounded-[var(--tf-radius-lg)] bg-[var(--tf-bg)] text-[12.5px] text-[var(--tf-text)] shadow-lg"
          style={{ border: '0.5px solid var(--tf-border)' }}
          role="status"
        >
          <div className="flex items-start gap-2">
            <span>ℹ️</span>
            <div className="flex-1">{newToast}</div>
            <button
              type="button"
              onClick={() => setNewToast(null)}
              className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
              aria-label="Schließen"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
