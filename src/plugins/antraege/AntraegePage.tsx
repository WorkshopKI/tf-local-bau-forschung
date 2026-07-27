import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AntraegeMain } from './AntraegeMain';
import { AntraegeHeader } from './AntraegeHeader';
import { VerbundDetail } from './VerbundDetail';
import { FilterDrawer } from './FilterDrawer';
import { FilterSidebar } from './filter/FilterSidebar';
import { useAntraegeStore } from './store';
import { useAntraegeHybridSearch } from './useAntraegeHybridSearch';
import { pseudoVerbundIdFor } from './pseudoVerbund';
import { AufnahmeHost } from './aufnahme-einfach';
import { isGutachtenWorkflowEnabled } from '@/config/feature-flags';
import {
  ANTRAEGE_LIST_COLLAPSED_KEY,
  parseCollapsedFlag,
  serializeCollapsedFlag,
  shouldShowList,
} from './listCollapse';
import { PanelLeftOpen } from 'lucide-react';

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

function loadListCollapsed(): boolean {
  try {
    return parseCollapsedFlag(localStorage.getItem(ANTRAEGE_LIST_COLLAPSED_KEY));
  } catch { /* ignore */ }
  return false;
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
  // Einklapp-Zustand der Antrags-Liste (nur im Detail-Modus wirksam) — additiv
  // neben der persistierten Listenbreite (AntraegeMain `narrowWidth`).
  const [listCollapsed, setListCollapsed] = useState(loadListCollapsed);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const setCollapsed = (next: boolean): void => {
    setListCollapsed(next);
    try { localStorage.setItem(ANTRAEGE_LIST_COLLAPSED_KEY, serializeCollapsedFlag(next)); } catch { /* ignore */ }
  };

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

  // EINE Ableitung für „Liste sichtbar?" — steuert sowohl den Render-Zweig unten
  // als auch den Fokus-Modus im Seitenkopf: Listen-Werkzeuge (Sicht-Tabs, Suche,
  // Export, Ansicht, Filter) wirken ausschliesslich auf die Liste und wären ohne
  // sie tote Knöpfe. Kein zweiter Ableitungsweg (vgl. listCollapse.ts).
  const listeSichtbar = shouldShowList(hasDetail, listCollapsed);

  const closeDetail = (): void => navigate('/antraege');
  const openAntrag = (az: string): void => navigate(`/antraege/${encodeURIComponent(az)}`);

  // Aufloesung Antrag → Verbund: Wenn aus der Liste eine TV-Row geklickt wird,
  // sitzt der Antrag bereits im preloaded Slim-Store (`antraege` mit
  // `verbund_id`). Daraus wird der Verbund-Container abgeleitet; faellt der
  // Antrag aus dem Verbund-Verband heraus oder ist kein verbund_id gesetzt,
  // wird ein Pseudo-Verbund mit einem TV gerendert.
  const detailProps = ((): { verbundId: string; expanded: string | undefined } | null => {
    if (selectedVb) return { verbundId: selectedVb, expanded: selectedAz ?? undefined };
    if (selectedAz) {
      const li = antraege.find(a => a.aktenzeichen === selectedAz);
      const vid = typeof li?.verbund_id === 'string' && li.verbund_id.length > 0 ? li.verbund_id : null;
      if (vid) return { verbundId: vid, expanded: selectedAz };
      return { verbundId: pseudoVerbundIdFor(selectedAz), expanded: selectedAz };
    }
    return null;
  })();

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
      <AntraegeHeader
        filterOpen={filterOpen}
        onToggleFilter={toggleFilter}
        listeSichtbar={listeSichtbar}
      />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {listeSichtbar ? (
          <AntraegeMain narrow={hasDetail} onCollapse={hasDetail ? () => setCollapsed(true) : undefined} />
        ) : (
          // Eingeklappt (nur im Detail-Modus): schmale Leiste zum Wiedereinblenden.
          // Das Detail-Panel daneben (flex-1) nimmt den frei werdenden Platz.
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Anträge einblenden"
            title="Anträge einblenden"
            className="shrink-0 w-8 h-full flex flex-col items-center gap-3 py-3 cursor-pointer bg-[var(--tf-bg)] hover:bg-[var(--tf-bg-secondary)] transition-colors"
            style={{ borderRight: '0.5px solid var(--tf-border)' }}
          >
            <PanelLeftOpen size={16} className="text-[var(--tf-text-tertiary)]" />
            <span className="text-[11px] text-[var(--tf-text-secondary)] tracking-wide [writing-mode:vertical-rl] rotate-180">
              Anträge einblenden
            </span>
          </button>
        )}
        {detailProps ? (
          <VerbundDetail
            verbundId={detailProps.verbundId}
            initialExpandedTvAz={detailProps.expanded}
            onClose={closeDetail}
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
          aktiviert. Überlagert das Detail. Im Fokus-Modus (Liste eingeklappt)
          unterdrückt: der Filter ist ein Listen-Werkzeug. `filterOpen` bleibt
          persistiert — der Drawer kehrt beim Wiedereinblenden zurück. */}
      <FilterDrawer
        open={hasDetail && filterOpen && listeSichtbar}
        onClose={toggleFilter}
        antraege={antraege}
        search={search}
        onSearchChange={setSearch}
      />

      {/* Aufnahme (Teil A) + Batch-Generierung (Teil B), flag-gated. Der Host ist
          immer gemountet (Job überlebt Overlay-Open/Close); Button sitzt im Header. */}
      {isGutachtenWorkflowEnabled() && <AufnahmeHost />}
    </div>
  );
}
