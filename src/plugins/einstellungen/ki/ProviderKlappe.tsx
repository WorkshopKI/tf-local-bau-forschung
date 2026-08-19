/**
 * Provider-Umschalter (nur dev) — bis v4.30 die Sektion `sec-provider`.
 *
 * In Produktiv-Varianten ist der Endpoint über die Build-Config fest verdrahtet;
 * dieser Weg existiert nur im Entwickler-Kontext und steht deshalb eingeklappt
 * unter der eigentlichen Verbindung.
 */
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { DirectLLMTransport } from '@/core/services/ai/transports/direct-llm';
import { setDetectedLlmContextTokens } from '@/core/services/ai/llm-context';
import type { AIProviderConfig } from '@/core/types/config';
import { isOpenRouterEnabled } from '@/config/feature-flags';
import { SettingsKlappe } from '@/components/settings';

const inputClass =
  'w-full px-2.5 py-1.5 text-[12.5px] bg-[var(--tf-bg)] text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const inputStyle = { border: '0.5px solid var(--tf-border-hover)' } as const;

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
  { type: 'streamlit', label: 'Streamlit Bridge', description: 'Verbindung über Streamlit-App',
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
  { value: 'custom', label: 'Eigenes Modell…' },
];

export function ProviderKlappe({
  aiConfig,
  setAiConfig,
}: {
  aiConfig: AIProviderConfig;
  setAiConfig: (config: AIProviderConfig) => void;
}): React.ReactElement {
  const storage = useStorage();
  const aiBridge = useAIBridge();
  const [zeigeKey, setZeigeKey] = useState(false);
  const [testErgebnis, setTestErgebnis] = useState<'success' | 'error' | null>(null);
  const [testFehler, setTestFehler] = useState('');
  const [testet, setTestet] = useState(false);
  const [gespeichert, setGespeichert] = useState(false);
  /**
   * Steht die Modell-Auswahl auf „Eigenes Modell…"?
   *
   * Als eigener Zustand, nicht aus `aiConfig.model` abgeleitet: bis v4.116
   * merkte sich der Wechsel den bisherigen Namen lokal und setzte `model` auf
   * `''`, damit die Auswahl nicht auf die Vorgabe zurückschnappt. Das Textfeld
   * zeigte dann den gemerkten Namen, während in der Konfiguration nichts stand
   * — „Speichern & Aktivieren" schrieb ein leeres Modell, obwohl im Feld eines
   * stand. Jetzt bleibt der Wert stehen und das Feld zeigt genau ihn.
   */
  const [eigenModus, setEigenModus] = useState(false);

  const istEigenesModell = !COMMON_MODELS.some(m => m.value === aiConfig.model) && aiConfig.model !== '';
  const zeigeModellListe = aiConfig.type === 'openrouter' || aiConfig.type === 'cloud';
  const dropdownWert = eigenModus || istEigenesModell || aiConfig.model === '' ? 'custom' : aiConfig.model;

  const typWechseln = (type: AIProviderConfig['type']): void => {
    const preset = PROVIDERS.find(p => p.type === type);
    setAiConfig({
      ...aiConfig,
      type,
      // `||` statt `??`: eine Vorgabe OHNE eigene Adresse („Cloud API") darf die
      // eingetragene nicht löschen. Dieses Feld ist geteilt — es trägt zugleich
      // die „Adresse der internen KI" der Karte darüber, und ein Kachelklick
      // hier leerte sie bis v4.116 ersatzlos.
      endpoint: preset?.defaultEndpoint || aiConfig.endpoint,
      model: preset?.defaultModel ?? aiConfig.model,
    });
    setEigenModus(false);
    setTestErgebnis(null);
  };

  const modellWaehlen = (wert: string): void => {
    if (wert === 'custom') {
      setEigenModus(true);
    } else {
      setEigenModus(false);
      setAiConfig({ ...aiConfig, model: wert });
    }
  };

  const testen = async (): Promise<void> => {
    setTestet(true); setTestErgebnis(null);
    try {
      const transport = new DirectLLMTransport(aiConfig.endpoint, aiConfig.model, aiConfig.apiKey || undefined);
      const ok = await transport.ping(); // allow-oeffnender-ping: „Verbindung testen"-Knopf, DirectLLM (kein Fenster)
      setTestErgebnis(ok ? 'success' : 'error');
      setTestFehler(ok ? '' : 'Nicht erreichbar');
    } catch (err) {
      setTestErgebnis('error');
      setTestFehler(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setTestet(false);
      setTimeout(() => setTestErgebnis(null), 5000);
    }
  };

  const speichern = async (): Promise<void> => {
    await storage.idb.set('ai-provider', aiConfig);
    aiBridge.switchProvider(aiConfig);
    setGespeichert(true);
    setTimeout(() => setGespeichert(false), 3000);
    // Komfort: Kontextfenster im Hintergrund vom Server erkennen (Direct-LLM).
    if (aiConfig.type === 'internal' || aiConfig.type === 'cloud') {
      void new DirectLLMTransport(aiConfig.endpoint, aiConfig.model, aiConfig.apiKey || undefined)
        .getContextWindow()
        .then(n => { if (n != null) setDetectedLlmContextTokens(n); })
        .catch(() => { /* best-effort — Fallback bleibt der gespeicherte Wert */ });
    }
  };

  return (
    <SettingsKlappe
      id="sec-provider"
      label="Provider (dev)"
      storageKey="teamflow_settings_provider_collapsed"
      zaehler={PROVIDERS.find(p => p.type === aiConfig.type)?.label}
    >
      <div className="grid grid-cols-2 gap-2 mb-3">
        {PROVIDERS.map(p => (
          <button
            key={p.type}
            type="button"
            onClick={() => typWechseln(p.type)}
            className="text-left px-3 py-2.5 rounded-[var(--tf-radius)] cursor-pointer transition-colors"
            style={{
              border: aiConfig.type === p.type ? '1px solid var(--tf-text)' : '0.5px solid var(--tf-border)',
              background: aiConfig.type === p.type ? 'var(--tf-bg-secondary)' : 'transparent',
            }}
          >
            <span className="flex items-center gap-2">
              <span className="text-[12.5px] font-medium text-[var(--tf-text)]">{p.label}</span>
              {aiConfig.type === p.type && <Badge variant="info">Aktiv</Badge>}
            </span>
            <span className="block text-[11px] text-[var(--tf-text-tertiary)] mt-0.5">{p.description}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 mb-3">
        <label>
          <span className="block text-[12.5px] text-[var(--tf-text-secondary)] mb-1">Endpoint</span>
          <input
            value={aiConfig.endpoint}
            onChange={e => setAiConfig({ ...aiConfig, endpoint: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
        </label>
        <label>
          <span className="block text-[12.5px] text-[var(--tf-text-secondary)] mb-1">Standard-Modell</span>
          {zeigeModellListe ? (
            <>
              <select value={dropdownWert} onChange={e => modellWaehlen(e.target.value)} className={inputClass} style={inputStyle}>
                {COMMON_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              {dropdownWert === 'custom' && (
                <input
                  value={aiConfig.model}
                  onChange={e => setAiConfig({ ...aiConfig, model: e.target.value })}
                  placeholder="z.B. meta-llama/llama-3.3-8b-instruct"
                  className={`${inputClass} mt-1.5`}
                  style={inputStyle}
                />
              )}
            </>
          ) : (
            <input
              value={aiConfig.model}
              onChange={e => setAiConfig({ ...aiConfig, model: e.target.value })}
              placeholder="Modell-ID (optional)"
              className={inputClass}
              style={inputStyle}
            />
          )}
        </label>
      </div>

      <label className="block mb-3">
        <span className="block text-[12.5px] text-[var(--tf-text-secondary)] mb-1">API-Key</span>
        <span className="relative block">
          <input
            type={zeigeKey ? 'text' : 'password'}
            value={aiConfig.apiKey}
            onChange={e => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
            placeholder="sk-or-… (OpenRouter) oder sk-… (OpenAI)"
            className={`${inputClass} pr-9`}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setZeigeKey(v => !v)}
            aria-label={zeigeKey ? 'API-Key verbergen' : 'API-Key anzeigen'}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
          >
            {zeigeKey ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </span>
      </label>

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="secondary" size="sm" onClick={testen} disabled={testet || !aiConfig.endpoint}>
          {testet ? 'Teste…' : 'Verbindung testen'}
        </Button>
        {testErgebnis === 'success' && <Badge variant="success">Verbunden</Badge>}
        {testErgebnis === 'error' && <Badge variant="error">{testFehler || 'Nicht erreichbar'}</Badge>}
        <span className="flex-1" />
        <Button size="sm" onClick={speichern}>Speichern &amp; Aktivieren</Button>
        {gespeichert && <Badge variant="success">Provider aktiviert</Badge>}
      </div>
    </SettingsKlappe>
  );
}
