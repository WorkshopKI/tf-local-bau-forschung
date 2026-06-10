/**
 * UebersichtView (v2.21) — Tab "Auslastung MA" des Auslastungs-Moduls.
 *
 *   - StatistikSection (collapsible) mit HeadlineInsight + KpiGrid + WarnungenZeile
 *   - MaListSection (kompakte Tabelle mit Click-to-Expand auf MaInlineDetail)
 *
 * Die Admin-Sektionen (Kategorien, Import/Export, Konfig, Embedding-Corpus)
 * liegen seit v2.21 im eigenen Tab „Einstellungen" (EinstellungenView.tsx);
 * davor steckten sie im „Erweitert"-Aufklapper hier.
 *
 * Seit v2.17 ohne De-Anon-Passwort/Chip — echte Kürzel werden im pl/dev-Build
 * (passwortgeschützter App-Start, v2.16) direkt angezeigt.
 */
import { useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { useAuslastungReady } from '../hooks/useAuslastungReady';
import { SetupWizard } from './admin/SetupWizard';
import { SkeletonRows, SkeletonBar } from '../components/Skeleton';
import { StatistikSection } from './uebersicht/StatistikSection';
import { HeadlineInsight } from './uebersicht/HeadlineInsight';
import { KpiGrid } from './uebersicht/KpiGrid';
import { WarnungenZeile } from './uebersicht/WarnungenZeile';
import { MaListSection, type WarningFilter } from './uebersicht/MaListSection';

export function UebersichtView(): React.ReactElement {
  const storage = useStorage();
  const setupDone = useAuslastungData(s => s.data.config.setupAbgeschlossen);
  const quartal = useAuslastungData(s => s.data.config.aktuellesQuartal);
  const cache = useAntraegeCache();
  const { ready } = useAuslastungReady();
  const [warningFilter, setWarningFilter] = useState<WarningFilter>(null);

  const handleWarningFilter = (filter: 'no-bookings' | 'overbooked'): void => {
    setWarningFilter(prev => prev === filter ? null : filter);
    // Sanftes Scrollen zur MA-Liste, damit der User die Wirkung des Filters sieht.
    requestAnimationFrame(() => {
      document.getElementById('ma-list-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  if (setupDone && !ready) {
    // Volles Skeleton-Layout statt nur Text — User sieht sofort,
    // dass die Tabelle/Panels im Aufbau sind, nicht leer.
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-[12px] p-3" style={{ border: '0.5px solid var(--tf-border)' }}>
          <SkeletonBar width="40%" height={14} />
        </div>
        <div className="rounded-[12px] py-3 px-4" style={{ border: '0.5px solid var(--tf-border)' }}>
          <SkeletonBar width="60%" height={14} />
        </div>
        <div className="rounded-[12px] p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
          <div className="mb-3">
            <SkeletonBar width="30%" height={14} />
          </div>
          <SkeletonRows count={8} columns={[60, 90, 140, 120, 80, 90]} rowHeight={48} />
        </div>
      </div>
    );
  }

  if (!setupDone) {
    return (
      <SetupWizard
        storage={storage}
        antraege={cache.antraege}
        anonymMap={cache.anonymMap}
        allDeskriptoren={cache.allDeskriptoren}
        profilesByAnon={cache.historischeDeskriptorenByAnon}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StatistikSection label="Statistik-Übersicht" count={quartal}>
        <div className="flex flex-col gap-4">
          <HeadlineInsight />
          <KpiGrid />
          <WarnungenZeile onFilter={handleWarningFilter} />
        </div>
      </StatistikSection>
      <MaListSection
        storage={storage}
        cache={cache}
        warningFilter={warningFilter}
        onClearWarningFilter={() => setWarningFilter(null)}
      />
    </div>
  );
}
