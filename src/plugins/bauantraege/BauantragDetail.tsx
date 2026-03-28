import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Pencil, Trash2, Check } from 'lucide-react';
import { Button, Badge, Tabs, Dialog, Field } from '@/ui';
import { StatusSelect } from '@/ui/StatusSelect';
import { MarkdownEditor } from '@/ui/MarkdownEditor';
import { useStorage } from '@/core/hooks/useStorage';
import { VorgangDokumenteTab } from '@/core/components/VorgangDokumenteTab';
import { VerlaufTab } from '@/core/components/VerlaufTab';
import { useBauantraegeStore } from './store';
import { BauantragForm } from './BauantragForm';
import { ArtefakteTab } from './ArtefakteTab';
import { BAUANTRAG_STATUS_LABELS, PRIORITY_LABELS } from './types';
import { applyTransition } from '@/core/services/workflow/engine';
import { loadHistory, addHistoryEntry } from '@/core/services/workflow/history';
import { getDaysUntilDeadline, isOverdue } from '@/core/services/workflow/deadlines';
import type { HistoryEntry } from '@/core/services/workflow/history';

export function BauantragDetail(): React.ReactElement | null {
  const storage = useStorage();
  const { bauantraege, selectedId, setSelectedId, update, remove } = useBauantraegeStore();
  const vorgang = bauantraege.find(v => v.id === selectedId);
  const [activeTab, setActiveTab] = useState('uebersicht');
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (vorgang) { setNotes(vorgang.notes); loadHistory(vorgang.id, storage).then(setHistory); }
  }, [vorgang, storage]);

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value); setSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (vorgang) { await update({ ...vorgang, notes: value }, storage); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    }, 1000);
  }, [vorgang, update, storage]);

  const handleStatusChange = async (targetStatus: string, comment?: string): Promise<void> => {
    if (!vorgang) return;
    const { vorgang: updated, entry } = applyTransition(vorgang, targetStatus, '', comment);
    await update(updated, storage);
    await addHistoryEntry(vorgang.id, entry, storage);
    setHistory(prev => [entry, ...prev]);
  };

  if (!vorgang) return null;

  const daysLeft = getDaysUntilDeadline(vorgang);
  const overdue = isOverdue(vorgang);
  const fristText = vorgang.deadline
    ? `${new Date(vorgang.deadline).toLocaleDateString('de-DE')}${daysLeft !== null ? ` (${daysLeft < 0 ? `${Math.abs(daysLeft)}d überfällig` : `in ${daysLeft}d`})` : ''}`
    : '—';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => setSelectedId(null)} className="flex items-center gap-1 text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] mb-4 cursor-pointer">
        <ArrowLeft size={14} /> Alle Bauanträge
      </button>

      {overdue && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)] rounded-[var(--tf-radius)] text-[13px]">
          Frist überschritten seit {Math.abs(daysLeft ?? 0)} Tagen
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-[22px] font-medium text-[var(--tf-text)]">{vorgang.title}</h1>
            <span className="text-[12px] font-mono text-[var(--tf-text-tertiary)]">{vorgang.id}</span>
          </div>
          <StatusSelect currentStatus={vorgang.status} type="bauantrag" labels={BAUANTRAG_STATUS_LABELS} onChange={handleStatusChange} />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Pencil} size="sm" onClick={() => setShowForm(true)}>Bearbeiten</Button>
          <Button variant="danger" icon={Trash2} size="sm" onClick={() => setShowDelete(true)}>Löschen</Button>
        </div>
      </div>

      <Tabs tabs={[
        { id: 'uebersicht', label: 'Übersicht' },
        { id: 'dokumente', label: 'Dokumente' },
        { id: 'artefakte', label: 'Artefakte' },
        { id: 'verlauf', label: 'Verlauf' },
        { id: 'notizen', label: 'Notizen' },
      ]} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === 'uebersicht' && (
          <div className="grid grid-cols-2 gap-5">
            <Field label="Priorität" value={PRIORITY_LABELS[vorgang.priority] ?? vorgang.priority} />
            <Field label="Zuständiger" value={vorgang.assignee || '—'} />
            <div>
              <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-1">Frist</p>
              <div className="flex items-center gap-2">
                {daysLeft !== null && <span className={`w-1.5 h-1.5 rounded-full ${daysLeft < 3 ? 'bg-[var(--tf-danger-text)]' : daysLeft < 7 ? 'bg-[var(--tf-warning-text)]' : 'bg-[var(--tf-text-tertiary)]'}`} />}
                <p className="text-[14px] font-medium text-[var(--tf-text)]">{fristText}</p>
              </div>
            </div>
            <Field label="Erstellt" value={new Date(vorgang.created).toLocaleDateString('de-DE')} />
            <Field label="Geändert" value={new Date(vorgang.modified).toLocaleDateString('de-DE')} />
            <div>
              <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-1">Tags</p>
              <div className="flex gap-1 flex-wrap">
                {vorgang.tags.length > 0 ? vorgang.tags.map(t => <Badge key={t}>{t}</Badge>) : <span className="text-[var(--tf-text-tertiary)]">—</span>}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'dokumente' && <VorgangDokumenteTab vorgangId={vorgang.id} />}
        {activeTab === 'artefakte' && <ArtefakteTab vorgang={vorgang} userName="" />}
        {activeTab === 'verlauf' && <VerlaufTab history={history} />}
        {activeTab === 'notizen' && (
          <div className="space-y-2">
            <MarkdownEditor value={notes} onChange={handleNotesChange} placeholder="Notizen zum Vorgang..." minHeight="250px" />
            {saved && <p className="flex items-center gap-1 text-[12px] text-[var(--tf-success-text)]"><Check size={12} /> Gespeichert</p>}
          </div>
        )}
      </div>

      <BauantragForm open={showForm} onClose={() => setShowForm(false)} initialValues={vorgang} />
      <Dialog open={showDelete} onClose={() => setShowDelete(false)} title="Antrag löschen?"
        footer={<><Button variant="secondary" onClick={() => setShowDelete(false)}>Abbrechen</Button><Button variant="danger" onClick={async () => { await remove(vorgang.id, storage); setShowDelete(false); }}>Endgültig löschen</Button></>}>
        <p className="text-[13px] text-[var(--tf-text-secondary)]">Soll &quot;{vorgang.title}&quot; wirklich gelöscht werden?</p>
      </Dialog>
    </div>
  );
}
