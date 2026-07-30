// FAQ-Tab: kompakte Tabelle, Suchfeld, besserer leerer Zustand.

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { createStandaloneFaq, updateFeedback } from '@/core/services/feedback';
import type { FeedbackItem } from '@/core/types/feedback';

interface Props { faqs: FeedbackItem[]; onChanged: () => void; }

const inputClass = 'w-full px-2.5 py-1.5 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

export function FeedbackFaqTab({ faqs, onChanged }: Props): React.ReactElement {
  const storage = useStorage();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newSummary, setNewSummary] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAnswer, setEditAnswer] = useState('');
  const [editKeywords, setEditKeywords] = useState('');

  const filtered = search.trim()
    ? faqs.filter(f => {
        const q = search.toLowerCase();
        return (f.llm_summary ?? f.text ?? '').toLowerCase().includes(q)
          || (f.faq_answer ?? '').toLowerCase().includes(q)
          || (f.faq_keywords ?? []).some(k => k.toLowerCase().includes(q));
      })
    : faqs;

  const handleCreate = async (): Promise<void> => {
    if (!newSummary.trim() || !newAnswer.trim()) return;
    await createStandaloneFaq(storage, {
      summary: newSummary.trim(), answer: newAnswer.trim(),
      keywords: newKeywords.split(',').map(k => k.trim()).filter(Boolean),
    });
    setNewSummary(''); setNewAnswer(''); setNewKeywords(''); setCreating(false);
    onChanged();
  };

  const handleSaveEdit = async (id: string): Promise<void> => {
    await updateFeedback(storage, id, {
      faq_answer: editAnswer.trim(),
      faq_keywords: editKeywords.split(',').map(k => k.trim()).filter(Boolean),
    });
    setEditingId(null); onChanged();
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <p className="text-[12.5px] text-[var(--tf-text-secondary)] shrink-0">{faqs.length} FAQ-Einträge</p>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="FAQ durchsuchen…" className={inputClass + ' max-w-xs'} style={inputStyle} />
        <div className="flex-1" />
        <Button type="button" onClick={() => setCreating(!creating)} variant="primary" className="shrink-0" icon={Plus}>
          FAQ manuell anlegen
        </Button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="p-3 rounded-[var(--tf-radius)] space-y-2 bg-[var(--tf-bg-secondary)]" style={inputStyle}>
          <input value={newSummary} onChange={e => setNewSummary(e.target.value)} placeholder="Frage / Titel…" className={inputClass} style={inputStyle} />
          <textarea value={newAnswer} onChange={e => setNewAnswer(e.target.value)} placeholder="Antwort…" rows={3} className={inputClass + ' resize-none'} style={inputStyle} />
          <input value={newKeywords} onChange={e => setNewKeywords(e.target.value)} placeholder="Stichwörter (kommagetrennt)" className={inputClass} style={inputStyle} />
          <Button type="button" onClick={handleCreate} disabled={!newSummary.trim() || !newAnswer.trim()} variant="primary">
            FAQ speichern
          </Button>
        </div>
      )}

      {/* Empty state */}
      {faqs.length === 0 && !creating && (
        <div className="text-center py-10">
          <p className="text-[13px] font-medium text-[var(--tf-text)]">Noch keine FAQ-Einträge</p>
          <p className="text-[12px] text-[var(--tf-text-tertiary)] mt-1">
            Im Ticket-Detail kannst du Tickets als FAQ markieren und eine Antwort hinterlegen.
          </p>
          <p className="text-[12px] text-[var(--tf-text-tertiary)] mt-0.5">
            Alternativ: <button type="button" onClick={() => setCreating(true)} className="text-[var(--tf-primary)] underline cursor-pointer">FAQ manuell anlegen</button>
          </p>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div>
          <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
            <span className="flex-1 min-w-0">Frage & Antwort</span>
            <span className="w-28 shrink-0">Stichwörter</span>
            <span className="w-14 shrink-0 text-right">Gefragt</span>
            <span className="w-28 shrink-0 text-right">Aktionen</span>
          </div>
          {filtered.map(faq => {
            const summary = faq.llm_summary || faq.text || '–';
            const isEditing = editingId === faq.id;
            return (
              <div key={faq.id} className="px-3 py-2.5" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
                {!isEditing ? (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-[var(--tf-text)]">{summary}</p>
                      <p className="text-[11px] text-[var(--tf-text-secondary)] mt-0.5 line-clamp-2">{faq.faq_answer ?? '–'}</p>
                    </div>
                    <div className="w-28 shrink-0 flex flex-wrap gap-1">
                      {(faq.faq_keywords ?? []).map(k => (
                        <span key={k} className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">{k}</span>
                      ))}
                    </div>
                    <span className="w-14 shrink-0 text-right text-[11px] text-[var(--tf-text-tertiary)]">{(faq.faq_ask_count ?? 0)}×</span>
                    <div className="w-28 shrink-0 flex justify-end gap-2">
                      <button type="button" onClick={() => { setEditingId(faq.id); setEditAnswer(faq.faq_answer ?? ''); setEditKeywords((faq.faq_keywords ?? []).join(', ')); }} className="text-[11px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer">Bearbeiten</button>
                      <button type="button" onClick={async () => { await updateFeedback(storage, faq.id, { is_faq: false }); onChanged(); }} className="text-[11px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer">Entfernen</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[12px] font-medium text-[var(--tf-text)]">{summary}</p>
                    <textarea value={editAnswer} onChange={e => setEditAnswer(e.target.value)} rows={3} className={inputClass + ' resize-none'} style={inputStyle} />
                    <input value={editKeywords} onChange={e => setEditKeywords(e.target.value)} placeholder="Stichwörter" className={inputClass} style={inputStyle} />
                    <div className="flex gap-2">
                      <Button type="button" onClick={() => handleSaveEdit(faq.id)} variant="primary" size="sm">Speichern</Button>
                      <Button type="button" onClick={() => setEditingId(null)} variant="secondary" size="sm">Abbrechen</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
