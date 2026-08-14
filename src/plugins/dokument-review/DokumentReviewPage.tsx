/**
 * Top-Level-Layout der Review-Queue-Seite. Steckt Dashboard, Filter, Liste,
 * Detail-Panel, Keyboard-Handler und Toast in einem grid grid-cols-2 Split
 * zusammen. Selektion + Filter-State liegen im Zustand-Store, Daten in
 * Hooks (useManifestData, useAntraegeIndex).
 */
import { useEffect } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useDokumentReviewStore } from './store';
import { useManifestData } from './hooks/useManifestData';
import { useAntraegeIndex } from './hooks/useAntraegeIndex';
import { DashboardCard } from './components/DashboardCard';
import { AutoCleanupCard } from './components/AutoCleanupCard';
import { FilterBar } from './components/FilterBar';
import { ManifestList } from './components/ManifestList';
import { DetailPanel } from './components/DetailPanel';
import { PendingList } from './components/PendingList';
import { KeyboardHandler } from './components/KeyboardHandler';
import { ReviewToast } from './components/ReviewToast';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';

export function DokumentReviewPage(): React.ReactElement {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const viewMode = useDokumentReviewStore(s => s.viewMode);

  const manifest = useManifestData();
  const antraegeIndex = useAntraegeIndex();

  useEffect(() => {
    void manifest.load();
  }, [manifest.load, storage]);

  useEffect(() => {
    if (activeProgrammId) {
      void antraegeIndex.load(activeProgrammId);
    }
  }, [activeProgrammId, antraegeIndex.load]);

  return (
    <div className="flex flex-col gap-4 px-8 pt-4 pb-6">
      {/* Derselbe Seitenkopf wie der Kuration-Hub daneben (Titel links,
          Hilfe-Knopf am rechten Blattrand). Bis v4.39 stand hier nur der
          Knopf, ohne Titel: die Seite sagte als einzige der Gruppe nicht,
          wo man ist. */}
      <div className="flex items-center gap-3">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Dokument-Review</h1>
        <div className="ml-auto shrink-0"><SeitenHilfeButton pluginId="dokument-review" /></div>
      </div>
      <DashboardCard
        entries={manifest.entries}
        pending={manifest.pending}
        onRematch={async () => {
          if (!activeProgrammId) return;
          const result = await manifest.rematchPending(activeProgrammId);
          return result;
        }}
      />
      <AutoCleanupCard entries={manifest.entries} onAfter={manifest.load} />
      <FilterBar entries={manifest.entries} />
      <div className="grid grid-cols-2 gap-4 min-h-[600px]">
        {viewMode === 'pending' ? (
          <PendingList
            pending={manifest.pending}
            entries={manifest.entries}
            antraege={antraegeIndex.antraege}
            onRefresh={manifest.load}
            onReloadEntry={manifest.reloadEntry}
          />
        ) : (
          <ManifestList entries={manifest.entries} loading={manifest.loading} />
        )}
        <DetailPanel
          entries={manifest.entries}
          antraege={antraegeIndex.antraege}
          onReloadEntry={manifest.reloadEntry}
          onRemoveEntry={manifest.removeEntry}
        />
      </div>
      <KeyboardHandler
        entries={manifest.entries}
        onReloadEntry={manifest.reloadEntry}
        onRemoveEntry={manifest.removeEntry}
      />
      <ReviewToast />
    </div>
  );
}
