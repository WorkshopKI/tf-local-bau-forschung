import { useState, useEffect, useCallback } from 'react';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { verfuegbareMetadataModelle, normalisiereMetadataLLMId } from '@/core/services/search/metadata-extractor';
import { DEFAULT_RERANKER_ID } from '@/core/services/search/re-ranker'; // PHASE 2: Re-Ranker

export interface PipelineConfigState {
  metadataLLMId: string;
  metadataParallelism: number;
  metadataContext: number;
  metadataPreferGPU: boolean;
  lanEndpoint: string;
  localPort: number;
  useContextualPrefixes: boolean;
  useReRanker: boolean; // PHASE 2: Re-Ranker
  reRankerModelId: string; // PHASE 2: Re-Ranker
}

const DEFAULT_CONFIG: PipelineConfigState = {
  metadataLLMId: 'none',
  metadataParallelism: 4,
  metadataContext: 4096,
  metadataPreferGPU: true,
  lanEndpoint: '',
  localPort: 9090,
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
          // Eine Auswahl, die diese Variante nicht mehr anbietet, gilt als
          // 'none' — sonst zeigte das Auswahlfeld Option 0 und der Indexlauf
          // spräche weiter die alte Adresse an.
          metadataLLMId: normalisiereMetadataLLMId(cfg.metadataLLMId),
          metadataParallelism: cfg.metadataParallelism ?? 4,
          metadataContext: cfg.metadataContext ?? 4096,
          metadataPreferGPU: cfg.metadataPreferGPU ?? true,
          lanEndpoint: cfg.lanEndpoint ?? '',
          localPort: Number.isInteger(cfg.localPort) && cfg.localPort > 0 ? cfg.localPort : 9090,
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

  const metadataLLMLabel = verfuegbareMetadataModelle()
    .find(m => m.id === config.metadataLLMId)?.label ?? 'Kein LLM';

  return { config, updateConfig, loaded, metadataLLMLabel };
}
