import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AntraegeMain } from './AntraegeMain';
import { AntraegeHeader } from './AntraegeHeader';
import { VerbundDetail } from './VerbundDetail';
import { FilterDrawer } from './FilterDrawer';
import { useAntraegeStore } from './store';
import { useAntraegeHybridSearch } from './useAntraegeHybridSearch';
import { loeseDetailAuf } from './detailAufloesung';
import { AufnahmeHost } from './aufnahme-einfach';
import { isGutachtenWorkflowEnabled } from '@/config/feature-flags';
import {
  ANTRAEGE_LIST_COLLAPSED_KEY,
  parseCollapsedFlag,
  serializeCollapsedFlag,
  shouldShowList,
} from './listCollapse';
import { ANTRAEGE_ROUTE, detailSchliessenZiel, herkunftJetzt, rueckwegAus } from '@/core/nav/herkunft';
import { antragDetailPfad } from './detailPfad';
import { EinklappIcon } from '@/components/ui/EinklappIcon';

const FILTER_OPEN_KEY = 'teamflow_antraege_filter_open';

function loadFilterOpen(): boolean {
  try {
    const v = localStorage.getItem(FILTER_OPEN_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch { /* ignore */ }
  return false;
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
  // Einklapp-Zustand der Antrags-Liste (nur im Detail-Modus wirksam) — additiv
  // neben der persistierten Listenbreite (AntraegeMain `narrowWidth`).
  const [listCollapsed, setListCollapsed] = useState(loadListCollapsed);

  const setCollapsed = (next: boolean): void => {
    setListCollapsed(next);
    try { localStorage.setItem(ANTRAEGE_LIST_COLLAPSED_KEY, serializeCollapsedFlag(next)); } catch { /* ignore */ }
  };

  // EINE Ableitung für „Liste sichtbar?" — steuert sowohl den Render-Zweig unten
  // als auch den Fokus-Modus im Seitenkopf: Listen-Werkzeuge (Sicht-Tabs, Suche,
  // Export, Ansicht, Filter) wirken ausschliesslich auf die Liste und wären ohne
  // sie tote Knöpfe. Kein zweiter Ableitungsweg (vgl. listCollapse.ts).
  const listeSichtbar = shouldShowList(hasDetail, listCollapsed);

  // Herkunft des Aufrufs (siehe `core/nav/herkunft.ts`): wer aus der Suche oder
  // dem Vorgangs-Board kam, soll auch dorthin zurückkommen — sonst landet er in
  // einer Liste, die er nie geöffnet hat. Die Herkunft ist die letzte Seite
  // AUSSERHALB der Detail-Routen, ein Weiterspringen im Detail lässt sie also
  // stehen. Bei jedem Render frisch gelesen: sie ändert sich nur beim
  // Navigieren, und dann rendert diese Seite ohnehin neu.
  const herkunft = herkunftJetzt();
  const rueckweg = rueckwegAus(herkunft, ANTRAEGE_ROUTE);
  const closeDetail = (): void => navigate(detailSchliessenZiel(herkunft));
  const openAntrag = (az: string): void => navigate(antragDetailPfad({ aktenzeichen: az }));

  // Aufloesung Schluessel → Verbund-Container: rein und getestet in
  // `detailAufloesung.ts` (inkl. der Heilung einer Verbund-Nummer, die im
  // Aktenzeichen-Slot der Adresse steht). Gerechnet auf der schon geladenen
  // Slim-Projektion, ohne IDB-Runde.
  const detailProps = useMemo(
    () => loeseDetailAuf(antraege, selectedAz, selectedVb),
    [antraege, selectedAz, selectedVb],
  );

  const toggleFilter = (): void => {
    setFilterOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(FILTER_OPEN_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  // Wenn das Detail geöffnet wird während der Drawer/Sidebar offen war,
  // bleibt `filterOpen` erhalten — Filter werden im Drawer-Modus weiter
  // gerendert. Die Persistenz läuft ausschliesslich über `toggleFilter`.

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-60px)] overflow-hidden">
      <AntraegeHeader
        filterOpen={filterOpen}
        onToggleFilter={toggleFilter}
        listeSichtbar={listeSichtbar}
      />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Die persistente Filter-Leiste steht seit v4.76 IN der Liste
            (`AntraegeMain` → `FilterSpalte`), nicht mehr neben ihr: nur so kann
            die Werkzeug-Zeile über Leiste UND Tabelle spannen und der Kopf der
            Leiste mit dem Tabellenkopf ein Band bilden. Im Detail-Modus
            übernimmt weiterhin der `FilterDrawer` (Overlay). */}
        {listeSichtbar ? (
          <AntraegeMain
            narrow={hasDetail}
            onCollapse={hasDetail ? () => setCollapsed(true) : undefined}
            filterOpen={!hasDetail && filterOpen}
            onToggleFilter={toggleFilter}
          />
        ) : (
          // Eingeklappt (nur im Detail-Modus): schmale Leiste zum Wiedereinblenden.
          // Das Detail-Panel daneben (flex-1) nimmt den frei werdenden Platz.
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Anträge einblenden"
            title="Anträge einblenden"
            aria-expanded={false}
            className="shrink-0 w-8 h-full flex flex-col items-center gap-3 py-3 cursor-pointer bg-[var(--tf-bg)] hover:bg-[var(--tf-bg-secondary)] transition-colors"
            style={{ borderRight: '0.5px solid var(--tf-border)' }}
          >
            <EinklappIcon offen={false} className="text-[var(--tf-text-tertiary)]" />
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
            zurueck={rueckweg
              ? { label: rueckweg.label, onClick: () => navigate(rueckweg.route) }
              : undefined}
          />
        ) : null}

      </div>

      {/* Drawer-Variante — nur sichtbar wenn Detail offen UND Filter
          aktiviert. Überlagert das Detail. Im Fokus-Modus (Liste eingeklappt)
          unterdrückt: der Filter ist ein Listen-Werkzeug. `filterOpen` bleibt
          persistiert — der Drawer kehrt beim Wiedereinblenden zurück. */}
      <FilterDrawer
        open={hasDetail && filterOpen && listeSichtbar}
        onClose={toggleFilter}
        search={search}
        onSearchChange={setSearch}
      />

      {/* Aufnahme (Teil A) + Batch-Generierung (Teil B), flag-gated. Der Host ist
          immer gemountet (Job überlebt Overlay-Open/Close); Button sitzt im Header. */}
      {isGutachtenWorkflowEnabled() && <AufnahmeHost />}
    </div>
  );
}
