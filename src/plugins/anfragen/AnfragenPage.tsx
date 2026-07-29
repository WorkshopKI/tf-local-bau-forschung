/**
 * Route-Root `/anfragen`: oben die `.msg`-Aufnahme, darunter Master-Detail
 * (Liste links, Schritt-für-Schritt-Detail rechts). Die Liste kann zwischen
 * Listen-/Tabellen-/Kartenansicht umgeschaltet und im Detail-Modus auf eine
 * schmale Leiste eingeklappt werden (wie bei den Förderanträgen). Gegated über
 * `featureFlag: 'anfragen'` (nur dev).
 */
import { useEffect } from 'react';
import { PanelLeftClose } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { isDevFixturesEnabled } from '@/config/feature-flags';
import { MasterDetailLayout } from '@/components/master-detail';
import { ViewModeToggle, type ViewMode } from '@/components/ui/ViewModeToggle';
import { useAnfragenStore } from './store';
import { AnfrageAufnahme } from './AnfrageAufnahme';
import { AnfrageListe } from './AnfrageListe';
import { AnfrageTabelle } from './AnfrageTabelle';
import { AnfrageKarten } from './AnfrageKarten';
import { AnfrageDetail } from './AnfrageDetail';
import { AnfrageRecallEval } from './AnfrageRecallEval';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';

export function AnfragenPage(): React.ReactElement {
  const storage = useStorage();
  const anfragen = useAnfragenStore(s => s.anfragen);
  const selectedId = useAnfragenStore(s => s.selectedId);
  const loading = useAnfragenStore(s => s.loading);
  const viewMode = useAnfragenStore(s => s.viewMode);
  const setViewMode = useAnfragenStore(s => s.setViewMode);
  const loadAll = useAnfragenStore(s => s.loadAll);
  const select = useAnfragenStore(s => s.select);

  useEffect(() => { void loadAll(storage); }, [loadAll, storage]);

  const selected = anfragen.find(a => a.id === selectedId);
  // Im schmalen Sidebar-Modus (Detail offen) immer die Listenansicht — Tabelle/
  // Karten sind in der schmalen Spalte zu eng (entspricht den Förderanträgen).
  const sidebarView: ViewMode = selected ? 'list' : viewMode;

  const hint = (text: string): React.ReactElement => (
    <p className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-10">{text}</p>
  );

  const renderView = (mode: ViewMode): React.ReactElement => {
    const props = { anfragen, selectedId, onSelect: (id: string) => select(id) };
    if (mode === 'table') return <AnfrageTabelle {...props} />;
    if (mode === 'cards') return <AnfrageKarten {...props} />;
    return <AnfrageListe {...props} />;
  };

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-60px)] overflow-hidden">
      <div className="shrink-0 px-8 pt-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Anfragen</h1>
            <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
              {anfragen.length} {anfragen.length === 1 ? 'Anfrage' : 'Anfragen'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!selected && <ViewModeToggle value={viewMode} onChange={setViewMode} />}
            <SeitenHilfeButton pluginId="anfragen" />
          </div>
        </div>
        <AnfrageAufnahme />
        {isDevFixturesEnabled() && <AnfrageRecallEval />}
      </div>

      <MasterDetailLayout
        listWidthKey="anfragen-list-width"
        collapsible
        listCollapsedKey="anfragen-list-collapsed"
        collapsedRailLabel="Anfragen einblenden"
        onCloseDetail={() => select(null)}
        detail={selected ? <AnfrageDetail key={selected.id} anfrage={selected} onClose={() => select(null)} /> : undefined}
        list={api => (
          <div className={selected ? 'px-2 py-2' : 'px-8 py-2'}>
            {selected && (
              <div className="flex items-center mb-2">
                <button
                  type="button"
                  onClick={api.toggleCollapsed}
                  aria-label="Anfragen-Liste einklappen"
                  title="Liste einklappen"
                  className="-ml-1 p-1 rounded-[6px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-bg-secondary)] transition-colors cursor-pointer"
                >
                  <PanelLeftClose size={16} />
                </button>
              </div>
            )}
            {loading
              ? hint('Lade…')
              : anfragen.length === 0
                ? hint('Noch keine Anfragen. Nimm oben eine .msg-Datei auf.')
                : renderView(sidebarView)}
          </div>
        )}
      />
    </div>
  );
}
