// Verwaltungs-Felder eines Feedback-Tickets (v2.364): Status, Kategorie,
// Priorität, Aufwand, interne Notiz, öffentliche Antwort, FAQ-Markierung,
// Claude-Code-Prompt und Löschen.
//
// Herausgezogen aus dem früheren Kurator-Detail (src/plugins/feedback/sections/
// FeedbackTicketDetail.tsx), damit dieselben Felder direkt im Feedback-Board
// erscheinen — die Bearbeitung lebt jetzt an EINER Stelle, nicht in einem
// zweiten Menüpunkt. Die Sichtbarkeit entscheidet der Aufrufer über
// `canManageFeedback()`; der physische Schreib-Guard bleibt das self-gated
// `writeSharedFile`.

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, Download, FileText, MessageSquare, Trash2, TrendingUp, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useKopierAktion } from '@/core/hooks/useKopierAktion';
import { isFeedbackDeleteEnabled } from '@/config/feature-flags';
import {
  deleteFeedback,
  generateClaudeCodePrompt,
  getSponsoringProgress,
  isSponsorableCategory,
  setEffortEstimate,
  updateFeedback,
  FEEDBACK_STATUS,
} from '@/core/services/feedback';
import { EFFORT_LABELS, EFFORT_ORDER } from '@/core/types/feedback';
import type { EffortEstimate, FeedbackCategory, FeedbackConfig, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { CATEGORY_LABELS, STATUS_LABELS } from './constants';

interface Props {
  ticket: FeedbackItem;
  config: FeedbackConfig;
  /** Nach erfolgreichem Schreiben — Aufrufer lädt neu. */
  onChanged: () => void;
  /** Nach dem Löschen (Auswahl im Aufrufer leeren). */
  onDeleted?: () => void;
}

const inputClass =
  'w-full px-2 py-1.5 text-[12px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

export function FeedbackVerwaltungBlock({ ticket, config, onChanged, onDeleted }: Props): React.ReactElement {
  const storage = useStorage();
  const [status, setStatus] = useState<FeedbackStatus>(ticket.kurator_status);
  const [category, setCategory] = useState<FeedbackCategory | ''>(ticket.category ?? '');
  const [priority, setPriority] = useState(ticket.kurator_priority ?? 3);
  const [effort, setEffort] = useState<EffortEstimate | ''>(ticket.effort_estimate ?? '');
  const [notes, setNotes] = useState(ticket.kurator_notes ?? '');
  const [response, setResponse] = useState(ticket.kurator_response ?? '');
  const [isFaq, setIsFaq] = useState(!!ticket.is_faq);
  const [faqAnswer, setFaqAnswer] = useState(ticket.faq_answer ?? '');
  const [faqKeywords, setFaqKeywords] = useState((ticket.faq_keywords ?? []).join(', '));
  const [prompt, setPrompt] = useState(ticket.generated_prompt ?? '');
  const [showPrompt, setShowPrompt] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Ticket-Wechsel: Felder auf den neuen Datensatz zurücksetzen.
  useEffect(() => {
    setStatus(ticket.kurator_status);
    setCategory(ticket.category ?? '');
    setPriority(ticket.kurator_priority ?? 3);
    setEffort(ticket.effort_estimate ?? '');
    setNotes(ticket.kurator_notes ?? '');
    setResponse(ticket.kurator_response ?? '');
    setIsFaq(!!ticket.is_faq);
    setFaqAnswer(ticket.faq_answer ?? '');
    setFaqKeywords((ticket.faq_keywords ?? []).join(', '));
    setPrompt(ticket.generated_prompt ?? '');
    setShowPrompt(false);
    setSavedNotice(false);
    setConfirmDelete(false);
  }, [ticket]);

  const copy = useKopierAktion(() => prompt);

  const save = useAsyncAction(async () => {
    const keywords = faqKeywords.split(',').map(k => k.trim()).filter(Boolean);
    await updateFeedback(storage, ticket.id, {
      kurator_status: status,
      kurator_priority: priority,
      kurator_notes: notes || undefined,
      kurator_response: response.trim() || undefined,
      generated_prompt: prompt || undefined,
      is_faq: isFaq,
      faq_answer: isFaq ? faqAnswer : undefined,
      faq_keywords: isFaq ? keywords : undefined,
      category: category || undefined,
    });
    if (effort !== (ticket.effort_estimate ?? '')) {
      await setEffortEstimate(storage, ticket.id, effort || undefined);
    }
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
    onChanged();
  });

  const del = useAsyncAction(async () => {
    await deleteFeedback(storage, ticket.id);
    setConfirmDelete(false);
    onDeleted?.();
    onChanged();
  });

  const handleExport = (): void => {
    const blob = new Blob([prompt], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-${ticket.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Prompt-Vollansicht ersetzt den Block (wie im früheren Kurator-Detail).
  if (showPrompt && prompt) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowPrompt(false)}
          className="text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] inline-flex items-center gap-1 cursor-pointer"
        >
          ← Zurück
        </button>
        <pre className="p-3 rounded-[var(--tf-radius)] bg-[#1a1a2e] text-[#d4d4f0] text-[11px] font-mono whitespace-pre-wrap max-h-[50vh] overflow-y-auto">{prompt}</pre>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => copy.run()}
            loading={copy.busy}
            variant="primary"
            icon={copy.fehler ? AlertTriangle : copy.kopiert ? Check : Copy}
            title={copy.titel}
          >
            {copy.fehler ? 'Kopieren fehlgeschlagen' : copy.kopiert ? 'Kopiert' : 'Kopieren'}
          </Button>
          <Button type="button" onClick={handleExport} variant="secondary" icon={Download}>.md Export</Button>
        </div>
      </div>
    );
  }

  const showEffort = isSponsorableCategory(category || undefined) || isSponsorableCategory(ticket.category);
  const progress =
    isSponsorableCategory(ticket.category) && (ticket.sponsors?.length ?? 0) > 0
      ? getSponsoringProgress(ticket, config)
      : null;

  return (
    <div className="space-y-2.5">
      {/* Sponsoring-Fortschritt + Schwellen-Hinweis (Entscheidungshilfe) */}
      {progress && (
        <div className="p-2 rounded-[var(--tf-radius)] space-y-1.5" style={inputStyle}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-[var(--tf-text)] inline-flex items-center gap-1">
              <TrendingUp size={11} /> Sponsoring
            </p>
            <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">{progress.percentage}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--tf-bg-secondary)] overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${progress.percentage}%`,
                background: progress.thresholdReached ? 'var(--tf-success-text)' : 'var(--tf-primary)',
              }}
            />
          </div>
          <p className="text-[10.5px] text-[var(--tf-text-tertiary)]">
            {progress.combinedPoints}/{progress.threshold} Pkt · {progress.sponsorCount} Sponsoren
          </p>
          {progress.thresholdReached && ticket.kurator_status === FEEDBACK_STATUS.neu && (
            <p className="text-[10.5px] text-[var(--tf-success-text)]">Schwelle erreicht — Status auf „Geplant" setzen?</p>
          )}
        </div>
      )}

      {/* Kernfelder: 2×2 */}
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
          <input
            type="range" min={1} max={5} step={1} value={priority}
            onChange={e => setPriority(Number(e.target.value))}
            className="w-full mt-1 cursor-pointer accent-[var(--tf-primary)]"
          />
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

      {/* Interne Notiz */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] font-medium mb-0.5">
          Notizen <span className="normal-case tracking-normal">(intern)</span>
        </p>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional…" className={inputClass + ' resize-none'} style={inputStyle} />
      </div>

      {/* Öffentliche Antwort */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] font-medium mb-0.5 inline-flex items-center gap-1">
          <MessageSquare size={11} className="text-[var(--tf-info-text)]" />
          Öffentliche Antwort <span className="normal-case tracking-normal">(für alle auf dem Board sichtbar)</span>
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

      {/* Aktionen */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" onClick={() => save.run()} loading={save.busy} variant="primary" icon={savedNotice ? Check : undefined}>
          {save.busy ? 'Speichern…' : savedNotice ? 'Gespeichert' : 'Speichern'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          icon={Wand2}
          onClick={() => { setPrompt(generateClaudeCodePrompt(ticket)); setShowPrompt(true); }}
        >
          Claude Code Prompt
        </Button>
        {prompt && (
          <Button type="button" variant="secondary" icon={FileText} onClick={() => setShowPrompt(true)}>Prompt anzeigen</Button>
        )}
      </div>
      {save.error && <p className="text-[11px] text-[var(--tf-danger-text)]">Speichern fehlgeschlagen: {save.error}</p>}

      {/* Löschen — zusätzlich hinter dem destruktiven Flag, nach Bestätigung */}
      {isFeedbackDeleteEnabled() && (
        <div className="pt-2 mt-1" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
          {!confirmDelete ? (
            <Button type="button" variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>Löschen</Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-[var(--tf-text)]">Dieses Ticket wirklich löschen?</span>
              <Button type="button" variant="danger" icon={Trash2} loading={del.busy} onClick={() => del.run()}>
                {del.busy ? 'Lösche…' : 'Ja, löschen'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => { del.clearError(); setConfirmDelete(false); }}>Abbrechen</Button>
            </div>
          )}
          {del.error && <p className="mt-1 text-[11px] text-[var(--tf-danger-text)]">Löschen fehlgeschlagen: {del.error}</p>}
        </div>
      )}
    </div>
  );
}
