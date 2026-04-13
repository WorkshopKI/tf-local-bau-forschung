import { useState, useEffect } from 'react';
import { Button, Select } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import {
  EMBEDDING_MODELS, getModelById, setActiveModelId,
} from '@/core/services/search/model-registry';
import { METADATA_LLM_MODELS, clearMetadataCache } from '@/core/services/search/metadata-extractor';
import { useSearch } from '@/core/hooks/useSearch';
import { seedTestData, clearSeedData } from '@/core/services/seed/seed-data';
import type { PipelineConfigState } from '../hooks/usePipelineConfig';
import type { AIProviderConfig } from '@/core/types/config';

export interface ConfigSectionProps {
  config: PipelineConfigState;
  updateConfig: (patch: Partial<PipelineConfigState>) => void;
  activeModelId: string;
  setActiveModelIdState: (id: string) => void;
  hasGPU: boolean;
  seeded: boolean;
  seeding: boolean;
  seedProgress: string;
  setSeeded: (v: boolean) => void;
  setSeeding: (v: boolean) => void;
  setSeedProgress: (v: string) => void;
  setDocCount: (n: number) => void;
  setChunkCount: (n: number) => void;
  setLastUpdate: (s: string | null) => void;
  setIndexModelId: (s: string | null) => void;
  setNewDocsCount: (n: number) => void;
}

/* ── Helpers ── */

function SectionTitle({ title }: { title: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-between mb-2 pb-1.5"
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text)]">{title}</span>
    </div>
  );
}

