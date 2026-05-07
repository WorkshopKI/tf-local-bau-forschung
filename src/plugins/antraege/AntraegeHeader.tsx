import { useMemo } from 'react';
import { Filter, Search } from 'lucide-react';
import { useAntraegeStore } from './store';
import { useFilterState } from './filter/useFilterState';
import { VIEWS, viewCount } from './views';
import { menuLabel } from '@/config/feature-flags';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFilteredAntraege } from './useFilteredAntraege';

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
  const { filtered, view } = useFilteredAntraege();

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of VIEWS) m.set(v.key, viewCount(v.key, antraege));
    return m;
  }, [antraege]);

  return (
    <div
      className="shrink-0 px-8 pt-4 pb-0"
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}
    >
      {/* Title + Subtitle */}
      <div className="mb-3">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] leading-tight">
          {menuLabel('antraege', 'Förderanträge')}
        </h1>
        <p className="text-[13px] text-[var(--tf-text-secondary)] mt-0.5">
          Ansicht: {view.label} · {filtered.length.toLocaleString('de-DE')} Einträge
        </p>
      </div>

      {/* Toolbar: Tabs links, direkt daneben Suche + Filter. Tabs scrollen
          horizontal wenn der Platz knapp wird; Suche+Filter shrinken nicht. */}
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

        <div className="flex items-center gap-2 shrink-0 pb-2">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)] pointer-events-none"
            />
            <Input
              placeholder="Suchen …"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-7 h-8 w-[260px] text-[12.5px]"
            />
          </div>
          <Button
            variant={filterOpen ? 'default' : 'outline'}
            size="sm"
            onClick={onToggleFilter}
            className="h-8"
          >
            <Filter size={13} /> Filter{filterCount > 0 ? ` (${filterCount})` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}
