import { useMemo } from 'react';
import { Filter, Search } from 'lucide-react';
import { useAntraegeStore } from './store';
import { useFilterState } from './filter/useFilterState';
import { VIEWS, viewCount } from './views';
import { menuLabel } from '@/config/feature-flags';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFilteredAntraege, hasExplicitVbPhaseFilter } from './useFilteredAntraege';
import { ViewModeToggle } from './ViewModeToggle';

interface Props {
  filterOpen: boolean;
  onToggleFilter: () => void;
}

/** Volle Page-Breite über List- und Detail-Spalte:
 *  H1 + Subtitle + Tabs-Toolbar mit Search + Filter-Button. */
export function AntraegeHeader({ filterOpen, onToggleFilter }: Props): React.ReactElement {
  const antraege = useAntraegeStore(s => s.antraege);
  const activeView = useAntraegeStore(s => s.activeView);
  const setActiveView = useAntraegeStore(s => s.setActiveView);
  const search = useAntraegeStore(s => s.search);
  const setSearch = useAntraegeStore(s => s.setSearch);
  const filterCount = useFilterState(s => s.active.length);
  const active = useFilterState(s => s.active);
  const definitions = useFilterState(s => s.definitions);
  const { bearbeiterFilter } = useFilteredAntraege();

  const counts = useMemo(() => {
    // Pre-Filter konsistent zum Listenrendering: Irrlaeufer (vb_phase=9)
    // werden in den Tab-Counts ausgeblendet, AUSSER ein expliziter
    // vb_phase-Filter ist aktiv (dann uebernimmt die Sidebar die Kontrolle).
    const applyVbPhasePreFilter = !hasExplicitVbPhaseFilter(active, definitions);
    const m = new Map<string, number>();
    for (const v of VIEWS) {
      m.set(v.key, viewCount(v.key, antraege, bearbeiterFilter, applyVbPhasePreFilter));
    }
    return m;
  }, [antraege, bearbeiterFilter, active, definitions]);

  return (
    <div
      className="shrink-0 px-8 pt-4 pb-0"
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}
    >
      {/* Inhalts-Wrapper mit gleicher max-Breite wie die Liste in AntraegeMain
          (max-w-6xl), damit der Filter-Button rechts mit den Status-Badges
          der AntragCards darunter fluchtet. Der äußere Container behält das
          px-8 + Border, damit die Unterkanten-Border voll durchläuft. */}
      <div className="max-w-6xl">
        {/* Title — Tabs zeigen Ansicht + Counts, Bearbeiter-Filter als Pill in
            der Chips-Zeile über den Cards (siehe AntraegeMain). */}
        <div className="mb-3">
          <h1 className="text-[22px] font-medium text-[var(--tf-text)] leading-tight">
            {menuLabel('antraege', 'Förderanträge')}
          </h1>
        </div>

        {/* Toolbar: Tabs links, Suche + Filter rechts (ml-auto). pr-4 kompensiert
            das px-4-Innenpadding der AntragCard, damit Filter-Button-Kante mit
            der Status-Badge-Kante in der Liste darunter fluchtet. */}
        <div className="flex items-end gap-4">
          <div className="flex items-end gap-5 min-w-0 overflow-x-auto overflow-y-hidden">
            {VIEWS.map(v => {
              const isActive = v.key === activeView;
              const cnt = counts.get(v.key) ?? 0;
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setActiveView(v.key)}
                  className={`pb-2.5 text-[14px] whitespace-nowrap cursor-pointer transition-colors ${
                    isActive
                      ? 'text-[var(--tf-text)] font-medium border-b-2 border-[var(--tf-text)] -mb-px'
                      : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
                  }`}
                >
                  {v.label}{' '}
                  <span className="text-[12px] text-[var(--tf-text-tertiary)]">
                    {cnt.toLocaleString('de-DE')}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0 pb-2 ml-auto pr-4">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)] pointer-events-none"
              />
              <Input
                placeholder="Anträge suchen …"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-7 h-8 w-[260px] text-[12.5px]"
              />
            </div>
            <ViewModeToggle />
            <Button
              variant={filterOpen ? 'default' : 'outline'}
              size="sm"
              onClick={onToggleFilter}
              aria-label={`Filter${filterCount > 0 ? ` (${filterCount} aktiv)` : ''}`}
              title={`Filter${filterCount > 0 ? ` (${filterCount} aktiv)` : ''}`}
              className="relative h-8 w-8 p-0"
            >
              <Filter size={13} />
              {filterCount > 0 && !filterOpen ? (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full"
                  style={{ background: 'var(--tf-primary)' }}
                />
              ) : null}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
