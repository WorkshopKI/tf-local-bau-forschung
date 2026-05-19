import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AntraegeMain } from './AntraegeMain';
import { AntraegeHeader } from './AntraegeHeader';
import { AntragDetail } from './AntragDetail';
import { VerbundDetail } from './VerbundDetail';
import { FilterDrawer } from './FilterDrawer';
import { FilterSidebar } from './filter/FilterSidebar';
import { useAntraegeStore } from './store';
import { useAntraegeHybridSearch } from './useAntraegeHybridSearch';

const FILTER_OPEN_KEY = 'teamflow_antraege_filter_open';
const FILTER_WIDTH_KEY = 'teamflow_antraege_filter_width';
const FILTER_DEFAULT_WIDTH = 460;
const FILTER_MIN_WIDTH = 280;
const FILTER_MAX_WIDTH = 720;

function loadFilterOpen(): boolean {
  try {
    const v = localStorage.getItem(FILTER_OPEN_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch { /* ignore */ }
  return false;
}

function loadFilterWidth(): number {
  try {
    const v = Number(localStorage.getItem(FILTER_WIDTH_KEY));
    if (Number.isFinite(v) && v >= FILTER_MIN_WIDTH && v <= FILTER_MAX_WIDTH) return v;
  } catch { /* ignore */ }
  return FILTER_DEFAULT_WIDTH;
}

export function AntraegePage(): React.ReactElement {
  const navigate = useNavigate();
  const selectedAz = useAntraegeStore(s => s.selectedAktenzeichen);
  const selectedVb = useAntraegeStore(s => s.selectedVerbundId);
  const antraege = useAntraegeStore(s => s.antraege);
  const search = useAntraegeStore(s => s.search);
  const setSearch = useAntraegeStore(s => s.setSearch);
  // Hybrid-Suche (Substring auf CSV-Volltexten + Embedding aus Auslastungs-
  // Korpus + DMS-Index) — schreibt Treffer-Set in den Store. `useFiltered-
  // Antraege` und `AntraegeHeader` lesen den State. Side-Effect-Only Hook.
  useAntraegeHybridSearch();
  const hasDetail = !!(selectedAz || selectedVb);
  const [filterOpen, setFilterOpen] = useState(loadFilterOpen);
  const [filterWidth, setFilterWidth] = useState(loadFilterWidth);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onResizeMouseDown = useCallback((e: React.MouseEvent): void => {
    dragRef.current = { startX: e.clientX, startWidth: filterWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent): void => {
      const drag = dragRef.current;
      if (!drag) return;
      // Sidebar rechts: nach links draggen → breiter (Delta invertiert).
      const delta = drag.startX - ev.clientX;
      const next = Math.min(FILTER_MAX_WIDTH, Math.max(FILTER_MIN_WIDTH, drag.startWidth + delta));
      setFilterWidth(next);
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
  }, [filterWidth]);

  useEffect(() => {
    try { localStorage.setItem(FILTER_WIDTH_KEY, String(filterWidth)); } catch { /* ignore */ }
  }, [filterWidth]);

  const closeDetail = (): void => navigate('/antraege');
  const openAntrag = (az: string): void => navigate(`/antraege/${encodeURIComponent(az)}`);
  const openVerbund = (id: string): void => navigate(`/antraege/verbund/${encodeURIComponent(id)}`);

  const toggleFilter = (): void => {
    setFilterOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(FILTER_OPEN_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  // Wenn das Detail geöffnet wird während der Drawer/Sidebar offen war,
  // bleibt `filterOpen` erhalten — Filter werden im Drawer-Modus weiter
  // gerendert. Beim Schließen des Drawers muss localStorage konsistent
  // bleiben — handled in toggleFilter.
  useEffect(() => {
    // Persistenz-Sync nur über toggleFilter; useEffect hier nur als Hook.
  }, [filterOpen]);

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-60px)] overflow-hidden">
      <AntraegeHeader filterOpen={filterOpen} onToggleFilter={toggleFilter} />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <AntraegeMain narrow={hasDetail} />
        {selectedVb ? (
          <VerbundDetail verbundId={selectedVb} onClose={closeDetail} onOpenAntrag={openAntrag} />
        ) : selectedAz ? (
          <AntragDetail
            aktenzeichen={selectedAz}
            onClose={closeDetail}
            onOpenVerbund={openVerbund}
            onOpenAntrag={openAntrag}
          />
        ) : null}

        {/* Persistente Filter-Sidebar (rechts) — nur wenn KEIN Detail offen
            ist und Filter aufgeklappt. Im Detail-Modus übernimmt der
            FilterDrawer (overlay). Resize-Handle am linken Rand der Aside. */}
        {!hasDetail && filterOpen && (
          <aside
            className="shrink-0 h-full overflow-hidden flex"
            style={{ width: filterWidth }}
          >
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Filter-Panel-Breite ändern"
              onMouseDown={onResizeMouseDown}
              className="shrink-0 w-[4px] h-full cursor-col-resize hover:bg-[var(--tf-border-hover)] transition-colors"
              style={{ borderRight: '0.5px solid var(--tf-border)' }}
            />
            <div className="flex-1 min-w-0 h-full">
              <FilterSidebar
                antraege={antraege}
                search={search}
                onSearchChange={setSearch}
                hideSearch
              />
            </div>
          </aside>
        )}
      </div>

      {/* Drawer-Variante — nur sichtbar wenn Detail offen UND Filter
          aktiviert. Überlagert das Detail. */}
      <FilterDrawer
        open={hasDetail && filterOpen}
        onClose={toggleFilter}
        antraege={antraege}
        search={search}
        onSearchChange={setSearch}
      />
    </div>
  );
}
