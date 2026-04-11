import { useState } from 'react';
import { Button } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { usePipelineConfig } from '../hooks/usePipelineConfig';
import { ActionCardIndex } from '../actions/ActionCardIndex';
import { ActionCardQuality } from '../actions/ActionCardQuality';
import { ActionCardDocuments } from '../actions/ActionCardDocuments';
import { ActionCardGPU } from '../actions/ActionCardGPU';
import { ConfigSection } from '../sections/ConfigSection';
import { EvalSection } from '../eval/EvalSection';
import { MetadataSmokeTest } from '../MetadataSmokeTest';
import { seedTestData, clearSeedData } from '@/core/services/seed/seed-data';

function SectionTitle({ title, subtitle }: {
  title: string; subtitle?: string;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between mb-2 pb-1.5"
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text)]">{title}</span>
      {subtitle && <span className="text-[11px] text-[var(--tf-text-secondary)]">{subtitle}</span>}
    </div>
  );
}

interface AdminViewProps {
  chunkCount: number;
  docCount: number;
  activeModelId: string;
  seeded: boolean;
  seeding: boolean;
  seedProgress: string;
  indexOutdated: boolean;
  hasGPU: boolean;
  qualityPct: number | null;
  newDocsCount: number;
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

export function AdminView({
  chunkCount, docCount, activeModelId,
  seeded, seeding, seedProgress, indexOutdated, hasGPU, qualityPct, newDocsCount,
  setDocCount, setChunkCount, setLastUpdate, setActiveModelIdState,
  setIndexModelId, setSeeded, setSeeding, setSeedProgress, setNewDocsCount,
}: AdminViewProps): React.ReactElement {
  const storage = useStorage();
  const { config, updateConfig } = usePipelineConfig(storage.idb);
  const [resultPanel, setResultPanel] = useState<'eval' | 'smoke-test' | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);

  const seedSubtitle = seeded ? '40 Vorgaenge · 60 Dokumente' : 'Nicht vorhanden';

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
      setClearResult(`${keys.length} Dokumente und Index geloescht.`);
    } catch (err) { setClearResult(`Fehler: ${err}`); }
    finally { setClearing(false); }
  };

  const handleClearSeedData = async (): Promise<void> => {
    await clearSeedData(storage);
    setSeeded(false); setDocCount(0); setSeedProgress('Geloescht');
  };

  const handleSeed = async (): Promise<void> => {
    setSeeding(true); setSeedProgress('Erzeuge...');
    try {
      const r = await seedTestData(storage, (c, t) => setSeedProgress(`Erzeuge... (${c}/${t})`));
      setSeedProgress(`${r.vorgaenge} Vorgaenge, ${r.dokumente} Dokumente, ${r.artefakte} Artefakte`);
      setSeeded(true);
      storage.idb.keys('doc:').then(k => setDocCount(k.length));
    } catch (err) { setSeedProgress(`Fehler: ${err}`); }
    finally { setSeeding(false); }
  };

  return (
    <div className="space-y-6">
      {/* ── AKTIONEN ── */}
      <div>
        <SectionTitle title="Aktionen" />
        <div className="grid grid-cols-2 gap-3">
          <ActionCardIndex
            chunkCount={chunkCount} docCount={docCount} activeModelId={activeModelId}
            indexOutdated={indexOutdated} hasGPU={hasGPU} newDocsCount={newDocsCount}
            pipelineConfig={config}
            setChunkCount={setChunkCount} setLastUpdate={setLastUpdate}
            setIndexModelId={setIndexModelId} setNewDocsCount={setNewDocsCount}
          />
          <ActionCardQuality
            qualityPct={qualityPct}
            hasMetadataLLM={config.metadataLLMId !== 'none'}
            onStartEval={() => setResultPanel(resultPanel === 'eval' ? null : 'eval')}
            onStartSmokeTest={() => setResultPanel(resultPanel === 'smoke-test' ? null : 'smoke-test')}
          />
          <ActionCardDocuments docCount={docCount} setDocCount={setDocCount} />
          <ActionCardGPU />
        </div>
      </div>

      {/* ── ERGEBNISSE (conditional) ── */}
      {resultPanel === 'eval' && (
        <div className="py-4" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          <EvalSection chunkCount={chunkCount} modelId={activeModelId} />
        </div>
      )}
      {resultPanel === 'smoke-test' && (
        <div className="py-4" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          <MetadataSmokeTest />
        </div>
      )}

      {/* ── KONFIGURATION ── */}
      <div>
        <SectionTitle title="Konfiguration" />
        <ConfigSection
          config={config} updateConfig={updateConfig}
          activeModelId={activeModelId} setActiveModelIdState={setActiveModelIdState}
          hasGPU={hasGPU}
        />
      </div>

      {/* ── TESTDATEN ── */}
      <div>
        <SectionTitle title="Testdaten" subtitle={seedSubtitle} />
        {seedProgress && <p className="text-[12px] text-[var(--tf-text-secondary)] mb-2">{seedProgress}</p>}
        {!seeded ? (
          <Button variant="secondary" size="sm" disabled={seeding} onClick={handleSeed}>
            {seeding ? 'Erzeuge...' : 'Testdaten generieren'}
          </Button>
        ) : (
          <p className="text-[11px] text-[var(--tf-text-tertiary)]">
            Testdaten vorhanden. Loeschen ueber &quot;Daten zuruecksetzen&quot; am Seitenende.
          </p>
        )}
      </div>

      {/* ── DATEN ZURÜCKSETZEN ── */}
      <div>
        <SectionTitle title="Daten zuruecksetzen" />
        <p className="text-[11px] text-[var(--tf-text-tertiary)] mb-2">
          Loescht lokale Daten aus dem Browser-Speicher. Dateien auf dem Server bleiben erhalten.
        </p>
        <div className="flex gap-2">
          <Button variant="danger" size="sm" loading={clearing} onClick={handleClearDocStore}>
            Dokument-Store loeschen
          </Button>
          {seeded && (
            <Button variant="danger" size="sm" onClick={handleClearSeedData}>
              Testdaten loeschen
            </Button>
          )}
        </div>
        {clearResult && <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-2">{clearResult}</p>}
      </div>
    </div>
  );
}
