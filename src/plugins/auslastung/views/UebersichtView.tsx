/**
 * UebersichtView (v2.14) — Tab "Übersicht" des Auslastungs-Moduls.
 *
 * Redesign nach Claude-Design-Tool-Handoff (`_design/handoff/auslastung/`):
 *   - StatistikSection (collapsible) mit HeadlineInsight + KpiGrid + WarnungenZeile
 *   - MaListSection (kompakte Tabelle mit Click-to-Expand auf MaInlineDetail)
 *   - Admin-Sektionen (Kategorien, Import/Export, Konfig, Embedding-Corpus) im
 *     Erweitert-Aufklapper
 *
 * Seit v2.17 ohne De-Anon-Passwort/Chip — echte Kürzel werden im pl/dev-Build
 * (passwortgeschützter App-Start, v2.16) direkt angezeigt.
 */
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
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
       *  Konfiguration, Embedding-Corpus). Default geschlossen. Gleicher Klapp-
       *  Stil wie StatistikSection / MaListSection: Chevron links + Caps-Label +
       *  Hairline in einer Bordered-Card. */}
      <section
        className="rounded-[12px] p-4 flex flex-col gap-3"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <button
          type="button"
          onClick={() => setErweitertOpen(o => !o)}
          aria-expanded={erweitertOpen}
          className="flex items-center gap-2 w-full cursor-pointer text-left select-none"
        >
          <ChevronRight
            size={14}
            className="text-[var(--tf-text-tertiary)] shrink-0"
            style={{
              transform: erweitertOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform var(--tf-duration-med) var(--tf-ease)',
            }}
          />
          <span
            className="uppercase text-[var(--tf-text-tertiary)] shrink-0"
            style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: 'var(--tf-tracking-caps)', lineHeight: 1 }}
          >
            Erweitert
          </span>
          <span aria-hidden className="flex-1" style={{ height: '0.5px', background: 'var(--tf-border)' }} />
        </button>
        {erweitertOpen && (
          <div className="flex flex-col">
            <KategorienSection storage={storage} allDeskriptoren={cache.allDeskriptoren} />
            <div className="my-4" style={{ borderTop: '0.5px solid var(--tf-border)' }} />
            <ImportExportSection antraege={cache.antraege} />
            <div className="my-4" style={{ borderTop: '0.5px solid var(--tf-border)' }} />
            <KonfigurationSection storage={storage} />
            <div className="my-4" style={{ borderTop: '0.5px solid var(--tf-border)' }} />
            <EmbeddingCorpusSection storage={storage} antraege={cache.antraege} />
          </div>
        )}
      </section>
    </div>
  );
}
