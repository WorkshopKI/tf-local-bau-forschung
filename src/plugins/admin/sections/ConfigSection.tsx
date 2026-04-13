import { useState, useEffect } from 'react';
import { Button, Select } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import {
  EMBEDDING_MODELS, getModelById, setActiveModelId,
} from '@/core/services/search/model-registry';
import { METADATA_LLM_MODELS, clearMetadataCache } from '@/core/services/search/metadata-extractor';
import { RERANKER_MODELS } from '@/core/services/search/re-ranker'; // PHASE 2: Re-Ranker
import { useSearch } from '@/core/hooks/useSearch';
import { DirectoriesStep } from '../steps/DirectoriesStep';
import type { PipelineConfigState } from '../hooks/usePipelineConfig';
import type { AIProviderConfig } from '@/core/types/config';

interface ConfigSectionProps {
  config: PipelineConfigState;
  updateConfig: (patch: Partial<PipelineConfigState>) => void;
  activeModelId: string;
  setActiveModelIdState: (id: string) => void;
  hasGPU: boolean;
}

function ConfigRow({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <span className="text-[13px] text-[var(--tf-text)]">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function ConfigSection({
  config, updateConfig, activeModelId, setActiveModelIdState, hasGPU,
}: ConfigSectionProps): React.ReactElement {
  const storage = useStorage();
  const { toggleReRanker } = useSearch();
  const [hasApiKey, setHasApiKey] = useState(false);
  const [cacheMsg, setCacheMsg] = useState<string | null>(null);
  const activeModel = getModelById(activeModelId);
  const selectedMetadata = METADATA_LLM_MODELS.find(m => m.id === config.metadataLLMId);

  useEffect(() => {
    storage.idb.get<AIProviderConfig>('ai-provider').then(c => setHasApiKey(!!c?.apiKey));
  }, [storage]);

  return (
    <div>
      <ConfigRow label="Embedding-Modell">
        <Select
          options={EMBEDDING_MODELS.map(m => ({ value: m.id, label: m.label }))}
          value={activeModelId}
          onChange={async (e) => {
            const newId = e.target.value;
            setActiveModelIdState(newId);
            await setActiveModelId(storage.idb, newId);
          }} />
      </ConfigRow>

      <ConfigRow label="Metadata-KI">
        <div className="space-y-1">
          <Select
            options={METADATA_LLM_MODELS.map(m => ({ value: m.id, label: m.label }))}
            value={config.metadataLLMId}
            onChange={e => updateConfig({ metadataLLMId: e.target.value })} />
          {selectedMetadata?.needsApiKey && !hasApiKey && (
            <p className="text-[11px] text-[var(--tf-warning-text)]">API Key erforderlich</p>
          )}
          {selectedMetadata?.backend === 'browser' && !hasGPU && (
            <p className="text-[11px] text-[var(--tf-warning-text)]">WebGPU nicht verfuegbar</p>
          )}
        </div>
      </ConfigRow>

      {config.metadataLLMId === 'llamacpp-lan' && (
        <ConfigRow label="LAN-Server">
          <div className="space-y-1">
            <input type="text" value={config.lanEndpoint}
              placeholder="http://192.168.1.X:8080/v1"
              onChange={e => updateConfig({ lanEndpoint: e.target.value })}
              className="w-56 px-2 py-1 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
              style={{ border: '0.5px solid var(--tf-border)' }} />
            {!config.lanEndpoint && (
              <p className="text-[11px] text-[var(--tf-warning-text)]">Server-Adresse erforderlich</p>
            )}
          </div>
        </ConfigRow>
      )}

      {selectedMetadata && config.metadataLLMId !== 'none' && selectedMetadata.maxParallelism > 1 && (
        <>
          <ConfigRow label="Kontext-Tokens">
            <select value={config.metadataContext} onChange={e => updateConfig({ metadataContext: parseInt(e.target.value) })}
              className="px-2 py-1 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
              style={{ border: '0.5px solid var(--tf-border)' }}>
              <option value={4096}>4K</option>
              <option value={8192}>8K</option>
              <option value={16384}>16K</option>
              <option value={32768}>32K</option>
            </select>
          </ConfigRow>
          <ConfigRow label="Parallele API-Calls">
            <input type="number" min={1} max={selectedMetadata.maxParallelism} value={config.metadataParallelism}
              onChange={e => updateConfig({ metadataParallelism: Math.max(1, Math.min(selectedMetadata.maxParallelism, parseInt(e.target.value) || 3)) })}
              className="w-16 px-2 py-1 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
              style={{ border: '0.5px solid var(--tf-border)' }} />
          </ConfigRow>
        </>
      )}

      <ConfigRow label="Chunk-Prefixes">
        <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text)] cursor-pointer">
          <input type="checkbox" checked={config.useContextualPrefixes}
            onChange={e => updateConfig({ useContextualPrefixes: e.target.checked })} />
          {config.useContextualPrefixes ? 'Aktiviert' : 'Deaktiviert'}
        </label>
      </ConfigRow>

      <ConfigRow label="Re-Ranker">
        <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text)] cursor-pointer">
          <input type="checkbox" checked={config.useReRanker}
            onChange={async e => {
              updateConfig({ useReRanker: e.target.checked });
              await toggleReRanker(e.target.checked, config.reRankerModelId);
            }} />
          {config.useReRanker ? 'Aktiviert (Experimentell)' : 'Deaktiviert'}
        </label>
      </ConfigRow>

      {config.useReRanker && (
        <ConfigRow label="Re-Ranker Modell">
          <Select
            options={RERANKER_MODELS.map(m => ({ value: m.id, label: m.label }))}
            value={config.reRankerModelId}
            onChange={async e => {
              updateConfig({ reRankerModelId: e.target.value });
              await toggleReRanker(true, e.target.value);
            }} />
        </ConfigRow>
      )}

      <ConfigRow label="Verzeichnisse">
        <details className="w-full">
          <summary className="text-[12px] text-[var(--tf-text-secondary)] cursor-pointer hover:text-[var(--tf-text)]">
            {storage.getDirectories().length} verbunden
          </summary>
          <div className="mt-2"><DirectoriesStep /></div>
        </details>
      </ConfigRow>

      <ConfigRow label="Metadata-Cache">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={async () => {
            const count = await clearMetadataCache(storage);
            setCacheMsg(`${count} Eintraege geloescht`);
            setTimeout(() => setCacheMsg(null), 3000);
          }}>Leeren</Button>
          {cacheMsg && <span className="text-[11px] text-[var(--tf-text-secondary)]">{cacheMsg}</span>}
        </div>
      </ConfigRow>

      {/* Technische Details */}
      <details className="mt-3 text-[11px] text-[var(--tf-text-tertiary)]">
        <summary className="cursor-pointer hover:text-[var(--tf-text-secondary)]">Technische Details</summary>
        <div className="mt-2 space-y-1 p-2">
          <div className="flex justify-between"><span>HuggingFace ID</span><span className="text-[var(--tf-text)]">{activeModel.name}</span></div>
          <div className="flex justify-between"><span>Dimensionen</span><span className="text-[var(--tf-text)]">{activeModel.dimensions}</span></div>
          <div className="flex justify-between"><span>Backend</span><span className="text-[var(--tf-text)]">{hasGPU ? 'WebGPU' : 'WASM (CPU)'}</span></div>
        </div>
      </details>
    </div>
  );
}
