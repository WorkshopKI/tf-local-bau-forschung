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
import { ImportExportSection } from './admin/ImportExportSection';

export function AuslastungAdmin(): React.ReactElement {
  const storage = useStorage();
  const setupDone = useAuslastungData(s => s.data.config.setupAbgeschlossen);
  const cache = useAntraegeCache();

  // Solange die Antraege noch nicht geladen sind: nichts rendern.
  // Verhindert Layout-Flash, bei dem Sections mit leerem cache erst klein
  // sind (z.B. "0 von 0 eingebettet") und dann nachtraeglich wachsen sobald
  // die echten 13k Antraege ankommen.
  if (setupDone && !cache.loaded) {
    return (
      <div className="rounded-[12px] p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">Lade Anträge…</p>
      </div>
    );
  }

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
          <ImportExportSection antraege={cache.antraege} />
          <MitarbeiterSection storage={storage} cache={cache} />
        </>
      )}
    </div>
  );
}