function ConfigRow({ label, subtitle, children }: {
  label: string; subtitle?: string; children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className={`flex ${subtitle ? 'items-start' : 'items-center'} justify-between py-2 gap-4`}
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <div className="min-w-0">
        <span className="text-[13px] text-[var(--tf-text)]">{label}</span>
        {subtitle && <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">{children}</div>
    </div>
  );
}

/* ── Main Component ── */

export function ConfigSection({
  config, updateConfig, activeModelId, setActiveModelIdState, hasGPU,
  seeded, seeding, seedProgress, setSeeded, setSeeding, setSeedProgress,
  setDocCount, setChunkCount, setLastUpdate, setIndexModelId, setNewDocsCount,
}: ConfigSectionProps): React.ReactElement {
  const storage = useStorage();
  const { toggleReRanker } = useSearch();
  const [hasApiKey, setHasApiKey] = useState(false);
  const [cacheMsg, setCacheMsg] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);

  const activeModel = getModelById(activeModelId);
  const selectedMetadata = METADATA_LLM_MODELS.find(m => m.id === config.metadataLLMId);

  useEffect(() => {
    storage.idb.get<AIProviderConfig>('ai-provider').then(c => setHasApiKey(!!c?.apiKey));
  }, [storage]);

  const handleClearDocStore = async (): Promise<void> => {
    setClearing(true); setClearResult(null);
    try {
      const docKeys = await storage.idb.keys('doc:');
      for (const key of docKeys) await storage.idb.delete(key);
      const cacheKeys = await storage.idb.keys('metadata-cache:');
      for (const key of cacheKeys) await storage.idb.delete(key);
      for (const key of ['doc-file-hashes', 'doc-chunk-counts', 'index-manifest', 'orama-db',
        'index-chunk-count', 'index-last-update', 'index-model-id', 'seed-complete']) {
        await storage.idb.delete(key);
      }
      setDocCount(0); setChunkCount(0); setLastUpdate(null);
      setIndexModelId(null); setNewDocsCount(0); setSeeded(false);
      setClearResult('Lokale Daten geloescht.');
      setTimeout(() => setClearResult(null), 3000);
    } catch (err) { setClearResult(`Fehler: ${err}`); }
    finally { setClearing(false); }
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

  const handleClearSeed = async (): Promise<void> => {
    await clearSeedData(storage);
    setSeeded(false); setDocCount(0); setSeedProgress('');
  };

  return (
    <div className="space-y-6">

      {/* ── KI-MODELLE ── */}
      <div>
        <SectionTitle title="KI-Modelle" />

        <ConfigRow label="Textanalyse">
          <Select
            options={EMBEDDING_MODELS.map(m => ({ value: m.id, label: m.label }))}
            value={activeModelId}
            onChange={async (e) => {
              const newId = e.target.value;
              setActiveModelIdState(newId);
              await setActiveModelId(storage.idb, newId);
            }} />
        </ConfigRow>

        <ConfigRow label="Metadaten-Extraktion">
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
          <ConfigRow label="Server-Adresse" subtitle="IP-Adresse des llama.cpp Servers im Netzwerk">
            <div className="space-y-1">
              <input type="text" value={config.lanEndpoint}
                placeholder="http://192.168.1.X:9091/v1"
                onChange={e => updateConfig({ lanEndpoint: e.target.value })}
                className="w-56 px-2 py-1 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
                style={{ border: '0.5px solid var(--tf-border)' }} />
              {!config.lanEndpoint && (
                <p className="text-[11px] text-[var(--tf-warning-text)]">Server-Adresse erforderlich</p>
              )}
            </div>
          </ConfigRow>
        )}

        <details className="mt-3 text-[11px] text-[var(--tf-text-tertiary)]">
          <summary className="cursor-pointer hover:text-[var(--tf-text-secondary)]">Technische Details</summary>
          <div className="mt-2 space-y-1 p-2">
            <div className="flex justify-between"><span>HuggingFace ID</span><span className="text-[var(--tf-text)]">{activeModel.name}</span></div>
            <div className="flex justify-between"><span>Dimensionen</span><span className="text-[var(--tf-text)]">{activeModel.dimensions}</span></div>
            <div className="flex justify-between"><span>Backend</span><span className="text-[var(--tf-text)]">{hasGPU ? 'WebGPU' : 'WASM (CPU)'}</span></div>
          </div>
        </details>
      </div>

      {/* ── SUCHQUALITAET ── */}
      <div>
        <SectionTitle title="Suchqualitaet" />

        <ConfigRow label="Kontext-Anreicherung"
          subtitle="Dokumenttyp und Zusammenfassung werden in die Suche einbezogen">
          <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text)] cursor-pointer">
            <input type="checkbox" checked={config.useContextualPrefixes}
              onChange={e => updateConfig({ useContextualPrefixes: e.target.checked })} />
            {config.useContextualPrefixes ? 'Aktiviert' : 'Deaktiviert'}
          </label>
        </ConfigRow>

        <ConfigRow label="Ergebnis-Nachsortierung"
          subtitle="KI sortiert Suchergebnisse nach Relevanz nach — sehr langsam">
          <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text)] cursor-pointer">
            <input type="checkbox" checked={config.useReRanker}
              onChange={async e => {
                updateConfig({ useReRanker: e.target.checked });
                await toggleReRanker(e.target.checked, config.reRankerModelId);
              }} />
            {config.useReRanker ? 'Aktiviert (Experimentell)' : 'Deaktiviert'}
          </label>
        </ConfigRow>
      </div>

      {/* ── ZURUECKSETZEN ── */}
      <div>
        <SectionTitle title="Zuruecksetzen" />

        <ConfigRow label="KI-Analysen zuruecksetzen"
          subtitle="Dokumente werden beim naechsten Indexieren neu analysiert">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={async () => {
              const count = await clearMetadataCache(storage);
              setCacheMsg(`${count} Eintraege zurueckgesetzt`);
              setTimeout(() => setCacheMsg(null), 3000);
            }}>Zuruecksetzen</Button>
            {cacheMsg && <span className="text-[11px] text-[var(--tf-text-secondary)]">{cacheMsg}</span>}
          </div>
        </ConfigRow>

        <ConfigRow label="Beispieldaten"
          subtitle="40 Vorgaenge mit 60 Dokumenten zum Ausprobieren">
          <div className="flex items-center gap-2">
            {!seeded ? (
              <Button variant="secondary" size="sm" disabled={seeding} onClick={handleSeed}>
                {seeding ? 'Erzeuge...' : 'Erzeugen'}
              </Button>
            ) : (
              <Button variant="danger" size="sm" onClick={handleClearSeed}>Loeschen</Button>
            )}
            {seedProgress && <span className="text-[11px] text-[var(--tf-text-secondary)]">{seedProgress}</span>}
          </div>
        </ConfigRow>

        <ConfigRow label="Lokale Daten zuruecksetzen"
          subtitle="Index und Browser-Speicher leeren. Dateien auf dem Server bleiben erhalten.">
          <div className="flex items-center gap-2">
            <Button variant="danger" size="sm" loading={clearing} onClick={handleClearDocStore}>Zuruecksetzen</Button>
            {clearResult && <span className="text-[11px] text-[var(--tf-text-secondary)]">{clearResult}</span>}
          </div>
        </ConfigRow>
      </div>
    </div>
  );
}
