import { useState, useEffect } from 'react';
import { Tabs } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { getActiveModelId, getModelById } from '@/core/services/search/model-registry';
import { METADATA_LLM_MODELS } from '@/core/services/search/metadata-extractor';
import { UserView } from './views/UserView';
import { AdminView } from './views/AdminView';

const TABS = [
  { id: 'overview', label: '\u00dcbersicht' },
  { id: 'admin', label: 'Verwaltung' },
];

export function IndexManager(): React.ReactElement {
  const storage = useStorage();
  const [tab, setTab] = useState('overview');
  const [chunkCount, setChunkCount] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [activeModelId, setActiveModelIdState] = useState('minilm-l6-v2');
  const [indexModelId, setIndexModelId] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState('');
  const [newDocsCount, setNewDocsCount] = useState(0);
  const [hasGPU, setHasGPU] = useState(false);
  const [qualityPct, setQualityPct] = useState<number | null>(null);
  const [metadataLLMLabel, setMetadataLLMLabel] = useState('Kein LLM');
  const [smokeTestScore, setSmokeTestScore] = useState<number | null>(null);

  const fsConnected = storage.isFileServerConnected();

  useEffect(() => {
    storage.idb.get<boolean>('seed-complete').then(v => setSeeded(!!v));
    storage.idb.get<string>('index-last-update').then(v => setLastUpdate(v));
    storage.idb.keys('doc:').then(k => setDocCount(k.length));
    storage.idb.get<number>('index-chunk-count').then(c => setChunkCount(c ?? 0));
    storage.idb.get<string>('index-model-id').then(v => setIndexModelId(v ?? null));
    getActiveModelId(storage.idb).then(setActiveModelIdState);

    // Unindexierte Docs zaehlen
    Promise.all([
      storage.idb.keys('doc:'),
      storage.idb.get<Record<string, string>>('index-manifest'),
    ]).then(([keys, manifest]) => {
      const m = manifest ?? {};
      setNewDocsCount(keys.filter(k => !m[k.replace('doc:', '')]).length);
    });

    // GPU-Erkennung
    if ('gpu' in navigator) {
      (navigator as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu
        .requestAdapter().then(a => setHasGPU(!!a)).catch(() => setHasGPU(false));
    }

    // Qualitaets-Prozent laden
    storage.idb.get<{ summary?: { passed: number; total: number } }>('eval-latest').then(r => {
      if (r?.summary && r.summary.total > 0) {
        setQualityPct(Math.round((r.summary.passed / r.summary.total) * 100));
      }
    });

    // Metadata-LLM Label laden
    storage.idb.get<{ metadataLLMId?: string }>('pipeline-config').then(cfg => {
      const id = cfg?.metadataLLMId ?? 'none';
      const label = METADATA_LLM_MODELS.find(m => m.id === id)?.label ?? 'Kein LLM';
      setMetadataLLMLabel(label);
    });

    // Smoke-Test Score laden
    storage.idb.get<{ score?: number }>('smoke-test-latest').then(r => {
      setSmokeTestScore(r?.score ?? null);
    });
  }, [storage]);

  const indexOutdated = indexModelId !== null && indexModelId !== activeModelId;

  // Ampel-Logik
  const ampel = (): { color: string; label: string } => {
    if (chunkCount === 0)
      return { color: 'bg-red-500', label: 'Kein Index vorhanden \u2014 bitte indexieren' };
    if (indexOutdated)
      return { color: 'bg-amber-500', label: 'Modell gewechselt \u2014 Neu-Indexierung noetig' };
    if (newDocsCount > 0)
      return { color: 'bg-amber-500', label: `${newDocsCount} Dokumente nicht indexiert` };
    return { color: 'bg-emerald-500', label: 'Index aktuell' };
  };
  const amp = ampel();
  const activeModel = getModelById(activeModelId);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header mit Ampel */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Suchindex</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${amp.color}`} />
            <span className="text-[13px] text-[var(--tf-text-secondary)]">{amp.label}</span>
          </div>
        </div>
        {chunkCount > 0 && (
          <p className="text-[12px] text-[var(--tf-text-tertiary)]">
            {docCount} Dokumente {'\u00b7'} {chunkCount} Textabschnitte
            {lastUpdate ? ` \u00b7 ${new Date(lastUpdate).toLocaleDateString('de-DE')}` : ''}
          </p>
        )}
      </div>

      <Tabs tabs={TABS} activeTab={tab} onChange={setTab} />

      <div className="mt-6">
        {tab === 'overview' ? (
          <UserView
            chunkCount={chunkCount} docCount={docCount} lastUpdate={lastUpdate}
            activeModelLabel={activeModel.label} hasGPU={hasGPU}
            fsConnected={fsConnected} ampelColor={amp.color}
            qualityPct={qualityPct}
            metadataLLMLabel={metadataLLMLabel} smokeTestScore={smokeTestScore}
          />
        ) : (
          <AdminView
            chunkCount={chunkCount} docCount={docCount}
            activeModelId={activeModelId}
            seeded={seeded} seeding={seeding} seedProgress={seedProgress}
            indexOutdated={indexOutdated} hasGPU={hasGPU}
            qualityPct={qualityPct} newDocsCount={newDocsCount}
            setDocCount={setDocCount} setChunkCount={setChunkCount}
            setLastUpdate={setLastUpdate} setActiveModelIdState={setActiveModelIdState}
            setIndexModelId={setIndexModelId} setSeeded={setSeeded}
            setSeeding={setSeeding} setSeedProgress={setSeedProgress}
            setNewDocsCount={setNewDocsCount}
          />
        )}
      </div>
    </div>
  );
}
