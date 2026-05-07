import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AntraegeMain } from './AntraegeMain';
import { AntraegeHeader } from './AntraegeHeader';
import { AntragDetail } from './AntragDetail';
import { VerbundDetail } from './VerbundDetail';
import { FilterDrawer } from './FilterDrawer';
import { FilterSidebar } from './filter/FilterSidebar';
import { useAntraegeStore } from './store';

const FILTER_PANEL_WIDTH = 460;
const FILTER_OPEN_KEY = 'teamflow_antraege_filter_open';

function loadFilterOpen(): boolean {
  try {
    const v = localStorage.getItem(FILTER_OPEN_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
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
  const hasDetail = !!(selectedAz || selectedVb);
  const [filterOpen, setFilterOpen] = useState(loadFilterOpen);

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
          <AntragDetail aktenzeichen={selectedAz} onClose={closeDetail} onOpenVerbund={openVerbund} />
        ) : null}

        {/* Persistente Filter-Sidebar (rechts) — nur wenn KEIN Detail offen
            ist und Filter aufgeklappt. Im Detail-Modus übernimmt der
            FilterDrawer (overlay). */}
        {!hasDetail && filterOpen && (
          <aside
            className="shrink-0 h-full overflow-hidden"
            style={{ width: FILTER_PANEL_WIDTH, borderLeft: '0.5px solid var(--tf-border)' }}
          >
            <FilterSidebar
              antraege={antraege}
              search={search}
              onSearchChange={setSearch}
              hideSearch
            />
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
