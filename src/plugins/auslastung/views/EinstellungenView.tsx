/**
 * EinstellungenView — Tab „Einstellungen" des Auslastungs-Moduls (v2.21).
 *
 * Bündelt die Admin-/Konfigurations-Sektionen, die bis v2.20 im „Erweitert"-
 * Aufklapper des Tabs „Auslastung MA" versteckt waren: Kategorien, CSV-Import/
 * Export, Konfiguration und der Themen-Vektoren-(Embedding-)Korpus. Eigener Tab
 * am Ende der Tab-Leiste, damit die Einstellungen direkt auffindbar sind statt
 * im Statistik-Tab vergraben.
 *
 * Rendert nur, wenn AuslastungView `loaded` meldet (Tab-Gate + activeProgrammId-
 * Guard liegen dort) — eigene Guards sind daher nicht nötig. Die Sektionen
 * degradieren während des Antraege-Cache-Loads sauber (z.B. Corpus-Build mit
 * `total === 0` disabled), bis `useAntraegeCache` befüllt ist.
 *
 * v3.0: Der `korpusOnly`-Modus ist entfallen — er bediente ausschliesslich den
 * schlanken kurator-Korpus-View, und die kurator-Variante gibt es nicht mehr.
 */
import { useStorage } from '@/core/hooks/useStorage';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { KategorienSection } from './admin/KategorienSection';
import { ImportExportSection } from './admin/ImportExportSection';
import { KonfigurationSection } from './admin/KonfigurationSection';
import { EmbeddingCorpusSection } from './admin/EmbeddingCorpusSection';

export function EinstellungenView(): React.ReactElement {
  const storage = useStorage();
  const cache = useAntraegeCache();

  return (
    <div className="flex flex-col">
      <KategorienSection storage={storage} allDeskriptoren={cache.allDeskriptoren} />
      <div className="my-4" style={{ borderTop: '0.5px solid var(--tf-border)' }} />
      <ImportExportSection antraege={cache.antraege} />
      <div className="my-4" style={{ borderTop: '0.5px solid var(--tf-border)' }} />
      <KonfigurationSection storage={storage} />
      <div className="my-4" style={{ borderTop: '0.5px solid var(--tf-border)' }} />
      <EmbeddingCorpusSection storage={storage} antraege={cache.antraege} embeddableAz={cache.embeddableAz} />
    </div>
  );
}
