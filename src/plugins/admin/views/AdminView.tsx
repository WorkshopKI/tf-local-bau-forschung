import { useState } from 'react';
import { Button } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { DirectoriesStep } from '../steps/DirectoriesStep';
import { DocumentsStep } from '../steps/DocumentsStep';
import { IndexStep } from '../steps/IndexStep';
import { EvalSection } from '../eval/EvalSection';
import { MetadataSmokeTest } from '../MetadataSmokeTest';
import { seedTestData, clearSeedData } from '@/core/services/seed/seed-data';

interface AdminViewProps {
  chunkCount: number;
  docCount: number;
  activeModelId: string;
  seeded: boolean;
  seeding: boolean;
  seedProgress: string;
  indexOutdated: boolean;
  hasGPU: boolean;
  setDocCount: (n: number) => void;
  setChunkCount: (n: number) => void;
  setLastUpdate: (s: string | null) => void;
  setActiveModelIdState: (id: string) => void;
  setIndexModelId: (s: string | null) => void;
  setSeeded: (v: boolean) => void;
  setSeeding: (v: boolean) => void;
  setSeedProgress: (v: string) => void;
  setNewDocsCount: (n: number) => void;
}

/* ── Pipeline step header with numbered circle + connector line ── */
function StepHeader({ step, title, subtitle }: {
  step: number; title: string; subtitle?: string;
}): React.ReactElement {
  return (
    <>
      {step > 1 && (
        <div className="ml-[10px] h-4" style={{ borderLeft: '0.5px solid var(--tf-border)' }} />
      )}
      <div className="flex items-center gap-2 mb-2">
        <span className="w-[22px] h-[22px] rounded-full bg-[var(--tf-bg-secondary)] flex items-center justify-center text-[11px] font-medium text-[var(--tf-text-secondary)] shrink-0">
          {step}
        </span>
        <span className="text-[13px] font-medium text-[var(--tf-text)] flex-1">{title}</span>
        {subtitle && <span className="text-[11px] text-[var(--tf-text-secondary)]">{subtitle}</span>}
      </div>
    </>
  );
}

/* ── Normal section header for non-pipeline areas ── */
function SectionTitle({ title, subtitle }: {
  title: string; subtitle?: string;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between mb-2 pb-1.5"
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <span className="text-[13px] font-medium text-[var(--tf-text)]">{title}</span>
      {subtitle && <span className="text-[11px] text-[var(--tf-text-secondary)]">{subtitle}</span>}
    </div>
  );
}

