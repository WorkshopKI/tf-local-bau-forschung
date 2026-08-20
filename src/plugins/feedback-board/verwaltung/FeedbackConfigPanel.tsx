// Admin-Reiter „Einstellungen": Dateien & Speicher — System-Prompt und der
// Zustand der geteilten Feedback-Datei.
//
// Die Spalte „Feedback-Chatbot" (LLM-Modell + max. Nachrichten) ist mit v4.129
// entfallen. Sie sah aus wie eine Einstellung, war aber keine: beide Werte
// hatten außerhalb dieses Formulars keinen Leser — das Modell entscheidet der
// globale KI-Transport. Damit ist der Reiter reine ANZEIGE und braucht auch
// keinen „Einstellungen speichern"-Knopf mehr.

import { useEffect, useState } from 'react';
import { Check, Eye, FileCog } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import {
  getSharedFileStatus,
  initSystemPromptFile,
  loadFeedbackConfig,
  loadSystemPrompt,
  systemPromptFileExists,
} from '@/core/services/feedback';
import type { SharedFileStatus } from '@/core/services/feedback';
import { DEFAULT_FEEDBACK_CONFIG } from '@/core/types/feedback';
import type { FeedbackConfig } from '@/core/types/feedback';

const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

export function FeedbackConfigPanel(): React.ReactElement {
  const storage = useStorage();
  const [cfg, setCfg] = useState<FeedbackConfig>(DEFAULT_FEEDBACK_CONFIG);
  const [shared, setShared] = useState<SharedFileStatus | null>(null);
  const [promptExists, setPromptExists] = useState<boolean | null>(null);
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const [initStatus, setInitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const refreshStatus = async (): Promise<void> => {
    setShared(await getSharedFileStatus(storage));
    setPromptExists(await systemPromptFileExists(storage));
  };

  useEffect(() => {
    void loadFeedbackConfig(storage).then(setCfg);
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage]);

  const handleInit = async (): Promise<void> => {
    const ok = await initSystemPromptFile(storage);
    setInitStatus(ok ? 'success' : 'error');
    if (ok) await refreshStatus();
    setTimeout(() => setInitStatus('idle'), 2000);
  };

  // KEIN `storage.isFileServerConnected()` mehr (v3.7): das fragt die Legacy-
  // `storage.fs`-Registrierung, die der moderne Welcome/Startup-Flow nie füllt —
  // der Reiter meldete deshalb „Datenverzeichnis nicht verbunden", während
  // daneben die Ticketzahl aus genau dieser Datei stand. Maßgeblich ist die
  // LAGE der Datei selbst (über den Daten-Share-Handle gelesen).
  const shareVerbunden = shared !== null && shared.lage !== 'kein-share';

  return (
    <div className="space-y-4">
      <div className="max-w-xl">
        <div className="space-y-4">
          <h2 className="text-[13px] font-medium text-[var(--tf-text)]">Dateien & Speicher</h2>

          {/* System-Prompt */}
          <div className="p-3 rounded-[var(--tf-radius)] space-y-1.5" style={inputStyle}>
            <p className="text-[12px] font-medium text-[var(--tf-text)]">System-Prompt</p>
            <p className="text-[11px] text-[var(--tf-text-secondary)] font-mono">{cfg.system_prompt_path}</p>
            <div className="flex flex-wrap items-center gap-2">
              {promptExists === true && (
                <span className="inline-flex items-center gap-1 text-[10.5px] text-[var(--tf-success-text)]"><Check size={11} /> Datei vorhanden</span>
              )}
              <button type="button" onClick={async () => setPromptPreview(await loadSystemPrompt(storage))} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--tf-radius)] text-[11px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer" style={inputStyle}>
                <Eye size={10} /> Vorschau
              </button>
              {promptExists === false && (
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
            {!shareVerbunden ? (
              <p className="text-[10.5px] text-[var(--tf-warning-text)]">Datenverzeichnis nicht verbunden</p>
            ) : shared!.lage === 'unlesbar' ? (
              <p className="text-[10.5px] text-[var(--tf-danger-text)]">
                Datei vorhanden, aber gerade nicht lesbar — Änderungen werden abgelehnt, statt den Bestand zu überschreiben.
              </p>
            ) : shared!.lage === 'ok' ? (
              <p className="text-[10.5px] text-[var(--tf-success-text)]">
                <Check size={10} className="inline mr-0.5" />{shared!.itemCount} {shared!.itemCount === 1 ? 'Eintrag' : 'Einträge'} · zuletzt {shared!.updatedAt ? new Date(shared!.updatedAt).toLocaleDateString('de-DE') : '–'}
              </p>
            ) : (
              <p className="text-[10.5px] text-[var(--tf-text-tertiary)]">Noch nicht erstellt</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
