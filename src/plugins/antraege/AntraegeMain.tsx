import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useAntraegeStore } from './store';
import { useFilterState } from './filter/useFilterState';
import { ActiveFilterChips } from './filter/ActiveFilterChips';
import { AntragCard } from './AntragCard';
import { useFilteredAntraege } from './useFilteredAntraege';

const ROW_PAGE = 60;
const NARROW_WIDTH_KEY = 'teamflow_antraege_narrow_width';
const NARROW_DEFAULT_WIDTH = 460;
const NARROW_MIN = 320;
const NARROW_MAX = 720;

interface Props {
  /** Wenn ein Detail-Panel offen ist, schrumpft die Liste auf eine
   *  resizable Sidebar. Header ist bereits außerhalb (in AntraegePage). */
  narrow?: boolean;
}

function loadNarrowWidth(): number {
  try {
    const v = Number(localStorage.getItem(NARROW_WIDTH_KEY));
    if (Number.isFinite(v) && v >= NARROW_MIN && v <= NARROW_MAX) return v;
  } catch { /* ignore */ }
  return NARROW_DEFAULT_WIDTH;
}

export function AntraegeMain({ narrow = false }: Props): React.ReactElement {
  const storage = useStorage();
  const navigate = useNavigate();
  const {
    antraege,
    loading,
    programmId,
    selectedAktenzeichen,
    loadAll,
  } = useAntraegeStore();
  const openAntrag = (az: string): void => navigate(`/antraege/${encodeURIComponent(az)}`);
  const { definitions, active, clearFilter, init } = useFilterState();
  const { filtered, view } = useFilteredAntraege();
  const [visibleRows, setVisibleRows] = useState(ROW_PAGE);
  const [narrowWidth, setNarrowWidth] = useState(loadNarrowWidth);
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
  }, [filtered.length, programmId]);

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
  }, [filtered.length, visibleRows]);

  // Resize-Drag in Narrow-Mode.
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const onResizeMouseDown = useCallback((e: React.MouseEvent): void => {
    dragRef.current = { startX: e.clientX, startWidth: narrowWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent): void => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = ev.clientX - drag.startX;
      const next = Math.min(NARROW_MAX, Math.max(NARROW_MIN, drag.startWidth + delta));
      setNarrowWidth(next);
    };
    const onUp = (): void => {
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [narrowWidth]);

  useEffect(() => {
    try { localStorage.setItem(NARROW_WIDTH_KEY, String(narrowWidth)); } catch { /* ignore */ }
  }, [narrowWidth]);

  const containerStyle: React.CSSProperties = narrow
    ? { width: narrowWidth, flexShrink: 0, position: 'relative' }
    : {};
  const containerClass = narrow
    ? 'h-full flex'
    : 'flex-1 min-w-0 h-full flex';

  return (
    <div className={containerClass} style={containerStyle}>
      <div className="flex-1 min-w-0 h-full overflow-y-auto">
        <div className={narrow ? 'px-4 pt-3 pb-4' : 'px-8 pt-3 pb-6 max-w-6xl'}>
          {/* SortHint + ActiveFilterChips — schmale Zeile direkt über den Cards. */}
          <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)] pt-1">
              {view.sortHint}
            </span>
            {active.length > 0 ? (
              <div className="flex-1 min-w-0 flex justify-end">
                <ActiveFilterChips active={active} definitions={definitions} onRemove={clearFilter} />
              </div>
            ) : null}
          </div>

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
            <div className="flex flex-col gap-1">
              {filtered.slice(0, visibleRows).map(a => (
                <AntragCard
                  key={a.aktenzeichen}
                  antrag={a}
                  onClick={() => openAntrag(a.aktenzeichen)}
                  selected={selectedAktenzeichen === a.aktenzeichen}
                  narrow={narrow}
                  showDays={view.showDaysColumn}
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
      </div>

      {/* Resize-Handle am rechten Rand der Liste im Narrow-Mode. */}
      {narrow && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Listenbreite ändern"
          onMouseDown={onResizeMouseDown}
          className="shrink-0 w-[4px] h-full cursor-col-resize hover:bg-[var(--tf-border-hover)] transition-colors"
          style={{ borderLeft: '0.5px solid var(--tf-border)' }}
        />
      )}
    </div>
  );
}
