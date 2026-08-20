import { useState, useEffect } from 'react';
import { Select } from '@/ui/Select';
import { useStorage } from '@/core/hooks/useStorage';
import {
  EMBEDDING_MODELS, setActiveModelId,
} from '@/core/services/search/model-registry';
import { verfuegbareMetadataModelle, probeActiveLocalModel } from '@/core/services/search/metadata-extractor';
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
  const [activeLocalModel, setActiveLocalModel] = useState<string | null>(null);
  // Nur die Modelle, die diese Variante anbietet — in pl fehlen die beiden
  // Einträge, die ihre Adresse aus dem `ai-provider`-Eintrag ziehen.
  const metadataModelle = verfuegbareMetadataModelle();
  const selectedMetadata = metadataModelle.find(m => m.id === config.metadataLLMId);
  const isLocalServer = config.metadataLLMId === 'llamacpp-local'
    || config.metadataLLMId === 'llamacpp-lan';
  const maxParallelism = selectedMetadata?.maxParallelism ?? 4;
  const showParallelism = config.metadataLLMId !== 'none' && maxParallelism > 1;

  useEffect(() => {
    storage.idb.get<AIProviderConfig>('ai-provider').then(c => setHasApiKey(!!c?.apiKey));
  }, [storage]);

  useEffect(() => {
    let cancelled = false;
    if (!isLocalServer) { setActiveLocalModel(null); return; }
    probeActiveLocalModel(
      config.metadataLLMId as 'llamacpp-local' | 'llamacpp-lan',
      { idb: storage.idb },
    ).then(name => { if (!cancelled) setActiveLocalModel(name); });
    return () => { cancelled = true; };
  }, [storage, isLocalServer, config.metadataLLMId, config.localPort, config.lanEndpoint]);

  return (
    <div className="p-[16px] rounded-[var(--tf-radius)] space-y-3"
      style={{ border: '0.5px solid var(--tf-border)' }}>

      <p className="text-[13px] font-medium text-[var(--tf-text)]">KI Modelle auswaehlen</p>

      {/* Textanalyse — bei genau einem Modell keine Auswahl, sondern eine Angabe:
          ein Aufklapper mit einer einzigen Zeile sieht nach Wahl aus und ist keine. */}
      <div className="space-y-1">
        <p className="text-[12px] text-[var(--tf-text-secondary)]">Textanalyse</p>
        {EMBEDDING_MODELS.length === 1 ? (
          <p className="text-[12px] text-[var(--tf-text)]">{EMBEDDING_MODELS[0]!.label}</p>
        ) : (
        <Select
          options={EMBEDDING_MODELS.map(m => ({ value: m.id, label: m.label }))}
          value={activeModelId}
          onChange={async (e) => {
            const newId = e.target.value;
            if (newId === activeModelId) return;
            const oldLabel = EMBEDDING_MODELS.find(m => m.id === activeModelId)?.label ?? activeModelId;
            const newLabel = EMBEDDING_MODELS.find(m => m.id === newId)?.label ?? newId;
            const ok = window.confirm(
              `Embedding-Modell wechseln?\n\n` +
              `Von: ${oldLabel}\n` +
              `Zu:  ${newLabel}\n\n` +
              `Konsequenzen:\n` +
              `· Bestehender Suchindex (Volltext-Suche) wird inkompatibel und muss neu gebaut werden.\n` +
              `· Auslastungs-Modul: Stage-2-Embedding-Korpus auf dem Daten-Share wird inkompatibel — andere Teammitglieder können ihn nicht mehr nutzen, müssen lokal neu bauen (~46 min).\n` +
              `· Centroids in auslastung.json bleiben gespeichert, sind aber falsch dimensioniert und müssen neu berechnet werden.\n\n` +
              `Diese Aktion betrifft das gesamte Team. Wirklich wechseln?`
            );
            if (!ok) {
              // Select-Wert zuruecksetzen, weil das DOM bereits geaendert hat
              e.target.value = activeModelId;
              return;
            }
            setActiveModelIdState(newId);
            await setActiveModelId(storage.idb, newId);
          }} />
        )}
      </div>

      {/* Metadaten-Extraktion */}
      <div className="space-y-1">
        <p className="text-[12px] text-[var(--tf-text-secondary)]">Metadaten-Extraktion</p>
        <Select
          options={metadataModelle.map(m => ({ value: m.id, label: m.label }))}
          value={config.metadataLLMId}
          onChange={e => updateConfig({ metadataLLMId: e.target.value })} />
        {selectedMetadata?.needsApiKey && !hasApiKey && (
          <p className="text-[11px] text-[var(--tf-warning-text)]">API Key erforderlich</p>
        )}
        {selectedMetadata?.backend === 'browser' && !hasGPU && (
          <p className="text-[11px] text-[var(--tf-warning-text)]">WebGPU nicht verfuegbar</p>
        )}
        {isLocalServer && activeLocalModel && (
          <p className="text-[11px] text-[var(--tf-text-tertiary)] font-mono">
            Aktiv: {activeLocalModel}
          </p>
        )}
      </div>

      {/* Lokaler Port (conditional) */}
      {config.metadataLLMId === 'llamacpp-local' && (
        <div className="space-y-1">
          <p className="text-[12px] text-[var(--tf-text-secondary)]">Lokaler Port</p>
          <input type="number" min={1024} max={65535} value={config.localPort}
            onChange={e => {
              const v = Number(e.target.value);
              updateConfig({ localPort: Number.isInteger(v) && v > 0 ? v : 9090 });
            }}
            className="w-full px-2 py-1 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
            style={{ border: '0.5px solid var(--tf-border)' }} />
          <p className="text-[11px] text-[var(--tf-text-tertiary)]">Default 9090. Aendern z.B. fuer Docker-TurboQuant-Build (8182).</p>
        </div>
      )}

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

      {/* Parallele Anfragen (conditional, nur wenn LLM-Backend mehrere Slots unterstuetzt) */}
      {showParallelism && (
        <div className="space-y-1">
          <p className="text-[12px] text-[var(--tf-text-secondary)]">Parallele Anfragen</p>
          <input type="number" min={1} max={maxParallelism} value={config.metadataParallelism}
            onChange={e => {
              const v = Number(e.target.value);
              const clamped = Math.max(1, Math.min(maxParallelism, Number.isInteger(v) && v > 0 ? v : 1));
              updateConfig({ metadataParallelism: clamped });
            }}
            className="w-full px-2 py-1 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
            style={{ border: '0.5px solid var(--tf-border)' }} />
          <p className="text-[11px] text-[var(--tf-text-tertiary)]">
            1 = sequenziell. Maximum {maxParallelism}. Lokal: passend zu llama-server <code>n_parallel</code> setzen.
          </p>
        </div>
      )}
    </div>
  );
}
