import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { DirectLLMTransport } from '@/core/services/ai/transports/direct-llm';
import {
  getLlmContextTokens, setLlmContextTokens, computeVbCharCap,
  setDetectedLlmContextTokens, clearManualLlmContextTokens, getLlmContextSource,
  MIN_LLM_CONTEXT_TOKENS, MAX_LLM_CONTEXT_TOKENS, type LlmContextSource,
} from '@/core/services/ai/llm-context';
import { getLlmThinkingEnabled, setLlmThinkingEnabled } from '@/core/services/ai/llm-thinking';
import type { AIProviderConfig } from '@/core/types/config';
import { isOpenRouterEnabled, isDevContext, isDevFixturesEnabled, isLlmKontextSettingEnabled, isStreamlitBridgeEnabled } from '@/config/feature-flags';
import { AufbereitungEvalPanel } from '@/plugins/antraege/aufbereitung/eval-panel/AufbereitungEvalPanel';
import { GedaechtnisEvalPanel } from './GedaechtnisEvalPanel';
import { StreamlitBridgeSection } from './StreamlitBridgeSection';
import { SettingsSectionHeader, InfoHint } from './_shared/settings-primitives';

const inputClass = 'w-full px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

// Detail-Texte hinter dem Info-Icon (kurze Sichtbar-Zeile + Tooltip-Detail).
const KONTEXT_HINT =
  'Standard ist der interne llama.cpp-Wert; „Vom Server erkennen" liest ihn direkt aus dem laufenden Server. Längere Vorhabensbeschreibungen werden vor der Analyse automatisch gekürzt.';
const THINKING_HINT =
  'Der Denkprozess wird pro Fassung aufklappbar angezeigt. Nur die Voreinstellung — bei jeder Generierung („Neu"/„Kürzer"/„Länger") direkt per Schalter umschaltbar.';

