import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { clearMetadataCache } from '@/core/services/search/metadata-extractor';
import { seedTestData, clearSeedData } from '@/core/services/seed/seed-data';
import { unloadAllGPU } from '../utils/gpu-utils';
import type { PipelineConfigState } from '../hooks/usePipelineConfig';

export interface ConfigSectionProps {
  config: PipelineConfigState;
  updateConfig: (patch: Partial<PipelineConfigState>) => void;
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
  config, updateConfig,
  seeded, seeding, seedProgress, setSeeded, setSeeding, setSeedProgress,
  setDocCount, setChunkCount, setLastUpdate, setIndexModelId, setNewDocsCount,
}: ConfigSectionProps): React.ReactElement {
  const storage = useStorage();
  const [cacheMsg, setCacheMsg] = useState<string | null>(null);
  const [gpuMsg, setGpuMsg] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);

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

        <div className="opacity-50 pointer-events-none">
          <ConfigRow label="Ergebnis-Nachsortierung"
            subtitle="KI sortiert Suchergebnisse nach Relevanz nach — sehr langsam">
            <label className="flex items-center gap-2 text-[12px] text-[var(--tf-text)]">
              <input type="checkbox" checked={false} disabled />
              Deaktiviert
            </label>
          </ConfigRow>
        </div>
      </div>

      {/* ── ZURUECKSETZEN ── */}
      <div>
        <SectionTitle title="Zuruecksetzen" />

        <ConfigRow label="GPU-Modelle entladen"
          subtitle="Gibt GPU-Speicher frei (Embedding, Metadata-LLM)">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={Trash2} onClick={() => {
              const unloaded = unloadAllGPU();
              const text = unloaded.length > 0
                ? `Entladen: ${unloaded.join(', ')}`
                : 'Keine GPU-Modelle geladen';
              setGpuMsg(text);
              setTimeout(() => setGpuMsg(null), 4000);
            }}>Modelle entladen</Button>
            {gpuMsg && <span className="text-[11px] text-[var(--tf-text-secondary)]">{gpuMsg}</span>}
          </div>
        </ConfigRow>

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
