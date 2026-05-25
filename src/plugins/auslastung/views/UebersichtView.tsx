/**
 * UebersichtView — fusioniert ehemalige Tabs "Kapazitaet" + "Admin" (1.17).
 *
 * Drei thematische Bloecke + ein Aufklapper "Erweitert" fuer selten geaenderte
 * Konfiguration:
 *
 *  1. **Kapazitaet** — MA-Liste mit Balken (Antraege statt Stunden), klick auf
 *     MA oeffnet das Bearbeiten-Flyout aus der MA-Verwaltung.
 *  2. **Ueberkategorien** — Liste der UeberKategorien + Deskriptoren-Mapping.
 *  3. **Mitarbeiter** — Detail-Verwaltung (CRUD, Onboarding, Kalibrierung).
 *  4. **Import/Export** — XLSX-Import, Vorlage, Onboarding-HTML, Export.
 *  5. **Erweitert ▾** — Stunden/TV, durchschnittTV, Frist-Tage, Embedding-
 *     Corpus, Cache leeren.
 *
 * Setup-Wizard zwingend wenn `setupAbgeschlossen=false`.
 */
import { useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { SetupWizard } from './admin/SetupWizard';
import { KonfigurationSection } from './admin/KonfigurationSection';
import { KategorienSection } from './admin/KategorienSection';
import { EmbeddingCorpusSection } from './admin/EmbeddingCorpusSection';
import { MitarbeiterSection } from './admin/MitarbeiterSection';
import { ImportExportSection } from './admin/ImportExportSection';
import { KapazitaetsSection } from './KapazitaetsSection';

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
      <KapazitaetsSection />
      <KategorienSection storage={storage} allDeskriptoren={cache.allDeskriptoren} />
      <MitarbeiterSection storage={storage} cache={cache} />
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
