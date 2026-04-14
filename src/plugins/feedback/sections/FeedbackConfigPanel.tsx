// Admin-Einstellungen: LLM-Modell, Max-Turns, System-Prompt-Pfad + Vorschau,
// Shared-File Status + "System-Prompt initialisieren"-Button.

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
import { DEFAULT_FEEDBACK_CONFIG } from '@/core/types/feedback';
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
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [initStatus, setInitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    void loadFeedbackConfig(storage).then(setCfg);
    void getSharedFileStatus(storage).then(setShared);
  }, [storage]);

  const handleSave = async (): Promise<void> => {
    await saveFeedbackConfig(storage, cfg);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1500);
  };

  const handlePreview = async (): Promise<void> => {
    setPromptPreview(await loadSystemPrompt(storage));
  };

  const handleInit = async (): Promise<void> => {
    const ok = await initSystemPromptFile(storage);
    setInitStatus(ok ? 'success' : 'error');
    if (ok) setShared(await getSharedFileStatus(storage));
    setTimeout(() => setInitStatus('idle'), 2000);
  };

  const fsConnected = storage.isFileServerConnected();

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <label className="text-[11px] text-[var(--tf-text-tertiary)]">LLM-Modell für Chatbot</label>
        <select value={cfg.llm_model} onChange={e => setCfg({ ...cfg, llm_model: e.target.value })} className={inputClass} style={inputStyle}>
          {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <p className="text-[10.5px] text-[var(--tf-text-tertiary)] mt-1">
          Hinweis: Aktuell nutzt der Chatbot den global konfigurierten Provider (siehe Einstellungen → KI-Assistent).
        </p>
      </div>

      <div>
        <label className="text-[11px] text-[var(--tf-text-tertiary)]">Max. Chatbot-Nachrichten: {cfg.max_chatbot_turns}</label>
        <input type="range" min={2} max={12} step={1} value={cfg.max_chatbot_turns} onChange={e => setCfg({ ...cfg, max_chatbot_turns: Number(e.target.value) })} className="w-full mt-1.5 cursor-pointer accent-[var(--tf-primary)]" />
      </div>

      <div className="p-3 rounded-[var(--tf-radius)] space-y-2" style={inputStyle}>
        <p className="text-[12px] font-medium text-[var(--tf-text)]">System-Prompt</p>
        <p className="text-[11.5px] text-[var(--tf-text-secondary)] font-mono">Datenverzeichnis/{cfg.system_prompt_path}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handlePreview} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[var(--tf-radius)] text-[11.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer" style={inputStyle}>
            <Eye size={11} /> Prompt-Vorschau
          </button>
          {fsConnected && shared && !shared.exists && (
            <button type="button" onClick={handleInit} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[var(--tf-radius)] text-[11.5px] text-[var(--tf-primary)] hover:bg-[var(--tf-hover)] cursor-pointer" style={inputStyle}>
              <FileCog size={11} /> System-Prompt initialisieren
            </button>
          )}
        </div>
        {initStatus === 'success' && <p className="text-[11px] text-emerald-600 dark:text-emerald-400">✓ Prompt-Datei wurde im Datenverzeichnis erstellt.</p>}
        {initStatus === 'error' && <p className="text-[11px] text-red-600 dark:text-red-400">⚠ Konnte Datei nicht schreiben (Datenverzeichnis nicht verbunden oder schreibgeschützt).</p>}
        {promptPreview !== null && (
          <pre className="mt-2 p-2 rounded text-[10.5px] font-mono whitespace-pre-wrap bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] max-h-60 overflow-y-auto">{promptPreview}</pre>
        )}
      </div>

      <div className="p-3 rounded-[var(--tf-radius)] space-y-1" style={inputStyle}>
        <p className="text-[12px] font-medium text-[var(--tf-text)]">Geteilte Feedback-Datei</p>
        <p className="text-[11.5px] text-[var(--tf-text-secondary)] font-mono">Datenverzeichnis/{cfg.shared_feedback_path}</p>
        {!fsConnected ? (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">⚠ Datenverzeichnis nicht verbunden — Feedback wird nur lokal gespeichert.</p>
        ) : shared?.exists ? (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">✓ Gefunden · {shared.itemCount} {shared.itemCount === 1 ? 'Eintrag' : 'Einträge'} · zuletzt {shared.updatedAt ? new Date(shared.updatedAt).toLocaleString('de-DE') : '–'}</p>
        ) : (
          <p className="text-[11px] text-[var(--tf-text-tertiary)]">Noch nicht erstellt (wird beim ersten Feedback-Submit angelegt).</p>
        )}
      </div>

      <button type="button" onClick={handleSave} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--tf-radius)] text-[12.5px] font-medium bg-[var(--tf-primary)] text-white hover:opacity-90 cursor-pointer">
        {savedNotice ? <Check size={13} /> : null}
        {savedNotice ? 'Gespeichert' : 'Einstellungen speichern'}
      </button>
    </div>
  );
}
