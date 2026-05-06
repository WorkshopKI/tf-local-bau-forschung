import { useState, useEffect, useCallback } from 'react';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { METADATA_LLM_MODELS } from '@/core/services/search/metadata-extractor';
import { DEFAULT_RERANKER_ID } from '@/core/services/search/re-ranker'; // PHASE 2: Re-Ranker

export interface PipelineConfigState {
  metadataLLMId: string;
  metadataParallelism: number;
  metadataContext: number;
  metadataPreferGPU: boolean;
  lanEndpoint: string;
  useContextualPrefixes: boolean;
  useReRanker: boolean; // PHASE 2: Re-Ranker
  reRankerModelId: string; // PHASE 2: Re-Ranker
}

const DEFAULT_CONFIG: PipelineConfigState = {
  metadataLLMId: 'none',
  metadataParallelism: 3,
  metadataContext: 4096,
  metadataPreferGPU: true,
  lanEndpoint: '',
  useContextualPrefixes: false,
  useReRanker: false,
  reRankerModelId: DEFAULT_RERANKER_ID,
};

interface UsePipelineConfigReturn {
  config: PipelineConfigState;
  updateConfig: (patch: Partial<PipelineConfigState>) => void;
  loaded: boolean;
  metadataLLMLabel: string;
}

export function usePipelineConfig(idb: IDBStore): UsePipelineConfigReturn {
  const [config, setConfig] = useState<PipelineConfigState>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    idb.get<PipelineConfigState>('pipeline-config').then(cfg => {
      if (cfg) {
        setConfig({
          metadataLLMId: cfg.metadataLLMId ?? 'none',
          metadataParallelism: cfg.metadataParallelism ?? 3,
          metadataContext: cfg.metadataContext ?? 4096,
          metadataPreferGPU: cfg.metadataPreferGPU ?? true,
          lanEndpoint: cfg.lanEndpoint ?? '',
          useContextualPrefixes: cfg.useContextualPrefixes ?? false,
          useReRanker: cfg.useReRanker ?? false,
          reRankerModelId: cfg.reRankerModelId ?? DEFAULT_RERANKER_ID,
        });
      }
      setLoaded(true);
    });
  }, [idb]);

  const updateConfig = useCallback((patch: Partial<PipelineConfigState>) => {
    setConfig(prev => {
      const next = { ...prev, ...patch };
      idb.set('pipeline-config', next);
      return next;
    });
  }, [idb]);

  const metadataLLMLabel = METADATA_LLM_MODELS.find(m => m.id === config.metadataLLMId)?.label ?? 'Kein LLM';

  return { config, updateConfig, loaded, metadataLLMLabel };
}
