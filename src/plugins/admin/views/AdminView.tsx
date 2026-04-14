import { useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { usePipelineConfig } from '../hooks/usePipelineConfig';
import { ActionCardIndex } from '../actions/ActionCardIndex';
import { ActionCardQuality } from '../actions/ActionCardQuality';
import { ActionCardDocuments } from '../actions/ActionCardDocuments';
import { ActionCardModels } from '../actions/ActionCardModels';
import { ConfigSection } from '../sections/ConfigSection';
import { EvalSection } from '../eval/EvalSection';
import { MetadataSmokeTest } from '../MetadataSmokeTest';

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

  return (
    <div className="space-y-6">
      {/* ── AKTIONEN ── */}
      <div>
        <SectionTitle title="Aktionen" />
        <div className="grid grid-cols-2 gap-3">
          <ActionCardDocuments docCount={docCount} setDocCount={setDocCount} />
          <ActionCardIndex
            chunkCount={chunkCount} docCount={docCount} activeModelId={activeModelId}
            indexOutdated={indexOutdated} hasGPU={hasGPU} newDocsCount={newDocsCount}
            pipelineConfig={config}
            setChunkCount={setChunkCount} setLastUpdate={setLastUpdate}
            setIndexModelId={setIndexModelId} setNewDocsCount={setNewDocsCount}
          />
          <ActionCardModels
            activeModelId={activeModelId} setActiveModelIdState={setActiveModelIdState}
            config={config} updateConfig={updateConfig} hasGPU={hasGPU}
          />
          <ActionCardQuality
            qualityPct={qualityPct}
            hasMetadataLLM={config.metadataLLMId !== 'none'}
            onStartEval={() => setResultPanel(resultPanel === 'eval' ? null : 'eval')}
            onStartSmokeTest={() => setResultPanel(resultPanel === 'smoke-test' ? null : 'smoke-test')}
          />
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

      {/* ── KONFIGURATION (3 Gruppen: KI-Modelle, Suchqualitaet, Zuruecksetzen) ── */}
      <ConfigSection
        config={config} updateConfig={updateConfig}
        seeded={seeded} seeding={seeding} seedProgress={seedProgress}
        setSeeded={setSeeded} setSeeding={setSeeding} setSeedProgress={setSeedProgress}
        setDocCount={setDocCount} setChunkCount={setChunkCount} setLastUpdate={setLastUpdate}
        setIndexModelId={setIndexModelId} setNewDocsCount={setNewDocsCount}
      />
    </div>
  );
}
