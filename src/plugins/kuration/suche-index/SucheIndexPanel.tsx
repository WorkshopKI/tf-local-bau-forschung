/**
 * Panel „Suche & Index" — bis v4.34 die eigene Seite `/kuration/suchindex`.
 *
 * Der Tab-Schnitt „Übersicht" / „Verwaltung" ist dabei entfallen. Er trennte,
 * was zusammengehört: links stehen jetzt die Aktionen, rechts der Zustand, auf
 * den sie wirken — man sieht beim Indexieren zu, statt danach den Reiter zu
 * wechseln. Das Seltene (Modell-Konfiguration, Korpus-Status, Zurücksetzen)
 * liegt eingeklappt darunter.
 *
 * Die Ampel kommt aus `indexAmpel` — dieselbe Funktion, aus der die
 * Kuration-Übersicht liest.
 */
import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useSearch } from '@/core/hooks/useSearch';
import { getModelById, DEFAULT_MODEL_ID } from '@/core/services/search/model-registry';
import { indexAmpel, ladeIndexKennzahlen } from '@/core/services/search/indexAmpel';
import { METADATA_LLM_MODELS } from '@/core/services/search/metadata-extractor';
import {
  SettingsGruppe,
  SettingsKennzahl,
  SettingsKlappe,
  SettingsOption,
  SettingsStatusBadge,
  SettingsZweiSpalten,
} from '@/components/settings';
import { usePipelineConfig } from './hooks/usePipelineConfig';
import { ActionCardIndex } from './actions/ActionCardIndex';
import { ActionCardQuality } from './actions/ActionCardQuality';
import { ActionCardDocuments } from './actions/ActionCardDocuments';
import { ActionCardModels } from './actions/ActionCardModels';
import { ConfigSection } from './sections/ConfigSection';
import { EmbeddingKorpusSection } from './sections/EmbeddingKorpusSection';
import { EvalSection } from './eval/EvalSection';
import { MetadataSmokeTest } from './MetadataSmokeTest';
import { features, isDevInfraPanelEnabled } from '@/config/feature-flags';
import { useDmsSources } from '../dokumentenquellen/hooks/useDmsSources';
import { VerwaltenSection } from '../dokumentenquellen/sections/VerwaltenSection';
import { AktivierenIndexierenSection } from '../dokumentenquellen/sections/AktivierenIndexierenSection';

