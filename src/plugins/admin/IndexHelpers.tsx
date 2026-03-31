import { useRef } from 'react';
import { Database, Trash2 } from 'lucide-react';
import { Button, Badge, ProgressBar } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import type { IndexStatus } from '@/core/services/search/batch-indexer';
import { seedTestData, clearSeedData } from '@/core/services/seed/seed-data';

export function SeedContent({ storage, seeded, seeding, seedProgress, setSeeded, setSeeding, setSeedProgress, setDocCount }: {
  storage: ReturnType<typeof useStorage>; seeded: boolean; seeding: boolean; seedProgress: string;
  setSeeded: (v: boolean) => void; setSeeding: (v: boolean) => void;
  setSeedProgress: (v: string) => void; setDocCount: (v: number) => void;
}): React.ReactElement {
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-[var(--tf-text-secondary)]">
        Erzeugt 40 Vorgaenge, 60 Dokumente und 10 Artefakte mit realistischem Inhalt.
      </p>
      {seedProgress && <p className="text-[12px] text-[var(--tf-text-secondary)]">{seedProgress}</p>}
      <div className="flex gap-3">
        <Button variant="secondary" icon={Database} disabled={seeding || seeded}
          onClick={async () => {
            setSeeding(true); setSeedProgress('Erzeuge...');
            try {
              const r = await seedTestData(storage, (c, t) => setSeedProgress(`Erzeuge... (${c}/${t})`));
              setSeedProgress(`${r.vorgaenge} Vorgaenge, ${r.dokumente} Dokumente, ${r.artefakte} Artefakte`);
              setSeeded(true); storage.idb.keys('doc:').then(k => setDocCount(k.length));
            } catch (err) { setSeedProgress(`Fehler: ${err}`); }
            finally { setSeeding(false); }
          }}>
          {seeded ? 'Testdaten vorhanden' : seeding ? 'Erzeuge...' : 'Testdaten generieren'}
        </Button>
        {seeded && (
          <Button variant="danger" icon={Trash2} disabled={seeding}
            onClick={async () => {
              await clearSeedData(storage); setSeeded(false); setDocCount(0); setSeedProgress('Geloescht');
            }}>Testdaten loeschen</Button>
        )}
      </div>
    </div>
  );
}

export function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--tf-text-tertiary)]">{label}</span>
      <span className="text-[var(--tf-text)]">{value}</span>
    </div>
  );
}

export function IndexProgress({ status, running }: { status: IndexStatus | null; running: boolean }): React.ReactElement | null {
  const lastChunkRef = useRef('');
  if (!running || !status) return null;
  const isModelLoading = status.phase === 'Modell laden';
  const docProgress = status.total > 0 ? status.processed / status.total : 0;
  if (status.phase === 'Embedding' && status.chunkProgress) {
    lastChunkRef.current = `Textabschnitt ${status.chunkProgress.current} von ${status.chunkProgress.total}`;
  }

  if (isModelLoading) {
    const modelPct = status.modelProgress?.loaded && status.modelProgress?.total
      ? status.modelProgress.loaded / status.modelProgress.total : 0;
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-[12px] text-[var(--tf-text-secondary)]">
          <span>Modell laden...</span>
          {status.modelProgress?.status && <Badge variant="default">{status.modelProgress.status}</Badge>}
        </div>
        <ProgressBar value={modelPct} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[12px] text-[var(--tf-text-secondary)]">
        <span>Dokument {status.processed + 1}/{status.total} — {status.currentDoc}</span>
        <span>{Math.round(docProgress * 100)}%</span>
      </div>
      <ProgressBar value={docProgress} />
      <p className="text-[11px] text-[var(--tf-text-tertiary)] h-4">
        {lastChunkRef.current || '\u00a0'}
      </p>
    </div>
  );
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes === 0) return `${secs}s`;
  return `${minutes}:${String(secs).padStart(2, '0')} min`;
}
