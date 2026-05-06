import { useState, useEffect } from 'react';
import { Select } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import {
  EMBEDDING_MODELS, setActiveModelId,
} from '@/core/services/search/model-registry';
import { METADATA_LLM_MODELS } from '@/core/services/search/metadata-extractor';
import type { PipelineConfigState } from '../hooks/usePipelineConfig';
import type { AIProviderConfig } from '@/core/types/config';

interface ActionCardModelsProps {
  activeModelId: string;
  setActiveModelIdState: (id: string) => void;
  config: PipelineConfigState;
  updateConfig: (patch: Partial<PipelineConfigState>) => void;
  hasGPU: boolean;
}

export function ActionCardModels({
  activeModelId, setActiveModelIdState, config, updateConfig, hasGPU,
}: ActionCardModelsProps): React.ReactElement {
  const storage = useStorage();
  const [hasApiKey, setHasApiKey] = useState(false);
  const selectedMetadata = METADATA_LLM_MODELS.find(m => m.id === config.metadataLLMId);

  useEffect(() => {
    storage.idb.get<AIProviderConfig>('ai-provider').then(c => setHasApiKey(!!c?.apiKey));
  }, [storage]);

  return (
    <div className="p-[16px] rounded-[var(--tf-radius)] space-y-3"
      style={{ border: '0.5px solid var(--tf-border)' }}>

      <p className="text-[13px] font-medium text-[var(--tf-text)]">KI Modelle auswaehlen</p>

      {/* Textanalyse */}
      <div className="space-y-1">
        <p className="text-[12px] text-[var(--tf-text-secondary)]">Textanalyse</p>
        <Select
          options={EMBEDDING_MODELS.map(m => ({ value: m.id, label: m.label }))}
          value={activeModelId}
          onChange={async (e) => {
            const newId = e.target.value;
            setActiveModelIdState(newId);
            await setActiveModelId(storage.idb, newId);
          }} />
      </div>

      {/* Metadaten-Extraktion */}
      <div className="space-y-1">
        <p className="text-[12px] text-[var(--tf-text-secondary)]">Metadaten-Extraktion</p>
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

      {/* Server-Adresse (conditional) */}
      {config.metadataLLMId === 'llamacpp-lan' && (
        <div className="space-y-1">
          <p className="text-[12px] text-[var(--tf-text-secondary)]">Server-Adresse</p>
          <input type="text" value={config.lanEndpoint}
            placeholder="http://192.168.1.X:9091/v1"
            onChange={e => updateConfig({ lanEndpoint: e.target.value })}
            className="w-full px-2 py-1 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
            style={{ border: '0.5px solid var(--tf-border)' }} />
          {!config.lanEndpoint && (
            <p className="text-[11px] text-[var(--tf-warning-text)]">Server-Adresse erforderlich</p>
          )}
        </div>
      )}
    </div>
  );
}