export function AdminView({
  chunkCount, docCount, activeModelId,
  seeded, seeding, seedProgress, indexOutdated, hasGPU,
  setDocCount, setChunkCount, setLastUpdate, setActiveModelIdState,
  setIndexModelId, setSeeded, setSeeding, setSeedProgress, setNewDocsCount,
}: AdminViewProps): React.ReactElement {
  const storage = useStorage();
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);

  const directories = storage.getDirectories();
  const dirSubtitle = directories.length > 0
    ? `${directories.length} verbunden` : 'Nicht verbunden';
  const docSubtitle = docCount > 0 ? `${docCount} Dokumente` : 'Keine Dokumente';
  const indexSubtitle = chunkCount > 0 ? `${chunkCount} Chunks` : 'Nicht indexiert';
  const seedSubtitle = seeded ? '40 Vorgänge · 60 Dokumente' : 'Nicht vorhanden';

  const handleClearDocStore = async (): Promise<void> => {
    setClearing(true); setClearResult(null);
    try {
      const keys = await storage.idb.keys('doc:');
      for (const key of keys) await storage.idb.delete(key);
      for (const key of ['doc-file-hashes', 'doc-chunk-counts', 'index-manifest', 'orama-db',
        'index-chunk-count', 'index-last-update', 'index-model-id', 'seed-complete']) {
        await storage.idb.delete(key);
      }
      setDocCount(0); setChunkCount(0); setLastUpdate(null);
      setIndexModelId(null); setNewDocsCount(0); setSeeded(false);
      setClearResult(`${keys.length} Dokumente und Index gelöscht.`);
    } catch (err) { setClearResult(`Fehler: ${err}`); }
    finally { setClearing(false); }
  };

  const handleClearSeedData = async (): Promise<void> => {
    await clearSeedData(storage);
    setSeeded(false); setDocCount(0); setSeedProgress('Gelöscht');
  };

  const handleSeed = async (): Promise<void> => {
    setSeeding(true); setSeedProgress('Erzeuge...');
    try {
      const r = await seedTestData(storage, (c, t) => setSeedProgress(`Erzeuge... (${c}/${t})`));
      setSeedProgress(`${r.vorgaenge} Vorgänge, ${r.dokumente} Dokumente, ${r.artefakte} Artefakte`);
      setSeeded(true);
      storage.idb.keys('doc:').then(k => setDocCount(k.length));
    } catch (err) { setSeedProgress(`Fehler: ${err}`); }
    finally { setSeeding(false); }
  };

  return (
    <div>
      {/* ── Pipeline Step 1: Verzeichnisse ── */}
      <div className="py-4" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
        <StepHeader step={1} title="Verzeichnisse" subtitle={dirSubtitle} />
        <div className="ml-[30px]">
          <DirectoriesStep />
        </div>
      </div>

      {/* ── Pipeline Step 2: Dokumente ── */}
      <div className="py-4" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
        <StepHeader step={2} title="Dokumente" subtitle={docSubtitle} />
        <div className="ml-[30px]">
          <DocumentsStep docCount={docCount} setDocCount={setDocCount} />
        </div>
      </div>

      {/* ── Pipeline Step 3: Suchindex ── */}
      <div className="py-4" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
        <StepHeader step={3} title="Suchindex" subtitle={indexSubtitle} />
        <div className="ml-[30px]">
          <IndexStep
            activeModelId={activeModelId} setActiveModelIdState={setActiveModelIdState}
            setIndexModelId={setIndexModelId}
            setChunkCount={setChunkCount}
            docCount={docCount} setLastUpdate={setLastUpdate}
            indexOutdated={indexOutdated} setNewDocsCount={setNewDocsCount}
            hasGPU={hasGPU}
          />
        </div>
      </div>

      {/* ── Qualitätscheck (normal header) ── */}
      <div className="py-4" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
        <SectionTitle title="Qualitätscheck" />
        <EvalSection chunkCount={chunkCount} modelId={activeModelId} />
      </div>

      {/* ── Metadata Smoke-Test ── */}
      <MetadataSmokeTest />

      {/* ── Testdaten (normal header) ── */}
      <div className="py-4" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
        <SectionTitle title="Testdaten" subtitle={seedSubtitle} />
        {seedProgress && <p className="text-[12px] text-[var(--tf-text-secondary)] mb-2">{seedProgress}</p>}
        {!seeded ? (
          <Button variant="secondary" size="sm" disabled={seeding} onClick={handleSeed}>
            {seeding ? 'Erzeuge...' : 'Testdaten generieren'}
          </Button>
        ) : (
          <p className="text-[11px] text-[var(--tf-text-tertiary)]">
            Testdaten vorhanden. Löschen über &quot;Daten zurücksetzen&quot; am Seitenende.
          </p>
        )}
      </div>

      {/* ── Daten zurücksetzen (normal header, bottom) ── */}
      <div className="py-4">
        <SectionTitle title="Daten zurücksetzen" />
        <p className="text-[11px] text-[var(--tf-text-tertiary)] mb-2">
          Löscht lokale Daten aus dem Browser-Speicher. Dateien auf dem Server bleiben erhalten.
        </p>
        <div className="flex gap-2">
          <Button variant="danger" size="sm" loading={clearing} onClick={handleClearDocStore}>
            Dokument-Store löschen
          </Button>
          {seeded && (
            <Button variant="danger" size="sm" onClick={handleClearSeedData}>
              Testdaten löschen
            </Button>
          )}
        </div>
        {clearResult && <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-2">{clearResult}</p>}
      </div>
    </div>
  );
}
