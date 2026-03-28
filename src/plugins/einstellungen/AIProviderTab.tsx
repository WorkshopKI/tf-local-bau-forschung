import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Badge, SectionHeader } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { DirectLLMTransport } from '@/core/services/ai/transports/direct-llm';
import type { AIProviderConfig } from '@/core/types/config';

const inputClass = 'w-full px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

const PROVIDERS: Array<{ type: AIProviderConfig['type']; label: string; defaultEndpoint: string; defaultModel: string }> = [
  { type: 'streamlit', label: 'Streamlit Bridge', defaultEndpoint: 'http://localhost:8501', defaultModel: '' },
  { type: 'llama-local', label: 'llama.cpp (lokal)', defaultEndpoint: 'http://localhost:8080', defaultModel: '' },
  { type: 'openrouter', label: 'OpenRouter', defaultEndpoint: 'https://openrouter.ai/api/v1', defaultModel: 'gpt-oss120B' },
  { type: 'cloud', label: 'Cloud API (OpenAI-kompatibel)', defaultEndpoint: '', defaultModel: '' },
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

  const handleTypeChange = (type: AIProviderConfig['type']): void => {
    const preset = PROVIDERS.find(p => p.type === type);
    setAiConfig({ ...aiConfig, type, endpoint: preset?.defaultEndpoint ?? aiConfig.endpoint, model: preset?.defaultModel ?? aiConfig.model });
    setTestResult(null);
  };

  const handleTest = async (): Promise<void> => {
    setTesting(true);
    setTestResult(null);
    try {
      const transport = new DirectLLMTransport(aiConfig.endpoint, aiConfig.model, aiConfig.apiKey || undefined);
      const ok = await transport.ping();
      setTestResult(ok ? 'success' : 'error');
      setTestError(ok ? '' : 'Nicht erreichbar');
    } catch (err) {
      setTestResult('error');
      setTestError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const handleSave = async (): Promise<void> => {
    await storage.idb.set('ai-provider', aiConfig);
    aiBridge.switchProvider(aiConfig);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-4">
      <SectionHeader label="Provider auswählen" />
      {PROVIDERS.map(p => (
        <label key={p.type} className="flex items-center gap-3 py-2 cursor-pointer" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
          <input type="radio" name="ai-provider" checked={aiConfig.type === p.type}
            onChange={() => handleTypeChange(p.type)} className="accent-[var(--tf-text)]" />
          <span className="text-[13px] text-[var(--tf-text)]">{p.label}</span>
          {aiConfig.type === p.type && <Badge variant="info">Aktiv</Badge>}
        </label>
      ))}

      <SectionHeader label="Konfiguration" />
      <div className="space-y-3 mt-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[var(--tf-text)]">Endpoint</label>
          <input value={aiConfig.endpoint} onChange={e => setAiConfig({ ...aiConfig, endpoint: e.target.value })} className={inputClass} style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[var(--tf-text)]">Model</label>
          <input value={aiConfig.model} onChange={e => setAiConfig({ ...aiConfig, model: e.target.value })} placeholder="z.B. gpt-oss120B" className={inputClass} style={inputStyle} />
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
    </div>
  );
}
