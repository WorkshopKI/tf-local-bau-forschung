import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Badge, SectionHeader } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { DirectLLMTransport } from '@/core/services/ai/transports/direct-llm';
import type { AIProviderConfig } from '@/core/types/config';
import { isOpenRouterEnabled } from '@/config/feature-flags';

const inputClass = 'w-full px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

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
    defaultEndpoint: 'http://localhost:8501', defaultModel: '' },
];

// In Builds ohne OpenRouter-Freigabe wird die Option komplett ausgeblendet,
// damit echte Daten nicht versehentlich an Cloud-APIs gehen.
const PROVIDERS = ALL_PROVIDERS.filter(p => p.type !== 'openrouter' || isOpenRouterEnabled());

const COMMON_MODELS = [
  { value: 'openai/gpt-oss-120b', label: 'gpt-oss-120b (Empfohlen)' },
  { value: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 120B (Gratis)' },
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
  };

  const selectedDropdownValue = isCustomModel || aiConfig.model === '' ? 'custom' : aiConfig.model;

  return (
    <div className="space-y-5">
      {/* Provider-Auswahl als 2x2 Grid */}
      <SectionHeader label="Provider" />
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
      <SectionHeader label="Konfiguration" />
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
    </div>
  );
}
