/**
 * UebersichtView (v2.14) — Tab "Übersicht" des Auslastungs-Moduls.
 *
 * Redesign nach Claude-Design-Tool-Handoff (`_design/handoff/auslastung/`):
 *   - StatistikSection (collapsible) mit HeadlineInsight + KpiGrid + WarnungenZeile
 *   - MaListSection (kompakte Tabelle mit Click-to-Expand auf MaInlineDetail)
 *   - Admin-Sektionen (Kategorien, Import/Export, Konfig, Embedding-Corpus) im
 *     Erweitert-Aufklapper
 *
 * Privacy/Klartext-Modus lebt jetzt im Page-Header von AuslastungView
 * (PrivacyChip + PrivacyPopover) — kein Banner mehr in der Übersicht.
 */
import { useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { useAuslastungReady } from '../hooks/useAuslastungReady';
import { SetupWizard } from './admin/SetupWizard';
import { KonfigurationSection } from './admin/KonfigurationSection';
import { KategorienSection } from './admin/KategorienSection';
import { EmbeddingCorpusSection } from './admin/EmbeddingCorpusSection';
import { ImportExportSection } from './admin/ImportExportSection';
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
  const [erweitertOpen, setErweitertOpen] = useState(false);
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

      {/* Erweitert-Aufklapper — Admin-Konfiguration (Kategorien, Import/Export,
       *  Konfiguration, Embedding-Corpus). Default geschlossen, damit der
       *  Übersicht-Tab oberhalb auf die Story (Statistik + MA-Liste) reduziert
       *  ist. */}
      <div
        className="rounded-[12px]"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <button
          type="button"
          onClick={() => setErweitertOpen(o => !o)}
          className="w-full px-4 py-3 flex items-center justify-between cursor-pointer text-[13px] font-medium text-[var(--tf-text)]"
        >
          <span>Erweitert</span>
          <span aria-hidden className="text-[var(--tf-text-tertiary)]">
            {erweitertOpen ? '▾' : '▸'}
          </span>
        </button>
        {erweitertOpen && (
          <div className="border-t px-4 pt-4 pb-4 flex flex-col" style={{ borderColor: 'var(--tf-border)' }}>
            <KategorienSection storage={storage} allDeskriptoren={cache.allDeskriptoren} />
            <div className="my-4" style={{ borderTop: '0.5px solid var(--tf-border)' }} />
            <ImportExportSection antraege={cache.antraege} anonymMap={cache.anonymMap} />
            <div className="my-4" style={{ borderTop: '0.5px solid var(--tf-border)' }} />
            <KonfigurationSection storage={storage} />
            <div className="my-4" style={{ borderTop: '0.5px solid var(--tf-border)' }} />
            <EmbeddingCorpusSection storage={storage} antraege={cache.antraege} />
          </div>
        )}
      </div>
    </div>
  );
}
