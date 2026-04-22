// Admin-Einstellungen: 2-Spalten-Layout (Chatbot links, Dateien & Speicher rechts).

import { useEffect, useState } from 'react';
import { Check, Eye, FileCog } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import {
  getSharedFileStatus,
  initSystemPromptFile,
  loadFeedbackConfig,
  loadSystemPrompt,
  saveFeedbackConfig,
} from '@/core/services/feedback';
import { DEFAULT_FEEDBACK_CONFIG, FEEDBACK_PROMPT_FILE } from '@/core/types/feedback';
import type { FeedbackConfig } from '@/core/types/feedback';

const MODELS = [
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (OpenRouter)' },
  { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { id: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { id: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
];

const inputClass = 'w-full px-2.5 py-1.5 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

export function FeedbackConfigPanel(): React.ReactElement {
  const storage = useStorage();
  const [cfg, setCfg] = useState<FeedbackConfig>(DEFAULT_FEEDBACK_CONFIG);
  const [shared, setShared] = useState<{ path: string; exists: boolean; itemCount: number; updatedAt?: string } | null>(null);
  const [promptExists, setPromptExists] = useState<boolean | null>(null);
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [initStatus, setInitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const refreshStatus = async (): Promise<void> => {
    setShared(await getSharedFileStatus(storage));
    if (storage.fs) { setPromptExists(await storage.fs.exists(FEEDBACK_PROMPT_FILE)); }
    else { setPromptExists(null); }
  };

  useEffect(() => {
    void loadFeedbackConfig(storage).then(setCfg);
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage]);

  const handleSave = async (): Promise<void> => {
    await saveFeedbackConfig(storage, cfg);
    setSavedNotice(true); setTimeout(() => setSavedNotice(false), 1500);
  };

  const handleInit = async (): Promise<void> => {
    const ok = await initSystemPromptFile(storage);
    setInitStatus(ok ? 'success' : 'error');
    if (ok) await refreshStatus();
    setTimeout(() => setInitStatus('idle'), 2000);
  };

  const fsConnected = storage.isFileServerConnected();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Links: Chatbot-Einstellungen */}
        <div className="space-y-4">
          <h2 className="text-[13px] font-medium text-[var(--tf-text)]">Feedback-Chatbot</h2>
          <div>
            <label className="text-[11px] text-[var(--tf-text-tertiary)]">LLM-Modell</label>
            <select value={cfg.llm_model} onChange={e => setCfg({ ...cfg, llm_model: e.target.value })} className={inputClass} style={inputStyle}>
              {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <p className="text-[10.5px] text-[var(--tf-text-tertiary)] mt-1">Nutzt den global konfigurierten Provider</p>
          </div>
          <div>
            <label className="text-[11px] text-[var(--tf-text-tertiary)]">Max. Chatbot-Nachrichten</label>
            <div className="flex items-center gap-3">
              <input type="range" min={2} max={12} step={1} value={cfg.max_chatbot_turns} onChange={e => setCfg({ ...cfg, max_chatbot_turns: Number(e.target.value) })} className="flex-1 cursor-pointer accent-[var(--tf-primary)]" />
              <span className="text-[13px] font-medium text-[var(--tf-text)] tabular-nums w-6 text-right">{cfg.max_chatbot_turns}</span>
            </div>
          </div>
        </div>

        {/* Rechts: Dateien & Speicher */}
        <div className="space-y-4">
          <h2 className="text-[13px] font-medium text-[var(--tf-text)]">Dateien & Speicher</h2>

          {/* System-Prompt */}
          <div className="p-3 rounded-[var(--tf-radius)] space-y-1.5" style={inputStyle}>
            <p className="text-[12px] font-medium text-[var(--tf-text)]">System-Prompt</p>
            <p className="text-[11px] text-[var(--tf-text-secondary)] font-mono">{cfg.system_prompt_path}</p>
            <div className="flex flex-wrap items-center gap-2">
              {fsConnected && promptExists === true && (
                <span className="inline-flex items-center gap-1 text-[10.5px] text-[var(--tf-success-text)]"><Check size={11} /> Datei vorhanden</span>
              )}
              <button type="button" onClick={async () => setPromptPreview(await loadSystemPrompt(storage))} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--tf-radius)] text-[11px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer" style={inputStyle}>
                <Eye size={10} /> Vorschau
              </button>
              {fsConnected && promptExists === false && (
                <button type="button" onClick={handleInit} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--tf-radius)] text-[11px] text-[var(--tf-primary)] hover:bg-[var(--tf-hover)] cursor-pointer" style={inputStyle}>
                  <FileCog size={10} /> Initialisieren
                </button>
              )}
            </div>
            {initStatus === 'success' && <p className="text-[10.5px] text-[var(--tf-success-text)]">Prompt-Datei erstellt.</p>}
            {initStatus === 'error' && <p className="text-[10.5px] text-[var(--tf-danger-text)]">Konnte Datei nicht schreiben.</p>}
            {promptPreview !== null && (
              <pre className="mt-1.5 p-2 rounded text-[10px] font-mono whitespace-pre-wrap bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] max-h-48 overflow-y-auto">{promptPreview}</pre>
            )}
          </div>

          {/* Geteilte Feedback-Datei */}
          <div className="p-3 rounded-[var(--tf-radius)] space-y-1" style={inputStyle}>
            <p className="text-[12px] font-medium text-[var(--tf-text)]">Geteilte Feedback-Datei</p>
            <p className="text-[11px] text-[var(--tf-text-secondary)] font-mono">{cfg.shared_feedback_path}</p>
            {!fsConnected ? (
              <p className="text-[10.5px] text-[var(--tf-warning-text)]">Datenverzeichnis nicht verbunden</p>
            ) : shared?.exists ? (
              <p className="text-[10.5px] text-[var(--tf-success-text)]">
                <Check size={10} className="inline mr-0.5" />{shared.itemCount} {shared.itemCount === 1 ? 'Eintrag' : 'Einträge'} · zuletzt {shared.updatedAt ? new Date(shared.updatedAt).toLocaleDateString('de-DE') : '–'}
              </p>
            ) : (
              <p className="text-[10.5px] text-[var(--tf-text-tertiary)]">Noch nicht erstellt</p>
            )}
          </div>
        </div>
      </div>

      <button type="button" onClick={handleSave} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--tf-radius)] text-[12.5px] font-medium bg-[var(--tf-primary)] text-white hover:opacity-90 cursor-pointer">
        {savedNotice ? <Check size={13} /> : null} {savedNotice ? 'Gespeichert' : 'Einstellungen speichern'}
      </button>
    </div>
  );
}
