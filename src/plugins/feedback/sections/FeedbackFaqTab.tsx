// FAQ-Tab: Übersicht aller is_faq=true Items + manuelles Anlegen.

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { createStandaloneFaq, deleteFeedback, updateFeedback } from '@/core/services/feedback';
import type { FeedbackItem } from '@/core/types/feedback';

interface Props {
  faqs: FeedbackItem[];
  onChanged: () => void;
}

const inputClass = 'w-full px-2.5 py-1.5 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)] placeholder:text-[var(--tf-text-tertiary)]';
const inputStyle = { border: '0.5px solid var(--tf-border)' } as const;

export function FeedbackFaqTab({ faqs, onChanged }: Props): React.ReactElement {
  const storage = useStorage();
  const [creating, setCreating] = useState(false);
  const [newSummary, setNewSummary] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAnswer, setEditAnswer] = useState('');
  const [editKeywords, setEditKeywords] = useState('');

  const handleCreate = async (): Promise<void> => {
    if (!newSummary.trim() || !newAnswer.trim()) return;
    await createStandaloneFaq(storage, {
      summary: newSummary.trim(),
      answer: newAnswer.trim(),
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
    setEditingId(null);
    onChanged();
  };

  const handleRemoveFaq = async (id: string): Promise<void> => {
    await updateFeedback(storage, id, { is_faq: false });
    onChanged();
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm('FAQ-Eintrag dauerhaft löschen?')) return;
    await deleteFeedback(storage, id);
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">{faqs.length} FAQ-{faqs.length === 1 ? 'Eintrag' : 'Einträge'}</p>
        <button type="button" onClick={() => setCreating(!creating)} className="inline-flex items-center gap-1 px-2 py-1 rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-primary)] hover:bg-[var(--tf-hover)] cursor-pointer">
          <Plus size={12} /> {creating ? 'Abbrechen' : 'FAQ manuell anlegen'}
        </button>
      </div>

      {creating && (
        <div className="p-3 rounded-[var(--tf-radius)] space-y-2 bg-[var(--tf-bg-secondary)]" style={inputStyle}>
          <input value={newSummary} onChange={e => setNewSummary(e.target.value)} placeholder="Frage / Titel…" className={inputClass} style={inputStyle} />
          <textarea value={newAnswer} onChange={e => setNewAnswer(e.target.value)} placeholder="Antwort…" rows={3} className={inputClass + ' resize-none'} style={inputStyle} />
          <input value={newKeywords} onChange={e => setNewKeywords(e.target.value)} placeholder="Stichwörter (kommagetrennt, optional)" className={inputClass} style={inputStyle} />
          <button type="button" onClick={handleCreate} disabled={!newSummary.trim() || !newAnswer.trim()} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--tf-radius)] text-[12px] font-medium bg-[var(--tf-primary)] text-white hover:opacity-90 disabled:opacity-40 cursor-pointer">
            FAQ speichern
          </button>
        </div>
      )}

      <div className="space-y-2">
        {faqs.length === 0 && !creating && (
          <p className="text-[12px] text-[var(--tf-text-tertiary)] text-center py-6">Noch keine FAQ-Einträge. Markiere ein Ticket im Tickets-Tab als FAQ oder lege manuell einen an.</p>
        )}
        {faqs.map(faq => {
          const isEditing = editingId === faq.id;
          const summary = faq.llm_summary || faq.text || '–';
          return (
            <div key={faq.id} className="p-2.5 rounded-[var(--tf-radius)]" style={inputStyle}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-medium text-[var(--tf-text)] line-clamp-2">{summary}</p>
                  {(faq.faq_ask_count ?? 0) > 0 && (
                    <p className="text-[10.5px] text-[var(--tf-text-tertiary)] mt-0.5">{faq.faq_ask_count}× gefragt</p>
                  )}
                </div>
                <button type="button" onClick={() => handleDelete(faq.id)} className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-red-600 hover:bg-[var(--tf-hover)] cursor-pointer" aria-label="Löschen">
                  <Trash2 size={12} />
                </button>
              </div>
              {!isEditing ? (
                <>
                  <p className="text-[12px] text-[var(--tf-text-secondary)] mt-1.5 whitespace-pre-wrap">{faq.faq_answer ?? '–'}</p>
                  {faq.faq_keywords && faq.faq_keywords.length > 0 && (
                    <p className="text-[10.5px] text-[var(--tf-text-tertiary)] mt-1">Keywords: {faq.faq_keywords.join(', ')}</p>
                  )}
                  <div className="flex gap-2 mt-1.5">
                    <button type="button" onClick={() => { setEditingId(faq.id); setEditAnswer(faq.faq_answer ?? ''); setEditKeywords((faq.faq_keywords ?? []).join(', ')); }} className="text-[11px] text-[var(--tf-primary)] hover:underline cursor-pointer">Bearbeiten</button>
                    <button type="button" onClick={() => handleRemoveFaq(faq.id)} className="text-[11px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] cursor-pointer">FAQ-Markierung entfernen</button>
                  </div>
                </>
              ) : (
                <div className="space-y-2 mt-2">
                  <textarea value={editAnswer} onChange={e => setEditAnswer(e.target.value)} rows={3} className={inputClass + ' resize-none'} style={inputStyle} />
                  <input value={editKeywords} onChange={e => setEditKeywords(e.target.value)} placeholder="Stichwörter" className={inputClass} style={inputStyle} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleSaveEdit(faq.id)} className="px-2.5 py-1 rounded-[var(--tf-radius)] text-[11px] font-medium bg-[var(--tf-primary)] text-white hover:opacity-90 cursor-pointer">Speichern</button>
                    <button type="button" onClick={() => setEditingId(null)} className="px-2.5 py-1 rounded-[var(--tf-radius)] text-[11px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer" style={inputStyle}>Abbrechen</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