const ALL_PROVIDERS: Array<{
  type: AIProviderConfig['type']; label: string; description: string;
  defaultEndpoint: string; defaultModel: string;
}> = [
  { type: 'openrouter', label: 'OpenRouter', description: 'Zugang zu 200+ Modellen via API',
    defaultEndpoint: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-oss-120b' },
  { type: 'internal', label: 'Intern API', description: 'Lokales LLM auf diesem Rechner',
    defaultEndpoint: 'http://localhost:9090/v1', defaultModel: '' },
  { type: 'cloud', label: 'Cloud API', description: 'OpenAI, Azure, kompatible APIs',
    defaultEndpoint: '', defaultModel: '' },
  { type: 'streamlit', label: 'Streamlit Bridge', description: 'Verbindung ueber Streamlit-App',
    defaultEndpoint: 'https://gpt.vdivde-it.de/', defaultModel: '' },
];

// In Builds ohne OpenRouter-Freigabe wird die Option komplett ausgeblendet,
// damit echte Daten nicht versehentlich an Cloud-APIs gehen.
const PROVIDERS = ALL_PROVIDERS.filter(p => p.type !== 'openrouter' || isOpenRouterEnabled());

const COMMON_MODELS = [
  { value: 'openai/gpt-oss-120b', label: 'gpt-oss-120b (Empfohlen)' },
  { value: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 120B (Gratis)' },
  { value: 'google/gemma-4-31b-it', label: 'Gemma 4 31B' },
  { value: 'google/gemma-4-26b-a4b-it', label: 'Gemma 4 26B A4B (MoE)' },
  { value: 'qwen/qwen3.6-27b', label: 'Qwen 3.6 27B (Thinking)' },
  { value: 'qwen/qwen3.6-35b-a3b', label: 'Qwen 3.6 35B A3B (Thinking)' },
  { value: 'custom', label: 'Eigenes Modell...' },
];

interface AIProviderTabProps {
  aiConfig: AIProviderConfig;
  setAiConfig: (config: AIProviderConfig) => void;
}

export function AIProviderTab({ aiConfig, setAiConfig }: AIProviderTabProps): React.ReactElement {
  const storage = useStorage();
  const aiBridge = useAIBridge();
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testError, setTestError] = useState('');
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const [contextTokens, setContextTokens] = useState(getLlmContextTokens());
  const [contextInput, setContextInput] = useState(String(getLlmContextTokens()));
  const [contextSource, setContextSource] = useState<LlmContextSource>(getLlmContextSource());
  const [detectedTokens, setDetectedTokens] = useState<number | null>(null);
  const [thinkingEnabled, setThinkingEnabled] = useState(getLlmThinkingEnabled());

  // Wirksamen Kontextwert + Quelle nach einer Änderung (Commit/Erkennen/Reset) nachziehen.
  const syncContextState = (): void => {
    const eff = getLlmContextTokens();
    setContextTokens(eff);
    setContextInput(String(eff));
    setContextSource(getLlmContextSource());
  };

  // Auto-Detect: Kontextfenster vom laufenden llama.cpp-Server (/props) übernehmen.
  // Nur sinnvoll bei Direct-LLM-Endpunkten (internal/cloud) — Bridge/nicht erreichbar
  // → null → wir behalten den bisherigen Wert.
  const erkennen = useAsyncAction(async () => {
    const transport = new DirectLLMTransport(aiConfig.endpoint, aiConfig.model, aiConfig.apiKey || undefined);
    const n = await transport.getContextWindow();
    if (n == null) throw new Error('Kein Kontextfenster vom Server erhalten (/props nicht erreichbar).');
    setDetectedLlmContextTokens(n);
    setDetectedTokens(n);
    syncContextState();
  });

  const resetAufAutomatik = (): void => {
    clearManualLlmContextTokens();
    syncContextState();
  };

  // Hilfetext live aus der Eingabe ableiten (nicht erst nach Commit) — so passt
  // der angezeigte Zeichen-Cap immer zum gerade eingetippten Token-Wert.
  const parsedContext = parseInt(contextInput, 10);
  const liveContextTokens = Number.isFinite(parsedContext) ? parsedContext : contextTokens;

  // Commit beim Verlassen des Feldes: parsen, clampen, persistieren (kein
  // Clampen mitten im Tippen). Ungültig → auf den letzten gültigen Wert zurück.
  const commitContextTokens = (): void => {
    const n = parseInt(contextInput, 10);
    if (Number.isFinite(n)) {
      const clamped = Math.min(Math.max(n, MIN_LLM_CONTEXT_TOKENS), MAX_LLM_CONTEXT_TOKENS);
      setLlmContextTokens(clamped);
      setContextTokens(clamped);
      setContextInput(String(clamped));
      setContextSource('manuell');
    } else {
      setContextInput(String(contextTokens));
    }
  };

  const isCustomModel = !COMMON_MODELS.some(m => m.value === aiConfig.model) && aiConfig.model !== '';
  const showModelDropdown = aiConfig.type === 'openrouter' || aiConfig.type === 'cloud';

  const handleTypeChange = (type: AIProviderConfig['type']): void => {
    const preset = PROVIDERS.find(p => p.type === type);
    setAiConfig({ ...aiConfig, type, endpoint: preset?.defaultEndpoint ?? aiConfig.endpoint, model: preset?.defaultModel ?? aiConfig.model });
    setTestResult(null);
  };

  const handleModelSelect = (value: string): void => {
    if (value === 'custom') {
      setCustomModel(aiConfig.model);
      setAiConfig({ ...aiConfig, model: '' });
    } else {
      setAiConfig({ ...aiConfig, model: value });
    }
  };

  const handleTest = async (): Promise<void> => {
    setTesting(true); setTestResult(null);
    try {
      const transport = new DirectLLMTransport(aiConfig.endpoint, aiConfig.model, aiConfig.apiKey || undefined);
      const ok = await transport.ping();
      setTestResult(ok ? 'success' : 'error');
      setTestError(ok ? '' : 'Nicht erreichbar');
    } catch (err) {
      setTestResult('error');
      setTestError(err instanceof Error ? err.message : 'Fehler');
    } finally { setTesting(false); setTimeout(() => setTestResult(null), 5000); }
  };

  const handleSave = async (): Promise<void> => {
    await storage.idb.set('ai-provider', aiConfig);
    aiBridge.switchProvider(aiConfig);
    setSaved(true); setTimeout(() => setSaved(false), 3000);
    // Komfort: Kontextfenster im Hintergrund vom Server erkennen (Direct-LLM-Endpunkte).
    if (aiConfig.type === 'internal' || aiConfig.type === 'cloud') {
      void new DirectLLMTransport(aiConfig.endpoint, aiConfig.model, aiConfig.apiKey || undefined)
        .getContextWindow()
        .then(n => { if (n != null) { setDetectedLlmContextTokens(n); setDetectedTokens(n); syncContextState(); } })
        .catch(() => { /* best-effort — Fallback bleibt der gespeicherte/Default-Wert */ });
    }
  };

  const selectedDropdownValue = isCustomModel || aiConfig.model === '' ? 'custom' : aiConfig.model;

  return (
    <div className="space-y-5">
      {/* LLM-Kontextlänge + Reasoning/Thinking — nur wo die LLM-Skill-Generierung
          läuft (dev + pl, via isLlmKontextSettingEnabled). Sonst (prod/kurator, wo
          der Tab nur wegen der Streamlit-Bridge erscheint) ausgeblendet. Daraus wird
          der VB-Schwellwert abgeleitet: zu lange VBs werden vor dem Senden gekürzt. */}
      {isLlmKontextSettingEnabled() && (
      <section id="sec-kontext" className="scroll-mt-20 space-y-5">
      <SettingsSectionHeader label="LLM & Reasoning" />
      <div className="flex flex-col gap-1.5 max-w-sm">
        <div className="flex items-center gap-1.5">
          <label className="text-[13px] font-medium text-[var(--tf-text)]">Kontextfenster (Tokens)</label>
          <InfoHint text={KONTEXT_HINT} />
        </div>
        <input
          type="number"
          min={MIN_LLM_CONTEXT_TOKENS}
          max={MAX_LLM_CONTEXT_TOKENS}
          step={1024}
          value={contextInput}
          onChange={e => setContextInput(e.target.value)}
          onBlur={commitContextTokens}
          className={inputClass}
          style={inputStyle}
        />
        <div className="flex items-center gap-3 flex-wrap text-[11.5px]">
          <span className="text-[var(--tf-text-tertiary)]">
            Quelle: {contextSource === 'manuell' ? 'manuell gesetzt' : contextSource === 'erkannt' ? 'automatisch erkannt' : 'Standardwert'}
          </span>
          <button
            type="button"
            onClick={() => erkennen.run()}
            disabled={erkennen.busy}
            className="text-[var(--tf-primary)] hover:underline disabled:opacity-50"
          >
            {erkennen.busy ? 'Erkenne…' : 'Vom Server erkennen'}
          </button>
          {contextSource === 'manuell' && (
            <button
              type="button"
              onClick={resetAufAutomatik}
              className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]"
            >
              Auf Automatik zurücksetzen
            </button>
          )}
        </div>
        {erkennen.error && (
          <p className="text-[11.5px] text-[var(--tf-danger-text)]">{erkennen.error}</p>
        )}
        {detectedTokens != null && !erkennen.error && (
          <p className="text-[11.5px] text-[var(--tf-success-text)]">
            Server meldet {detectedTokens.toLocaleString('de-DE')} Tokens{contextSource === 'manuell' ? ' (manueller Wert bleibt aktiv — „Auf Automatik zurücksetzen", um ihn zu nutzen)' : ''}.
          </p>
        )}
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          Max. Tokens des LLM. Daraus folgt die VB-Länge — aktuell{' '}
          <strong>~{computeVbCharCap(liveContextTokens).toLocaleString('de-DE')} Zeichen</strong>.
        </p>
      </div>

      {/* Reasoning/Thinking — steuert die KI-Skill-Generierung (z.B. die
          Gutachten-Kurzfassung). Wirkt nur bei Modellen mit Reasoning. Ohne
          eigenen Header — teilt sich mit der Kontextlänge den Abschnitt „LLM & Reasoning". */}
      <div className="flex items-start gap-3 max-w-sm">
        <Switch
          checked={thinkingEnabled}
          onCheckedChange={v => { setThinkingEnabled(v); setLlmThinkingEnabled(v); }}
        />
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <label className="text-[13px] font-medium text-[var(--tf-text)]">Thinking nutzen (Standard)</label>
            <InfoHint text={THINKING_HINT} />
          </div>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Lässt das LLM vor der Antwort „nachdenken" — oft bessere Ergebnisse, aber langsamer.
          </p>
        </div>
      </div>
      </section>
      )}

      {/* Streamlit-Bridge-Installer — sichtbar dev + prod + kurator + pl.
          Eigene Save/Ping-Logik, unabhängig vom dev-only Provider-Switcher. */}
      {isStreamlitBridgeEnabled() && (
        <StreamlitBridgeSection aiConfig={aiConfig} setAiConfig={setAiConfig} />
      )}

      {/* Provider-Switcher nur im Entwickler-Kontext — in Produktiv-Varianten ist
          der Endpoint via Build-Config fix verdrahtet. */}
      {isDevContext() && (
      <section id="sec-provider" className="scroll-mt-20 space-y-5">
      {/* Provider-Auswahl als 2x2 Grid */}
      <SettingsSectionHeader label="Provider" />
      <div className="grid grid-cols-2 gap-2">
        {PROVIDERS.map(p => (
          <button key={p.type} onClick={() => handleTypeChange(p.type)}
            className="text-left px-4 py-3 rounded-[var(--tf-radius)] cursor-pointer transition-colors"
            style={{
              border: aiConfig.type === p.type ? '1px solid var(--tf-text)' : '0.5px solid var(--tf-border)',
              background: aiConfig.type === p.type ? 'var(--tf-bg-secondary)' : 'transparent',
            }}>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-[var(--tf-text)]">{p.label}</span>
              {aiConfig.type === p.type && <Badge variant="info">Aktiv</Badge>}
            </div>
            <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-0.5">{p.description}</p>
          </button>
        ))}
      </div>

      {/* Konfiguration */}
      <SettingsSectionHeader label="Konfiguration" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[var(--tf-text)]">Endpoint</label>
          <input value={aiConfig.endpoint}
            onChange={e => setAiConfig({ ...aiConfig, endpoint: e.target.value })}
            className={inputClass} style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[var(--tf-text)]">Standard-Modell</label>
          {showModelDropdown ? (
            <>
              <select value={selectedDropdownValue}
                onChange={e => handleModelSelect(e.target.value)}
                className={inputClass} style={inputStyle}>
                {COMMON_MODELS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              {(selectedDropdownValue === 'custom') && (
                <input value={isCustomModel ? aiConfig.model : customModel}
                  onChange={e => setAiConfig({ ...aiConfig, model: e.target.value })}
                  placeholder="z.B. meta-llama/llama-3.3-8b-instruct"
                  className={inputClass} style={inputStyle} />
              )}
            </>
          ) : (
            <input value={aiConfig.model}
              onChange={e => setAiConfig({ ...aiConfig, model: e.target.value })}
              placeholder="Modell-ID (optional)"
              className={inputClass} style={inputStyle} />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--tf-text)]">API Key</label>
        <div className="relative">
          <input type={showKey ? 'text' : 'password'} value={aiConfig.apiKey}
            onChange={e => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
            placeholder="sk-or-... (OpenRouter) oder sk-... (OpenAI)"
            className={`${inputClass} pr-10`} style={inputStyle} />
          <button onClick={() => setShowKey(prev => !prev)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer">
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      {/* Aktionen */}
      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={handleTest} disabled={testing || !aiConfig.endpoint}>
          {testing ? 'Teste...' : 'Verbindung testen'}
        </Button>
        {testResult === 'success' && <Badge variant="success">Verbunden</Badge>}
        {testResult === 'error' && <Badge variant="error">{testError || 'Nicht erreichbar'}</Badge>}
      </div>

      <div className="flex items-center gap-3 pt-2" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <Button onClick={handleSave}>Speichern & Aktivieren</Button>
        {saved && <Badge variant="success">Provider aktiviert</Badge>}
      </div>
      </section>
      )}

      {/* Antrag-Aufbereitung: In-App-Baustein-Eval — nur dev (fiktive Fixtures via
          loadEvalFixtures). Die 2-MB-VBs bleiben über den dev-Guard aus prod/pl/as/
          kurator raus; das Panel misst die Bausteine über die Bridge (kein Cache). */}
      {isDevFixturesEnabled() && (
      <section id="sec-aufbereitung-eval" className="scroll-mt-20 space-y-3">
        <SettingsSectionHeader label="Aufbereitung: Baustein-Eval" />
        <AufbereitungEvalPanel />
      </section>
      )}

      {/* Assistent-Gedächtnis: In-App-Eval der Konsolidierung — nur dev (fiktive
          Fixtures, interne Bridge/Qwen). Misst über die Bridge, schreibt NICHT in
          den Gedächtnis-Store; braucht das assistentGedaechtnis-Flag nicht. */}
      {isDevFixturesEnabled() && (
      <section id="sec-gedaechtnis-eval" className="scroll-mt-20 space-y-3">
        <SettingsSectionHeader label="Assistent-Gedächtnis: Eval" />
        <GedaechtnisEvalPanel />
      </section>
      )}
    </div>
  );
}
