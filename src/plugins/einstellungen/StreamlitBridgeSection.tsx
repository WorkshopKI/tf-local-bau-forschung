import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { StreamlitBridgeTransport } from '@/core/services/ai/transports/streamlit';
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
 * Bookmarklet in die Lesezeichenleiste ziehen/kopieren, Verbindung testen.
 * Der Transport (`StreamlitBridgeTransport`) öffnet die URL im Tab
 * `teamflow-streamlit`; das Bookmarklet aktiviert dort die postMessage-Bridge.
 */
export function StreamlitBridgeSection({ aiConfig, setAiConfig }: StreamlitBridgeSectionProps): React.ReactElement {
  const storage = useStorage();
  const aiBridge = useAIBridge();
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);

  const url = (aiConfig.endpoint || 'http://localhost:8501').trim();

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
    // Frischer Transport mit der aktuell eingetippten URL — testet die ECHTE
    // Bridge (tf-ping → tf-pong), nicht DirectLLM. ensureConnection() nutzt den
    // benannten Tab wieder, falls schon offen.
    const ok = await new StreamlitBridgeTransport(url).ping();
    setTestResult(ok ? 'success' : 'error');
    setTimeout(() => setTestResult(null), 5000);
  });

  const copy = useAsyncAction(async () => {
    await navigator.clipboard.writeText(BRIDGE_BOOKMARKLET);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  });

  const openTab = (): void => {
    // Synchron im Click → kein Popup-Blocker. Gleicher Fenstername wie der
    // Transport, damit beide denselben einen Tab teilen.
    window.open(url, 'teamflow-streamlit');
  };

  return (
    <div className="space-y-4">
      <SectionHeader label="Streamlit Bridge" />
      <p className="text-[11.5px] text-[var(--tf-text-tertiary)] max-w-2xl">
        Zugang zum internen LLM über eine Streamlit-Chat-App in einem parallelen Tab — für Modelle ohne API.
        Diese App öffnet den Tab und tauscht Daten per Bridge aus; das Bookmarklet aktiviert die Bridge im Streamlit-Tab.
      </p>

      {/* URL + Speichern */}
      <div className="flex flex-col gap-1.5 max-w-sm">
        <label className="text-[13px] font-medium text-[var(--tf-text)]">Streamlit-URL</label>
        <input
          value={aiConfig.endpoint}
          onChange={e => setAiConfig({ ...aiConfig, endpoint: e.target.value })}
          placeholder="http://localhost:8501"
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
          <ExternalLink size={14} className="mr-1.5" />Streamlit-Tab öffnen
        </Button>
        <Button variant="secondary" onClick={() => test.run()} disabled={test.busy || !url}>
          {test.busy ? 'Teste…' : 'Verbindung testen'}
        </Button>
        {testResult === 'success' && <Badge variant="success">Verbunden</Badge>}
        {testResult === 'error' && <Badge variant="error">Nicht erreichbar</Badge>}
      </div>
      {save.error && <p className="text-[12px] text-[var(--tf-error)]">Fehler: {save.error}</p>}
      {test.error && <p className="text-[12px] text-[var(--tf-error)]">Fehler: {test.error}</p>}

      {/* Bookmarklet */}
      <SectionHeader label="Bookmarklet installieren" />
      <div className="flex items-center gap-3 flex-wrap">
        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid -- href wird imperativ gesetzt (javascript:-Bookmarklet) */}
        <a
          ref={linkRef}
          draggable
          onClick={e => e.preventDefault()}
          className="inline-flex items-center px-4 py-2 text-[13px] font-medium text-white bg-[var(--tf-primary)] rounded-[var(--tf-radius)] cursor-grab select-none"
          title="In die Lesezeichenleiste ziehen"
        >
          TF Streamlit Bridge
        </a>
        <Button variant="secondary" onClick={() => copy.run()} disabled={copy.busy}>
          {copied ? <Check size={14} className="mr-1.5" /> : <Copy size={14} className="mr-1.5" />}
          Code kopieren
        </Button>
      </div>
      {copy.error && <p className="text-[12px] text-[var(--tf-error)]">Kopieren fehlgeschlagen: {copy.error}</p>}

      {/* Anleitung */}
      <ol className="text-[12px] text-[var(--tf-text-secondary)] list-decimal pl-5 space-y-1 max-w-2xl">
        <li>Streamlit-URL eintragen und <strong>Speichern &amp; Aktivieren</strong>.</li>
        <li>Den Button <strong>„TF Streamlit Bridge"</strong> in die Lesezeichenleiste ziehen — oder <strong>Code kopieren</strong> und ein Lesezeichen manuell anlegen (Code als Adresse einfügen).</li>
        <li><strong>Streamlit-Tab öffnen</strong> klicken.</li>
        <li>Im Streamlit-Tab das Lesezeichen anklicken — es erscheint oben rechts ein grünes Badge „TF Connected".</li>
        <li>Zurück hier: <strong>Verbindung testen</strong> → „Verbunden". Danach läuft der KI-Chat über die Bridge.</li>
      </ol>
      <p className="text-[11.5px] text-[var(--tf-text-tertiary)] max-w-2xl">
        Hinweis: Das Lesezeichen muss pro Streamlit-Tab einmal angeklickt werden (nach jedem Neuladen erneut).
      </p>
    </div>
  );
}
