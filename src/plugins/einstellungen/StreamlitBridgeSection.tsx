import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { BRIDGE_BOOKMARKLET } from '@/core/services/ai/streamlit-bridge/snippet';
import type { AIProviderConfig } from '@/core/types/config';

const inputClass = 'w-full px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

interface StreamlitBridgeSectionProps {
  aiConfig: AIProviderConfig;
  setAiConfig: (config: AIProviderConfig) => void;
}

/**
 * In-App-Installer für die Streamlit-Bridge: Streamlit-URL konfigurieren,
 * Bookmarklet in die Lesezeichenleiste ziehen, Verbindung testen.
 * Der Transport (`StreamlitBridgeTransport`) öffnet die URL im Tab
 * `teamflow-streamlit`; das Bookmarklet aktiviert dort die postMessage-Bridge.
 */
export function StreamlitBridgeSection({ aiConfig, setAiConfig }: StreamlitBridgeSectionProps): React.ReactElement {
  const storage = useStorage();
  const aiBridge = useAIBridge();
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saved, setSaved] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);

  const url = (aiConfig.endpoint || 'https://gpt.vdivde-it.de/').trim();

  // React sanitisiert `javascript:`-hrefs (Warnung). Bookmarklet-URL daher
  // imperativ via setAttribute setzen — landet zuverlässig im DOM zum Ziehen.
  useEffect(() => {
    if (linkRef.current) linkRef.current.setAttribute('href', BRIDGE_BOOKMARKLET);
  }, []);

  const save = useAsyncAction(async () => {
    const cfg: AIProviderConfig = { type: 'streamlit', endpoint: url, model: '', apiKey: '' };
    await storage.idb.set('ai-provider', cfg);
    aiBridge.switchProvider(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  });

  const test = useAsyncAction(async () => {
    setTestResult(null);
    // PERSISTENTEN Streamlit-Transport nutzen (nicht neu anlegen) — er hält das
    // per `tf-bridge-ready`-Announce gecapturte Fenster-Handle → pingt den echten
    // Bookmarklet-Tab (tf-ping → tf-pong), ohne ihn per window.open neu zu laden.
    // `url` synchronisiert die Origin-Prüfung.
    const ok = await aiBridge.getStreamlitTransport(url).ping();
    setTestResult(ok ? 'success' : 'error');
    setTimeout(() => setTestResult(null), 5000);
  });

  const openTab = (): void => {
    // Transport-URL synchronisieren (Origin-Prüfung greift sonst nicht, wenn die
    // URL noch nicht gespeichert wurde), dann SYNCHRON öffnen → kein Popup-Blocker.
    // Gleicher Fenstername wie der Transport, damit beide denselben Tab teilen.
    aiBridge.getStreamlitTransport(url);
    window.open(url, 'teamflow-streamlit');
  };

  return (
    <div className="space-y-4">
      <SectionHeader label="Interne KI" />
      <p className="text-[11.5px] text-[var(--tf-text-tertiary)] max-w-2xl">
        Zugang zur internen KI über einen parallelen Browser-Tab. Diese App öffnet den Tab und tauscht
        die Daten aus; das Lesezeichen aktiviert die Verbindung im Tab der internen KI.
      </p>

      {/* URL + Speichern */}
      <div className="flex flex-col gap-1.5 max-w-sm">
        <label className="text-[13px] font-medium text-[var(--tf-text)]">Adresse der internen KI</label>
        <input
          value={aiConfig.endpoint}
          onChange={e => setAiConfig({ ...aiConfig, endpoint: e.target.value })}
          placeholder="https://gpt.vdivde-it.de/"
          className={inputClass}
          style={inputStyle}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={() => save.run()} disabled={save.busy}>
          {save.busy ? 'Speichern…' : 'Speichern & Aktivieren'}
        </Button>
        {saved && <Badge variant="success">Aktiviert</Badge>}
        <Button variant="secondary" onClick={openTab} disabled={!url}>
          <ExternalLink size={14} className="mr-1.5" />Interne KI öffnen
        </Button>
        <Button variant="secondary" onClick={() => test.run()} disabled={test.busy || !url}>
          {test.busy ? 'Teste…' : 'Verbindung testen'}
        </Button>
        {testResult === 'success' && <Badge variant="success">Interne KI erreichbar</Badge>}
        {testResult === 'error' && <Badge variant="error">Interne KI nicht erreichbar</Badge>}
      </div>
      {save.error && <p className="text-[12px] text-[var(--tf-error)]">Fehler: {save.error}</p>}
      {test.error && <p className="text-[12px] text-[var(--tf-error)]">Fehler: {test.error}</p>}

      {/* Bookmarklet */}
      <SectionHeader label="Lesezeichen installieren" />
      <div className="flex items-center gap-3 flex-wrap">
        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid -- href wird imperativ gesetzt (javascript:-Bookmarklet) */}
        <a
          ref={linkRef}
          draggable
          onClick={e => e.preventDefault()}
          className="inline-flex items-center px-4 py-2 text-[13px] font-medium text-white bg-[var(--tf-primary)] rounded-[var(--tf-radius)] cursor-grab select-none"
          title="In die Lesezeichenleiste ziehen"
        >
          Interne KI
        </a>
      </div>

      {/* Anleitung */}
      <ol className="text-[12px] text-[var(--tf-text-secondary)] list-decimal pl-5 space-y-1 max-w-2xl">
        <li>Adresse der internen KI eintragen und <strong>Speichern &amp; Aktivieren</strong>.</li>
        <li>Den Button <strong>„Interne KI"</strong> einmalig in die Lesezeichenleiste ziehen.</li>
        <li><strong>Interne KI öffnen</strong> klicken (der Tab muss <em>aus der App</em> geöffnet werden).</li>
        <li>Im Tab der internen KI das Lesezeichen anklicken — oben rechts erscheinen ein grünes Badge und der Button <strong>„ZAH-App testen"</strong> (zeigt „ZAH App erreichbar").</li>
        <li>Zurück hier: <strong>Verbindung testen</strong> → „Interne KI erreichbar". Danach läuft der KI-Chat über die Verbindung.</li>
      </ol>
      <p className="text-[11.5px] text-[var(--tf-text-tertiary)] max-w-2xl">
        Hinweis: Das Lesezeichen muss pro KI-Tab einmal angeklickt werden (nach jedem Neuladen erneut).
      </p>
    </div>
  );
}
