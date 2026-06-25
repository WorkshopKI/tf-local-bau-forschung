/**
 * Route-Root `/anfragen`: oben die `.msg`-Aufnahme, darunter Master-Detail
 * (Liste links, Schritt-für-Schritt-Detail rechts). Gegated über
 * `featureFlag: 'anfragen'` (nur dev).
 */
import { useEffect } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { isDevFixturesEnabled } from '@/config/feature-flags';
import { MasterDetailLayout } from '@/components/master-detail';
import { useAnfragenStore } from './store';
import { AnfrageAufnahme } from './AnfrageAufnahme';
import { AnfrageListe } from './AnfrageListe';
import { AnfrageDetail } from './AnfrageDetail';
import { AnfrageRecallEval } from './AnfrageRecallEval';

export function AnfragenPage(): React.ReactElement {
  const storage = useStorage();
  const anfragen = useAnfragenStore(s => s.anfragen);
  const selectedId = useAnfragenStore(s => s.selectedId);
  const loading = useAnfragenStore(s => s.loading);
  const loadAll = useAnfragenStore(s => s.loadAll);
  const select = useAnfragenStore(s => s.select);

  useEffect(() => { void loadAll(storage); }, [loadAll, storage]);

  const selected = anfragen.find(a => a.id === selectedId);

  const hint = (text: string): React.ReactElement => (
    <p className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-10">{text}</p>
  );

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-60px)] overflow-hidden">
      <div className="shrink-0 px-8 pt-6">
        <div className="flex items-baseline gap-3 mb-4">
          <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Anfragen</h1>
          <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
            {anfragen.length} {anfragen.length === 1 ? 'Anfrage' : 'Anfragen'}
          </p>
        </div>
        <AnfrageAufnahme />
        {isDevFixturesEnabled() && <AnfrageRecallEval />}
      </div>

      <MasterDetailLayout
        listWidthKey="anfragen-list-width"
        onCloseDetail={() => select(null)}
        detail={selected ? <AnfrageDetail anfrage={selected} onClose={() => select(null)} /> : undefined}
        list={(
          <div className={selected ? 'px-2 py-2' : 'px-8 py-2'}>
            {loading
              ? hint('Lade…')
              : anfragen.length === 0
                ? hint('Noch keine Anfragen. Nimm oben eine .msg-Datei auf.')
                : <AnfrageListe anfragen={anfragen} selectedId={selectedId} onSelect={id => select(id)} />}
          </div>
        )}
      />
    </div>
  );
}
