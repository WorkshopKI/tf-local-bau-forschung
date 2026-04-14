// Detail-Panel: Metadaten, Admin-Felder (Status/Priorität/Notizen), FAQ-Markierung,
// Claude-Code-Prompt-Generator (Copy + .md-Export).

import { useEffect, useState } from 'react';
import { Check, Copy, Download, FileText, TrendingUp, Wand2, X } from 'lucide-react';
import {
  generateClaudeCodePrompt,
  getSponsoringProgress,
  loadFeedbackConfig,
  setEffortEstimate,
  updateFeedback,
} from '@/core/services/feedback';
import { useStorage } from '@/core/hooks/useStorage';
import { DEFAULT_FEEDBACK_CONFIG, EFFORT_LABELS } from '@/core/types/feedback';
import type { EffortEstimate, FeedbackConfig, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from '@/components/feedback/constants';

interface Props {
  ticket: FeedbackItem | null;
  onClose: () => void;
  onUpdated: () => void;
}

const inputClass = 'w-full px-2.5 py-1.5 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

export function FeedbackTicketDetail({ ticket, onClose, onUpdated }: Props): React.ReactElement {
  const storage = useStorage();
  const [status, setStatus] = useState<FeedbackStatus>('neu');
  const [priority, setPriority] = useState(3);
  const [notes, setNotes] = useState('');
  const [isFaq, setIsFaq] = useState(false);
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqKeywords, setFaqKeywords] = useState('');
  const [effort, setEffort] = useState<EffortEstimate | ''>('');
  const [prompt, setPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState<FeedbackConfig>(DEFAULT_FEEDBACK_CONFIG);

  useEffect(() => {
    void loadFeedbackConfig(storage).then(setConfig);
  }, [storage]);

  useEffect(() => {
    if (!ticket) return;
    setStatus(ticket.admin_status);
    setPriority(ticket.admin_priority ?? 3);
    setNotes(ticket.admin_notes ?? '');
    setIsFaq(!!ticket.is_faq);
    setFaqAnswer(ticket.faq_answer ?? '');
    setFaqKeywords((ticket.faq_keywords ?? []).join(', '));
    setEffort(ticket.effort_estimate ?? '');
    setPrompt(ticket.generated_prompt ?? '');
    setShowPrompt(false);
    setSavedNotice(false);
  }, [ticket]);

  if (!ticket) {
    return (
      <div className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-8">
        ← Ticket auswählen
      </div>
    );
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const keywords = faqKeywords.split(',').map(k => k.trim()).filter(Boolean);
      await updateFeedback(storage, ticket.id, {
        admin_status: status,
        admin_priority: priority,
        admin_notes: notes || undefined,
        generated_prompt: prompt || undefined,
        is_faq: isFaq,
        faq_answer: isFaq ? faqAnswer : undefined,
        faq_keywords: isFaq ? keywords : undefined,
      });
      // Effort separat (mit auto-sync hours)
      const currentEffort = (ticket.effort_estimate ?? '') as EffortEstimate | '';
      if (effort !== currentEffort) {
        await setEffortEstimate(storage, ticket.id, effort || undefined);
      }
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 1800);
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePrompt = (): void => {
    setPrompt(generateClaudeCodePrompt(ticket));
    setShowPrompt(true);
  };

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const handleExport = (): void => {
    const blob = new Blob([prompt], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-${ticket.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (showPrompt && prompt) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowPrompt(false)}
          className="text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] inline-flex items-center gap-1 cursor-pointer"
        >
          ← Zurück zum Detail
        </button>
        <pre className="p-3 rounded-[var(--tf-radius)] bg-[#1a1a2e] text-[#d4d4f0] text-[11px] font-mono whitespace-pre-wrap max-h-[60vh] overflow-y-auto">{prompt}</pre>
        <div className="flex gap-2">
          <button type="button" onClick={handleCopy} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--tf-radius)] text-[12px] bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Kopiert' : 'Kopieren'}
          </button>
          <button type="button" onClick={handleExport} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer" style={inputStyle}>
            <Download size={13} /> Als .md exportieren
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${CATEGORY_COLORS[ticket.category]}`}>
            {CATEGORY_LABELS[ticket.category]}
          </span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${STATUS_COLORS[ticket.admin_status]}`}>
            {STATUS_LABELS[ticket.admin_status]}
          </span>
          <span className="text-[10.5px] text-[var(--tf-text-tertiary)] font-mono">#{ticket.id.slice(-6)}</span>
        </div>
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--tf-hover)] cursor-pointer text-[var(--tf-text-tertiary)]" aria-label="Schließen">
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11.5px] p-2.5 rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)]">
        <div><span className="text-[var(--tf-text-tertiary)]">Seite:</span> {ticket.context.page}</div>
        <div><span className="text-[var(--tf-text-tertiary)]">Gerät:</span> {ticket.context.device}</div>
        <div><span className="text-[var(--tf-text-tertiary)]">User:</span> {ticket.user_display_name || ticket.user_id}</div>
        <div><span className="text-[var(--tf-text-tertiary)]">Datum:</span> {new Date(ticket.created_at).toLocaleString('de-DE')}</div>
        {ticket.context.screenRefLabel && <div className="col-span-2"><span className="text-[var(--tf-text-tertiary)]">Bereich:</span> {ticket.context.screenRefLabel}</div>}
      </div>

      {ticket.user_confirmed && (
        <div className="p-2 rounded-[var(--tf-radius)] bg-emerald-50 dark:bg-emerald-950/30 text-[12px] text-emerald-800 dark:text-emerald-300 inline-flex items-center gap-1.5">
          <Check size={13} /> Nutzer hat Zusammenfassung bestätigt
        </div>
      )}

      <div className="space-y-1">
        <p className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] font-semibold">Original-Feedback</p>
        <p className="text-[12.5px] text-[var(--tf-text)] whitespace-pre-wrap">{ticket.text}</p>
      </div>

      {ticket.llm_summary && ticket.llm_summary !== ticket.text && (
        <div className="space-y-1">
          <p className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] font-semibold">LLM-Zusammenfassung</p>
          <p className="text-[12.5px] text-[var(--tf-text)] whitespace-pre-wrap">{ticket.llm_summary}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-[var(--tf-text-tertiary)]">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as FeedbackStatus)} className={inputClass} style={inputStyle}>
            {(Object.keys(STATUS_LABELS) as FeedbackStatus[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-[var(--tf-text-tertiary)]">Priorität: {priority}/5</label>
          <input type="range" min={1} max={5} step={1} value={priority} onChange={e => setPriority(Number(e.target.value))} className="w-full mt-1.5 cursor-pointer accent-[var(--tf-primary)]" />
        </div>
      </div>

      {/* Aufwand-Schätzung (nur sinnvoll für Feature-Ideen) */}
      {ticket.category === 'idea' && (
        <div>
          <label className="text-[11px] text-[var(--tf-text-tertiary)]">Aufwand-Schätzung</label>
          <select value={effort} onChange={e => setEffort(e.target.value as EffortEstimate | '')} className={inputClass} style={inputStyle}>
            <option value="">— Nicht geschätzt —</option>
            {(['S', 'M', 'L', 'XL'] as EffortEstimate[]).map(e => (
              <option key={e} value={e}>{e} — {EFFORT_LABELS[e]}</option>
            ))}
          </select>
        </div>
      )}

      {/* Sponsoring-Info (read-only Block) */}
      {ticket.category === 'idea' && (ticket.sponsors?.length ?? 0) > 0 && (() => {
        const progress = getSponsoringProgress(ticket, config);
        return (
          <div className="p-2.5 rounded-[var(--tf-radius)] space-y-2" style={inputStyle}>
            <div className="flex items-center justify-between">
              <p className="text-[11.5px] font-medium text-[var(--tf-text)] inline-flex items-center gap-1.5">
                <TrendingUp size={12} /> Sponsoring-Fortschritt
              </p>
              {progress.thresholdReached && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  ✓ Schwelle erreicht
                </span>
              )}
            </div>
            <div className="h-2 rounded-full bg-[var(--tf-bg-secondary)] overflow-hidden">
              <div className={`h-full ${progress.thresholdReached ? 'bg-emerald-500' : 'bg-[var(--tf-primary)]'}`} style={{ width: `${progress.percentage}%` }} />
            </div>
            <p className="text-[11px] text-[var(--tf-text-tertiary)]">
              {progress.combinedPoints} / {progress.threshold} Punkte ({progress.percentage}%) · {progress.sponsorCount} Sponsoren
            </p>
            <ul className="text-[11px] text-[var(--tf-text-secondary)] space-y-0.5 pt-1" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
              {(ticket.sponsors ?? []).map((s, i) => (
                <li key={`${s.user_id}-${s.type}-${i}`}>
                  <span className="text-[var(--tf-text)]">{s.user_display_name}</span> · {s.type === 'points' ? `${s.amount} Pkt` : `${s.amount}h (${s.project_ref})`}
                </li>
              ))}
            </ul>
            {progress.thresholdReached && ticket.admin_status === 'neu' && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 pt-1" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                Hinweis: Schwelle erreicht — Status manuell auf "Geplant" setzen?
              </p>
            )}
          </div>
        );
      })()}

      <div>
        <label className="text-[11px] text-[var(--tf-text-tertiary)]">Notizen</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional…" className={inputClass + ' resize-none'} style={inputStyle} />
      </div>

      <div className="p-2.5 rounded-[var(--tf-radius)] space-y-2" style={inputStyle}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isFaq} onChange={e => setIsFaq(e.target.checked)} className="cursor-pointer accent-[var(--tf-primary)]" />
          <span className="text-[12px] text-[var(--tf-text)] font-medium">Als FAQ markieren</span>
          {isFaq && (ticket.faq_ask_count ?? 0) > 0 && (
            <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">· {ticket.faq_ask_count}× gefragt</span>
          )}
        </label>
        {isFaq && (
          <>
            <textarea value={faqAnswer} onChange={e => setFaqAnswer(e.target.value)} rows={3} placeholder="FAQ-Antwort (wird Usern angezeigt)" className={inputClass + ' resize-none'} style={inputStyle} />
            <input value={faqKeywords} onChange={e => setFaqKeywords(e.target.value)} placeholder="Stichwörter (kommagetrennt, optional)" className={inputClass} style={inputStyle} />
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--tf-radius)] text-[12.5px] font-medium bg-[var(--tf-primary)] text-white hover:opacity-90 disabled:opacity-40 cursor-pointer">
          {savedNotice ? <Check size={13} /> : null}
          {saving ? 'Speichern…' : savedNotice ? 'Gespeichert' : 'Speichern'}
        </button>
        <button type="button" onClick={handleGeneratePrompt} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer" style={inputStyle}>
          <Wand2 size={12} /> Claude Code Prompt
        </button>
        {prompt && (
          <button type="button" onClick={() => setShowPrompt(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer" style={inputStyle}>
            <FileText size={12} /> Prompt anzeigen
          </button>
        )}
      </div>
    </div>
  );
}
