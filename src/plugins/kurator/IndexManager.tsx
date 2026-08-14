import { useState, useEffect } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { useStorage } from '@/core/hooks/useStorage';
import { getModelById, DEFAULT_MODEL_ID } from '@/core/services/search/model-registry';
import { indexAmpel, ladeIndexKennzahlen, type IndexAmpelTon } from '@/core/services/search/indexAmpel';
import { useSearch } from '@/core/hooks/useSearch';
import { METADATA_LLM_MODELS } from '@/core/services/search/metadata-extractor';
import { UserView } from './views/UserView';
import { AdminView } from './views/AdminView';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';

const TABS = [
  { id: 'overview', label: '\u00dcbersicht' },
  { id: 'admin', label: 'Verwaltung' },
];

/**
 * Der Punkt neben der Ueberschrift. Die AUSSAGE kommt aus `indexAmpel`
 * (geteilt mit der Kuration-Uebersicht), hier steht nur, wie sie hier aussieht.
 */
const AMPEL_KLASSE: Record<IndexAmpelTon, string> = {
  fehler: 'bg-red-500',
  warnung: 'bg-amber-500',
  ok: 'bg-emerald-500',
};

export function IndexManager(): React.ReactElement {
  const storage = useStorage();
  const { documentCount } = useSearch();
  const [tab, setTab] = useState('overview');
  const [chunkCount, setChunkCount] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  // Startwert = Vorgabe, nicht ein hart genanntes Modell: der echte Wert kommt
  // gleich aus der IDB (`getActiveModelId` unten). Stand hier bis v4.14.0 die
  // Id eines Erprobungs-Modells — dann meldete die Karte fuer einen Wimpernschlag
  // „Modell gewechselt", und ein Lauf vor dem Nachladen haette falsch indexiert.
  const [activeModelId, setActiveModelIdState] = useState(DEFAULT_MODEL_ID);
  const [indexModelId, setIndexModelId] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState('');
  const [newDocsCount, setNewDocsCount] = useState(0);
  const [hasGPU, setHasGPU] = useState(false);
  const [qualityPct, setQualityPct] = useState<number | null>(null);
  const [metadataLLMLabel, setMetadataLLMLabel] = useState('Kein LLM');
  const [smokeTestScore, setSmokeTestScore] = useState<number | null>(null);
  /** Index stammt aus einer Fassung mit anderer Worttrennung (siehe INDEX_SPRACHE). */
  const [alteWorttrennung, setAlteWorttrennung] = useState(false);

  const fsConnected = storage.isFileServerConnected();

  // Die sechs Kennzahlen, aus denen die Ampel entsteht, kommen aus der geteilten
  // Ladestelle (`ladeIndexKennzahlen`) — dieselbe, aus der die Kuration-Uebersicht
  // liest. `alteWorttrennung` steckt darin und wird bei jedem `documentCount`
  // nachgezogen: gelesen wird der GELADENE Index, und der steht erst, wenn
  // `useSearchProvider` seinen Init durch hat — wer diese Seite direkt aufruft
  // (Lesezeichen, Reload), ist frueher da.
  useEffect(() => {
    void ladeIndexKennzahlen(storage.idb).then(k => {
      setDocCount(k.docCount);
      setChunkCount(k.chunkCount);
      setLastUpdate(k.lastUpdate);
      setIndexModelId(k.indexModelId);
      setActiveModelIdState(k.activeModelId);
      setNewDocsCount(k.neueDokumente);
      setAlteWorttrennung(k.alteWorttrennung);
    });
  }, [storage, documentCount]);

  useEffect(() => {
    // `seed-complete-v2` ist der Flag, den der Seed WIRKLICH schreibt. Der alte
    // `seed-complete` wird seit v2 nirgends mehr gesetzt — dadurch stand hier
    // dauerhaft „noch nicht geseedet" und der Zurücksetzen-Knopf blieb sichtbar,
    // auch auf einem Rechner mit echtem Bestand.
    storage.idb.get<boolean>('seed-complete-v2').then(v => setSeeded(!!v));

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

  const ampel = indexAmpel({
    chunkCount,
    modellGewechselt: indexOutdated,
    alteWorttrennung,
    neueDokumente: newDocsCount,
  });
  const amp = { color: AMPEL_KLASSE[ampel.ton], label: ampel.label };
  const activeModel = getModelById(activeModelId);

  return (
    <div className="p-6">
      {/* Header mit Ampel */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Suchindex</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${amp.color}`} />
            <span className="text-[13px] text-[var(--tf-text-secondary)]">{amp.label}</span>
          </div>
        </div>
        <div className="flex items-end gap-3 shrink-0">
          {chunkCount > 0 && (
            <p className="text-[12px] text-[var(--tf-text-tertiary)]">
              {docCount} Dokumente {'\u00b7'} {chunkCount} Textabschnitte
              {lastUpdate ? ` \u00b7 ${new Date(lastUpdate).toLocaleDateString('de-DE')}` : ''}
            </p>
          )}
          <SeitenHilfeButton pluginId="kurator" />
        </div>
      </div>
      <div className="max-w-5xl">

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
              indexOutdated={indexOutdated} alteWorttrennung={alteWorttrennung} hasGPU={hasGPU}
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
    </div>
  );
}
