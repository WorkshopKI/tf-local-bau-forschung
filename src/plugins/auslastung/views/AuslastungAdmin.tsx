/**
 * Screen 3 — Admin / Konfiguration.
 *
 * Aufbau:
 *  - Setup-Wizard (zwingend bei !setupAbgeschlossen)
 *  - Konfiguration (Stunden/Quartal/Gewichtung)
 *  - Ueberkategorien (CRUD + Mapping)
 *  - Embedding-Corpus (Stufe 2)
 *  - Mitarbeiter (CRUD)
 */
import { useStorage } from '@/core/hooks/useStorage';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { SetupWizard } from './admin/SetupWizard';
import { KonfigurationSection } from './admin/KonfigurationSection';
import { KategorienSection } from './admin/KategorienSection';
import { EmbeddingCorpusSection } from './admin/EmbeddingCorpusSection';
import { MitarbeiterSection } from './admin/MitarbeiterSection';

export function AuslastungAdmin(): React.ReactElement {
  const storage = useStorage();
  const setupDone = useAuslastungData(s => s.data.config.setupAbgeschlossen);
  const cache = useAntraegeCache();

  return (
    <div className="flex flex-col gap-4">
      {!setupDone && (
        <SetupWizard
          storage={storage}
          antraege={cache.antraege}
          anonymMap={cache.anonymMap}
          allDeskriptoren={cache.allDeskriptoren}
        />
      )}
      {setupDone && (
        <>
          <KonfigurationSection storage={storage} />
          <KategorienSection storage={storage} allDeskriptoren={cache.allDeskriptoren} />
          <EmbeddingCorpusSection storage={storage} antraege={cache.antraege} />
          <MitarbeiterSection storage={storage} />
        </>
      )}
    </div>
  );
}