export function SucheIndexPanel(): React.ReactElement {
  const storage = useStorage();
  const { documentCount } = useSearch();
  const { config, updateConfig } = usePipelineConfig(storage.idb);
  // Die DMS-Quellen sind die EINGABE des Index — sie stehen deshalb auf
  // derselben Seite und nicht mehr unter einem eigenen Menuepunkt.
  const dms = useDmsSources(storage.idb);
  const dmsVerwaltenSichtbar = isDevInfraPanelEnabled() || import.meta.env.DEV;

  const [chunkCount, setChunkCount] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  // Startwert = Vorgabe, nicht ein hart genanntes Modell: der echte Wert kommt
  // gleich aus der IDB. Stand hier bis v4.14.0 die Id eines Erprobungs-Modells —
  // dann meldete die Karte fuer einen Wimpernschlag „Modell gewechselt", und ein
  // Lauf vor dem Nachladen haette falsch indexiert.
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
  const [resultPanel, setResultPanel] = useState<'eval' | 'smoke-test' | null>(null);

  const fsConnected = storage.isFileServerConnected();

  // Die sechs Kennzahlen, aus denen die Ampel entsteht, kommen aus der
  // geteilten Ladestelle — derselben, aus der die Kuration-Uebersicht liest.
  // `alteWorttrennung` steckt darin und wird bei jedem `documentCount`
  // nachgezogen: gelesen wird der GELADENE Index, und der steht erst, wenn
  // `useSearchProvider` seinen Init durch hat.
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

    if ('gpu' in navigator) {
      (navigator as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu
        .requestAdapter().then(a => setHasGPU(!!a)).catch(() => setHasGPU(false));
    }

    storage.idb.get<{ summary?: { passed: number; total: number } }>('eval-latest').then(r => {
      if (r?.summary && r.summary.total > 0) {
        setQualityPct(Math.round((r.summary.passed / r.summary.total) * 100));
      }
    });

    storage.idb.get<{ metadataLLMId?: string }>('pipeline-config').then(cfg => {
      const id = cfg?.metadataLLMId ?? 'none';
      setMetadataLLMLabel(METADATA_LLM_MODELS.find(m => m.id === id)?.label ?? 'Kein LLM');
    });

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
  const hasIndex = chunkCount > 0;
  const activeModel = getModelById(activeModelId);

  const metadataWert = metadataLLMLabel === 'Kein LLM (regelbasiert)' || metadataLLMLabel === 'Kein LLM'
    ? 'Kein LLM'
    : smokeTestScore !== null
      ? `${metadataLLMLabel.split('(')[0]?.trim()} · Ø ${smokeTestScore}`
      : metadataLLMLabel.split('(')[0]?.trim() ?? metadataLLMLabel;

  /** Zustandszeile in der Nebenspalte: links die Frage, rechts die Antwort. */
  const Zeile = ({ label, wert }: { label: string; wert: string }): React.ReactElement => (
    <SettingsOption label={label}>
      <span className="text-[12.5px] text-[var(--tf-text-secondary)]">{wert}</span>
    </SettingsOption>
  );

  return (
    <SettingsZweiSpalten
      haupt={
        <>
          <SettingsGruppe
            id="sec-index"
            titel="Index pflegen"
            unterzeile="Dokumente einlesen, Index bauen, Qualität messen."
            hint="Der Index trägt die Volltext- und die semantische Suche. Er veraltet nicht von selbst, sondern wenn Dokumente dazukommen oder das Embedding-Modell wechselt. Ein Neuaufbau läuft im Vordergrund und kann je nach Bestand einige Minuten dauern."
            rechts={<SettingsStatusBadge ton={ampel.ton}>{ampel.label}</SettingsStatusBadge>}
          >
            <div className="grid grid-cols-2 gap-3 pt-1">
              <ActionCardDocuments docCount={docCount} setDocCount={setDocCount} />
              <ActionCardIndex
                chunkCount={chunkCount} docCount={docCount} activeModelId={activeModelId}
                indexOutdated={indexOutdated} alteWorttrennung={alteWorttrennung}
                hasGPU={hasGPU} newDocsCount={newDocsCount}
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

            {/* Ergebnis steht dort, wo der Knopf war — nicht auf einem anderen Reiter. */}
            {resultPanel === 'eval' && (
              <div className="pt-4">
                <EvalSection chunkCount={chunkCount} modelId={activeModelId} />
              </div>
            )}
            {resultPanel === 'smoke-test' && (
              <div className="pt-4">
                <MetadataSmokeTest />
              </div>
            )}
          </SettingsGruppe>

          {features.dokumentenscan && (
          <SettingsGruppe
            id="sec-dokumentenquellen"
            titel="Dokumentenquellen"
            unterzeile="Welche DMS-Ordner der Index einliest."
            hint="Alle Quellen werden read-only gemountet — die App schreibt nie in diese Verzeichnisse. Aktivieren und indexieren startet die Triage über die gewählten Ordner; sie entscheidet je Datei, ob sie relevant ist und zu welchem Antrag sie gehört."
          >
            {dms.error && (
              <p className="py-2 text-[12px] text-[var(--tf-danger-text)]">{dms.error}</p>
            )}
            {dms.loading ? (
              <p className="py-2 text-[12.5px] text-[var(--tf-text-tertiary)]">Lade…</p>
            ) : (
              <div className="pt-1 space-y-6">
                <AktivierenIndexierenSection
                  sources={dms.sources}
                  handleStatus={dms.handleStatus}
                  handleNames={dms.handleNames}
                  onChanged={dms.reload}
                />
                {dmsVerwaltenSichtbar && (
                  <VerwaltenSection
                    sources={dms.sources}
                    handleStatus={dms.handleStatus}
                    handleNames={dms.handleNames}
                    onChanged={dms.reload}
                  />
                )}
              </div>
            )}
          </SettingsGruppe>
          )}

          {/* v4.127: Die Vektoren standen unter „Selten gebraucht" und zeigten dort
              nur an, DASS es sie gibt — gebaut wurden sie im Auslastungs-Modul.
              Sie sind aber die zweite Hälfte eben dieses Index: ohne sie ist „auch
              ähnliche Themen" wirkungslos. Deshalb eigene Karte neben „Index
              pflegen", und der Bau liegt hier.

              `unterzeile`/`hint` stehen in Expression-Form, weil deutsche
              Anführungszeichen darin vorkommen: das Schlusszeichen gerät leicht
              zum ASCII-Zeichen und beendet dann das Attribut mitten im Satz. */}
          <SettingsGruppe
            id="sec-embedding-korpus"
            titel="Vektoren der Ähnlichkeitssuche"
            unterzeile={'Ein Vektor je Vorhaben — trägt „auch ähnliche Themen“.'}
            hint={'Der Volltext-Index findet Wörter, diese Vektoren finden Themen: eine Suche nach „Verfahren zur Kadaversuche aus der Luft“ trifft ein Vorhaben auch dann, wenn keines dieser Wörter in seinem Titel steht. Gebaut wird einmal für das ganze Team; jeder andere Rechner holt das Ergebnis in ~10 Sekunden vom Datenspeicher. Der Bau selbst lädt ein ~200-MB-Modell in diesen Browser-Tab und läuft je nach Bestand ~40 Minuten.'}
          >
            <EmbeddingKorpusSection />
          </SettingsGruppe>

          <SettingsGruppe titel="Selten gebraucht" traegt={['sec-index-erweitert']}>
            <SettingsKlappe
              id="sec-index-erweitert"
              label="Modelle, Suchqualität, Zurücksetzen"
              storageKey="teamflow_kuration_index_erweitert"
            >
              <ConfigSection
                config={config} updateConfig={updateConfig}
                seeded={seeded} seeding={seeding} seedProgress={seedProgress}
                setSeeded={setSeeded} setSeeding={setSeeding} setSeedProgress={setSeedProgress}
                setDocCount={setDocCount} setChunkCount={setChunkCount} setLastUpdate={setLastUpdate}
                setIndexModelId={setIndexModelId} setNewDocsCount={setNewDocsCount}
              />
            </SettingsKlappe>
          </SettingsGruppe>
        </>
      }
      neben={
        <SettingsGruppe id="sec-index-zustand" titel="Zustand">
          <div className="grid grid-cols-3 gap-2 pt-1 pb-1">
            <SettingsKennzahl label="Abschnitte" wert={chunkCount.toLocaleString('de-DE')} />
            <SettingsKennzahl label="Dokumente" wert={docCount.toLocaleString('de-DE')} />
            <SettingsKennzahl label="Qualität" wert={qualityPct !== null ? `${qualityPct}%` : '—'} />
          </div>
          <Zeile label="Datenserver" wert={fsConnected ? 'Verbunden' : 'Nicht verbunden'} />
          <Zeile label="Suche" wert={hasIndex ? 'BM25 + Vektor + Hybrid' : 'Inaktiv'} />
          <Zeile label="Modell" wert={activeModel.label} />
          <Zeile label="Backend" wert={hasGPU ? 'WebGPU' : 'CPU'} />
          <Zeile label="Metadata-KI" wert={metadataWert} />
          <Zeile
            label="Letztes Update"
            wert={lastUpdate ? new Date(lastUpdate).toLocaleDateString('de-DE') : '—'}
          />
        </SettingsGruppe>
      }
    />
  );
}
