// Detail-Panel: Metadaten, Admin-Felder (2×2 Grid), FAQ, Claude-Code-Prompt.

import { useEffect, useState } from 'react';
import { Check, Copy, Download, FileText, MessageSquare, Trash2, TrendingUp, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  deleteFeedback,
  generateClaudeCodePrompt,
  getSponsoringProgress,
  isSponsorableCategory,
  loadFeedbackConfig,
  setEffortEstimate,
  updateFeedback,
  FEEDBACK_STATUS,
} from '@/core/services/feedback';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { isFeedbackDeleteEnabled } from '@/config/feature-flags';
import { DEFAULT_FEEDBACK_CONFIG, EFFORT_LABELS, EFFORT_ORDER } from '@/core/types/feedback';
import type { EffortEstimate, FeedbackCategory, FeedbackConfig, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { CATEGORY_COLORS, CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS } from '@/components/feedback/constants';
import { feedbackTitle } from '@/components/feedback/feedbackUi';
import { FeedbackCommentThread } from '@/components/feedback/FeedbackCommentThread';
import { TicketScreenshots } from './TicketScreenshots';

interface Props { ticket: FeedbackItem | null; onClose: () => void; onUpdated: () => void; }

const inputClass = 'w-full px-2 py-1.5 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

export function FeedbackTicketDetail({ ticket, onClose, onUpdated }: Props): React.ReactElement {
  const storage = useStorage();
  const meinKuerzel = useMeinKuerzel() ?? 'KURATOR';
  const [status, setStatus] = useState<FeedbackStatus>('neu');
  const [priority, setPriority] = useState(3);
  const [notes, setNotes] = useState('');
  const [response, setResponse] = useState('');
  const [isFaq, setIsFaq] = useState(false);
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqKeywords, setFaqKeywords] = useState('');
  const [effort, setEffort] = useState<EffortEstimate | ''>('');
  const [category, setCategory] = useState<FeedbackCategory | ''>('');
  const [prompt, setPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [config, setConfig] = useState<FeedbackConfig>(DEFAULT_FEEDBACK_CONFIG);

  // Kurator (+ dev): Ticket löschen (nach Bestätigung, gated via feedbackDelete —
  // v2.23 auch im kurator-Build, für versehentlich gegebenes Feedback). deleteFeedback
  // entfernt aus localStorage + geteilter feedback.json; danach Auswahl leeren + Liste
  // neu laden. Auto-Collect re-importiert nicht (Outbox-Eintrag ist 'approved').
  const del = useAsyncAction(async () => {
    if (!ticket) return;
    await deleteFeedback(storage, ticket.id);
    setConfirmDelete(false);
    onClose();
    onUpdated();
  });

  useEffect(() => { void loadFeedbackConfig(storage).then(setConfig); }, [storage]);

  useEffect(() => {
    if (!ticket) return;
    setStatus(ticket.kurator_status);
    setPriority(ticket.kurator_priority ?? 3);
    setNotes(ticket.kurator_notes ?? '');
    setResponse(ticket.kurator_response ?? '');
    setIsFaq(!!ticket.is_faq);
    setFaqAnswer(ticket.faq_answer ?? '');
    setFaqKeywords((ticket.faq_keywords ?? []).join(', '));
    setEffort(ticket.effort_estimate ?? '');
    setCategory(ticket.category ?? '');
    setPrompt(ticket.generated_prompt ?? '');
    setShowPrompt(false);
    setSavedNotice(false);
    setConfirmDelete(false);
  }, [ticket]);

  if (!ticket) {
    return <div className="text-[12.5px] text-[var(--tf-text-tertiary)] text-center py-8">← Ticket auswählen</div>;
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const keywords = faqKeywords.split(',').map(k => k.trim()).filter(Boolean);
      await updateFeedback(storage, ticket.id, {
        kurator_status: status, kurator_priority: priority, kurator_notes: notes || undefined,
        kurator_response: response.trim() || undefined,
        generated_prompt: prompt || undefined, is_faq: isFaq,
        faq_answer: isFaq ? faqAnswer : undefined, faq_keywords: isFaq ? keywords : undefined,
        category: category || undefined,
      });
      if (effort !== (ticket.effort_estimate ?? '')) await setEffortEstimate(storage, ticket.id, effort || undefined);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 1800);
      onUpdated();
    } finally { setSaving(false); }
  };

  const handleCopy = async (): Promise<void> => {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const handleExport = (): void => {
    const blob = new Blob([prompt], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `feedback-${ticket.id}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  // Prompt-Ansicht
  if (showPrompt && prompt) {
    return (
      <div className="space-y-2">
        <button type="button" onClick={() => setShowPrompt(false)} className="text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] inline-flex items-center gap-1 cursor-pointer">← Zurück</button>
        <pre className="p-3 rounded-[var(--tf-radius)] bg-[#1a1a2e] text-[#d4d4f0] text-[11px] font-mono whitespace-pre-wrap max-h-[60vh] overflow-y-auto">{prompt}</pre>
        <div className="flex gap-2">
          <Button type="button" onClick={handleCopy} variant="primary" icon={copied ? Check : Copy}>
            {copied ? 'Kopiert' : 'Kopieren'}
          </Button>
          <button type="button" onClick={handleExport} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer" style={inputStyle}>
            <Download size={13} /> .md Export
          </button>
        </div>
      </div>
    );
  }

  const showEffort = isSponsorableCategory(category || undefined) || isSponsorableCategory(ticket.category);
  const progress = isSponsorableCategory(ticket.category) && (ticket.sponsors?.length ?? 0) > 0 ? getSponsoringProgress(ticket, config) : null;

  return (
    <div className="space-y-2.5">
      {/* Header: Badges + ID + Close */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${category ? CATEGORY_COLORS[category] : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]'}`}>
            {category ? CATEGORY_LABELS[category] : 'Unklassifiziert'}
          </span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${STATUS_COLORS[ticket.kurator_status]}`}>
            {STATUS_LABELS[ticket.kurator_status]}
          </span>
          {ticket.context?.page && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
              {ticket.context.page}
            </span>
          )}
          <span className="text-[10.5px] text-[var(--tf-text-tertiary)] font-mono">#{ticket.id.slice(-6)}</span>
        </div>
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[var(--tf-hover)] cursor-pointer text-[var(--tf-text-tertiary)]" aria-label="Schließen"><X size={14} /></button>
      </div>

      {/* Kontext 2×2 */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] p-2 rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)]">
        <div><span className="text-[var(--tf-text-tertiary)]">Seite:</span> {ticket.context.page}</div>
        <div><span className="text-[var(--tf-text-tertiary)]">Gerät:</span> {ticket.context.device}</div>
        <div><span className="text-[var(--tf-text-tertiary)]">User:</span> {ticket.user_display_name || ticket.user_id}</div>
        <div><span className="text-[var(--tf-text-tertiary)]">Datum:</span> {new Date(ticket.created_at).toLocaleString('de-DE')}</div>
        <div className="col-span-2">
          <span className="text-[var(--tf-text-tertiary)]">Version:</span>{' '}
          {ticket.context.appVersion
            ? <span className="font-mono">v{ticket.context.appVersion}{ticket.context.gitHash ? ` · ${ticket.context.gitHash}` : ''}</span>
            : '—'}
        </div>
      </div>

      {/* Titel (explizit oder abgeleitet) */}
      <h2 className="text-[15px] font-medium text-[var(--tf-text)] leading-snug">{feedbackTitle(ticket, 140)}</h2>

      {/* Original-Feedback */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] font-medium mb-0.5">Original-Feedback</p>
        <p className="text-[12px] text-[var(--tf-text)] whitespace-pre-wrap">{ticket.text}</p>
      </div>
      {ticket.llm_summary && ticket.llm_summary !== ticket.text && (
        <p className="text-[11.5px] text-[var(--tf-text-secondary)] italic">{ticket.llm_summary}</p>
      )}

      {/* Screenshots */}
      {ticket.attachments && ticket.attachments.length > 0 && (
        <TicketScreenshots attachments={ticket.attachments} />
      )}

      {/* Sponsoring-Block */}
      {progress && (
        <div className="p-2 rounded-[var(--tf-radius)] space-y-1.5" style={inputStyle}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-[var(--tf-text)] inline-flex items-center gap-1"><TrendingUp size={11} /> Sponsoring</p>
            <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">{progress.percentage}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--tf-bg-secondary)] overflow-hidden">
            <div className="h-full" style={{ width: `${progress.percentage}%`, background: progress.thresholdReached ? 'var(--tf-success-text)' : 'var(--tf-primary)' }} />
          </div>
          <p className="text-[10.5px] text-[var(--tf-text-tertiary)]">{progress.combinedPoints}/{progress.threshold} Pkt · {progress.sponsorCount} Sponsoren</p>
          {progress.thresholdReached && ticket.kurator_status === FEEDBACK_STATUS.neu && (
            <p className="text-[10.5px] text-[var(--tf-success-text)]">Schwelle erreicht — Status auf "Geplant" setzen?</p>
          )}
        </div>
      )}

      {/* Kurator-Felder: 2×2 Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10.5px] text-[var(--tf-text-tertiary)]">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as FeedbackStatus)} className={inputClass} style={inputStyle}>
            {(Object.keys(STATUS_LABELS) as FeedbackStatus[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10.5px] text-[var(--tf-text-tertiary)]">Kategorie</label>
          <select value={category} onChange={e => setCategory(e.target.value as FeedbackCategory | '')} className={inputClass} style={inputStyle}>
            <option value="">— Unklassifiziert —</option>
            {(Object.keys(CATEGORY_LABELS) as FeedbackCategory[]).map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10.5px] text-[var(--tf-text-tertiary)]">Priorität: {priority}/5</label>
          <input type="range" min={1} max={5} step={1} value={priority} onChange={e => setPriority(Number(e.target.value))} className="w-full mt-1 cursor-pointer accent-[var(--tf-primary)]" />
        </div>
        {showEffort ? (
          <div>
            <label className="text-[10.5px] text-[var(--tf-text-tertiary)]">Aufwand</label>
            <select value={effort} onChange={e => setEffort(e.target.value as EffortEstimate | '')} className={inputClass} style={inputStyle}>
              <option value="">— Nicht geschätzt —</option>
              {EFFORT_ORDER.map(e => <option key={e} value={e}>{e} — {EFFORT_LABELS[e]}</option>)}
            </select>
          </div>
        ) : <div />}
      </div>

      {/* Notizen (intern) */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] font-medium mb-0.5">Notizen <span className="normal-case tracking-normal text-[var(--tf-text-tertiary)]">(intern)</span></p>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional…" className={inputClass + ' resize-none'} style={inputStyle} />
      </div>

      {/* Öffentliche Antwort — für alle Nutzer auf dem Board sichtbar */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] font-medium mb-0.5 inline-flex items-center gap-1">
          <MessageSquare size={11} className="text-[var(--tf-info-text)]" />
          Öffentliche Antwort <span className="normal-case tracking-normal text-[var(--tf-text-tertiary)]">(für alle auf dem Board sichtbar)</span>
        </p>
        <textarea value={response} onChange={e => setResponse(e.target.value)} rows={2} placeholder="Antwort an alle Nutzer…" className={inputClass + ' resize-none'} style={inputStyle} />
      </div>

      {/* FAQ */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={isFaq} onChange={e => setIsFaq(e.target.checked)} className="cursor-pointer accent-[var(--tf-primary)]" />
        <span className="text-[12px] text-[var(--tf-text)]">Als FAQ markieren</span>
      </label>
      {isFaq && (
        <div className="space-y-1.5">
          <textarea value={faqAnswer} onChange={e => setFaqAnswer(e.target.value)} rows={2} placeholder="FAQ-Antwort" className={inputClass + ' resize-none'} style={inputStyle} />
          <input value={faqKeywords} onChange={e => setFaqKeywords(e.target.value)} placeholder="Stichwörter (kommagetrennt)" className={inputClass} style={inputStyle} />
        </div>
      )}

      {/* Kommentar-Thread (Kurator sieht + antwortet mit) */}
      <div className="pt-2" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <FeedbackCommentThread ticket={ticket} meId={meinKuerzel} meName={meinKuerzel} onChanged={onUpdated} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" onClick={handleSave} disabled={saving} variant="primary" icon={savedNotice ? Check : undefined}>
          {saving ? 'Speichern…' : savedNotice ? 'Gespeichert' : 'Speichern'}
        </Button>
        <button type="button" onClick={() => { setPrompt(generateClaudeCodePrompt(ticket)); setShowPrompt(true); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer" style={inputStyle}>
          <Wand2 size={12} /> Claude Code Prompt
        </button>
        {prompt && !showPrompt && (
          <button type="button" onClick={() => setShowPrompt(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer" style={inputStyle}>
            <FileText size={12} /> Prompt anzeigen
          </button>
        )}
      </div>

      {/* Löschen (dev-only, nach Bestätigung) */}
      {isFeedbackDeleteEnabled() && (
        <div className="pt-2 mt-1" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-danger-text)] hover:bg-[var(--tf-danger-bg)] cursor-pointer"
              style={inputStyle}
            >
              <Trash2 size={12} /> Löschen
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-[var(--tf-text)]">Dieses Ticket wirklich löschen?</span>
              <button
                type="button"
                onClick={() => del.run()}
                disabled={del.busy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--tf-radius)] text-[12px] font-medium bg-[var(--tf-danger-text)] text-white hover:opacity-90 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 size={12} /> {del.busy ? 'Lösche…' : 'Ja, löschen'}
              </button>
              <button
                type="button"
                onClick={() => { del.clearError(); setConfirmDelete(false); }}
                className="px-2.5 py-1.5 rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
                style={inputStyle}
              >
                Abbrechen
              </button>
            </div>
          )}
          {del.error && (
            <p className="mt-1 text-[11px] text-[var(--tf-danger-text)]">Löschen fehlgeschlagen: {del.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
