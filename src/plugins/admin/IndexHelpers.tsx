import { useEffect, useRef, useState } from 'react';
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

function computeETA(elapsed: number, processed: number, total: number): string | null {
  if (processed < 3 || total <= 0) return null;
  const remaining = (elapsed / processed) * (total - processed);
  return `~${formatDuration(remaining)} verbleibend`;
}

function phaseLabel(phase: string): string {
  if (phase.startsWith('Metadata')) return phase;
  if (phase === 'Chunking (contextual)' || phase === 'Chunking') return 'Chunking';
  if (phase === 'Embedding') return 'Embedding';
  if (phase === 'Scanning' || phase === 'Prüfe Index...') return phase;
  if (phase === 'Done') return 'Speichern';
  return phase;
}

export function IndexProgress({ status, running }: { status: IndexStatus | null; running: boolean }): React.ReactElement | null {
  const lastChunkRef = useRef('');
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!running || !status) return null;
  const isModelLoading = status.phase === 'Modell laden';
  const docProgress = status.total > 0 ? status.processed / status.total : 0;
  if (status.phase === 'Embedding' && status.chunkProgress) {
    lastChunkRef.current = `Textabschnitt ${status.chunkProgress.current} von ${status.chunkProgress.total}`;
  }

  const elapsedLabel = formatDuration(elapsed);
  const eta = computeETA(elapsed, status.processed, status.total);

  if (isModelLoading) {
    const modelPct = status.modelProgress?.loaded && status.modelProgress?.total
      ? status.modelProgress.loaded / status.modelProgress.total : 0;
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-[12px] text-[var(--tf-text-secondary)]">
          <span>Modell laden...</span>
          <span className="flex items-center gap-2">
            <span className="font-mono">{elapsedLabel}</span>
            {status.modelProgress?.status && <Badge variant="default">{status.modelProgress.status}</Badge>}
          </span>
        </div>
        <ProgressBar value={modelPct} />
      </div>
    );
  }

  const subStatus = status.phase === 'Embedding' && lastChunkRef.current
    ? `${phaseLabel(status.phase)} — ${lastChunkRef.current}`
    : phaseLabel(status.phase);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[12px] text-[var(--tf-text-secondary)]">
        <span>Dokument {Math.min(status.processed + 1, status.total)}/{status.total} — {status.currentDoc}</span>
        <span className="flex items-center gap-2">
          <span className="font-mono">{elapsedLabel}</span>
          <span>{Math.round(docProgress * 100)}%</span>
        </span>
      </div>
      <ProgressBar value={docProgress} />
      <div className="flex justify-between text-[11px] h-4">
        <span className="text-[var(--tf-text-tertiary)]">{subStatus || '\u00a0'}</span>
        {eta && <span className="text-[var(--tf-text-tertiary)] font-mono">{eta}</span>}
      </div>
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
