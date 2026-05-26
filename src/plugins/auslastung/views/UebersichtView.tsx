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
import { SetupWizard } from './admin/SetupWizard';
import { KonfigurationSection } from './admin/KonfigurationSection';
import { KategorienSection } from './admin/KategorienSection';
import { EmbeddingCorpusSection } from './admin/EmbeddingCorpusSection';
import { ImportExportSection } from './admin/ImportExportSection';
import { StatistikPanel } from './StatistikPanel';
import { MitarbeiterUndKapazitaet } from './MitarbeiterUndKapazitaet';
import { DeAnonPanel } from '../components/DeAnonPanel';
import { isDeAnonymisierungEnabled } from '@/config/feature-flags';

export function UebersichtView(): React.ReactElement {
  const storage = useStorage();
  const setupDone = useAuslastungData(s => s.data.config.setupAbgeschlossen);
  const cache = useAntraegeCache();
  const [erweitertOpen, setErweitertOpen] = useState(false);

  if (setupDone && !cache.loaded) {
    return (
      <div className="rounded-[12px] p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">Lade Anträge…</p>
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
      {isDeAnonymisierungEnabled() && <DeAnonPanel />}
      <div className="rounded-[12px]" style={{ border: '0.5px solid var(--tf-border)' }}>
        <div className="px-4">
          <StatistikPanel />
        </div>
      </div>
      <MitarbeiterUndKapazitaet storage={storage} cache={cache} />
      <KategorienSection storage={storage} allDeskriptoren={cache.allDeskriptoren} />
      <ImportExportSection antraege={cache.antraege} />

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
