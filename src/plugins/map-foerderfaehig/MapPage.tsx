/**
 * Seite des MAP-Moduls: Master/Detail über den geteilten `MasterDetailLayout`.
 *
 * Links die importierten Einreichungen samt Drop-Zone, rechts die Kompaktansicht.
 * Kein eigenes Master/Detail und keine eigene Sicht-Tab-Leiste (Guards
 * `no-parallel-scope-tabs`) — beides kommt aus der geteilten Layout-Schicht.
 */
import { MasterDetailLayout } from '@/components/master-detail';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { useState } from 'react';
import { EinreichungListe } from './components/EinreichungListe';
import { KompaktAnsicht } from './components/KompaktAnsicht';
import { PortfolioDemo } from './components/PortfolioDemo';
import { useMapEinreichungen } from './useMapEinreichungen';

export function MapPage(): React.ReactElement {
  const {
    einreichungen, ausgewaehlt, report, laedt, importMeldung,
    waehle, importiere, entferne,
  } = useMapEinreichungen();
  const [bereich, setBereich] = useState('einreichungen');

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-6 pt-5 pb-3 flex flex-col gap-3">
        <PageHeader
          title="Förderfähigkeit"
          subtitle="Einreichung importieren, Rechenchecks prüfen, Förderfähigkeit bewerten"
        />
        <ScopeTabs
          items={[
            { key: 'einreichungen', label: 'Einreichungen', count: einreichungen.length },
            { key: 'portfolio', label: 'Portfolio (Prinzipansicht)' },
          ]}
          activeKey={bereich}
          onChange={setBereich}
          aria-label="Bereich"
        />
      </div>

      {bereich === 'portfolio' && (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          <PortfolioDemo />
        </div>
      )}

      <div className="flex-1 min-h-0 px-6 pb-6" hidden={bereich !== 'einreichungen'}>
        <MasterDetailLayout
          listWidthKey="map-foerderfaehig-liste-breite"
          list={
            <EinreichungListe
              einreichungen={einreichungen}
              ausgewaehltId={ausgewaehlt?.id ?? null}
              importMeldung={importMeldung}
              onWaehle={waehle}
              onImportiere={importiere}
              onEntferne={entferne}
            />
          }
          detail={
            ausgewaehlt === null ? undefined : (
              <div className="p-5 overflow-y-auto h-full">
                <KompaktAnsicht einreichung={ausgewaehlt} report={report} />
              </div>
            )
          }
          onCloseDetail={() => waehle(null)}
        />
      </div>

      {laedt && (
        <span className="sr-only" role="status">Einreichungen werden geladen</span>
      )}
    </div>
  );
}
