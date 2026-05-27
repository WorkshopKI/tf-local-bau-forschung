/**
 * UebersichtView (v2.6) — Tab "Übersicht" des Auslastungs-Moduls.
 *
 * Konsolidierte Sicht: DeAnon-Panel (gated) + Statistik-Panel (collapsible) +
 * Mitarbeiter-&-Kapazität-Tabelle (zwei-Zeilen-Layout mit Inline-Expand) +
 * Überkategorien-Verwaltung + Import/Export + Erweitert-Aufklapper.
 *
 * v2.6 ersetzt die fruehere Aufteilung in zwei MA-Listen (KapazitaetsSection
 * + MitarbeiterSection) durch eine einzelne `MitarbeiterUndKapazitaet`.
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
import { MitarbeiterUndKapazitaet } from './MitarbeiterUndKapazitaet';
import { SkeletonRows, SkeletonBar } from '../components/Skeleton';
import { StatistikSection } from './uebersicht/StatistikSection';
import { HeadlineInsight } from './uebersicht/HeadlineInsight';
import { KpiGrid } from './uebersicht/KpiGrid';
import { WarnungenZeile } from './uebersicht/WarnungenZeile';

export function UebersichtView(): React.ReactElement {
  const storage = useStorage();
  const setupDone = useAuslastungData(s => s.data.config.setupAbgeschlossen);
  const quartal = useAuslastungData(s => s.data.config.aktuellesQuartal);
  const cache = useAntraegeCache();
  const { ready } = useAuslastungReady();
  const [erweitertOpen, setErweitertOpen] = useState(false);

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
          <WarnungenZeile />
        </div>
      </StatistikSection>
      <MitarbeiterUndKapazitaet storage={storage} cache={cache} />
      <KategorienSection storage={storage} allDeskriptoren={cache.allDeskriptoren} />
      <ImportExportSection antraege={cache.antraege} anonymMap={cache.anonymMap} />

      {/* Erweitert-Aufklapper — selten geaenderte Konfig */}
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
          <div className="border-t px-4 pt-3 pb-4 flex flex-col gap-4" style={{ borderColor: 'var(--tf-border)' }}>
            <KonfigurationSection storage={storage} />
            <EmbeddingCorpusSection storage={storage} antraege={cache.antraege} />
          </div>
        )}
      </div>
    </div>
  );
}
