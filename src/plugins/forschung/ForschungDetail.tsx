import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Pencil, Trash2, Check } from 'lucide-react';
import { Button, Badge, Tabs, Dialog, FileDropZone, SectionHeader } from '@/ui';
import { StatusSelect } from '@/ui/StatusSelect';
import { useStorage } from '@/core/hooks/useStorage';
import { useForschungStore } from './store';
import { ForschungForm } from './ForschungForm';
import { ArtefakteTab } from '@/plugins/bauantraege/ArtefakteTab';
import { useDokumenteStore } from '@/plugins/dokumente/store';
import { DocConverter } from '@/core/services/converter';
import { applyTransition } from '@/core/services/workflow/engine';
import { loadHistory, addHistoryEntry } from '@/core/services/workflow/history';
import { getDaysUntilDeadline, isOverdue } from '@/core/services/workflow/deadlines';
import type { HistoryEntry } from '@/core/services/workflow/history';
import { FORSCHUNG_STATUS_LABELS } from './types';
import type { ForschungsVorgang } from './types';

const converter = new DocConverter();

export function ForschungDetail(): React.ReactElement | null {
  const storage = useStorage();
  const { antraege, selectedId, setSelectedId, update, remove } = useForschungStore();
  const vorgang = antraege.find(v => v.id === selectedId);
  const [activeTab, setActiveTab] = useState('uebersicht');
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { if (vorgang) { setNotes(vorgang.notes); loadHistory(vorgang.id, storage).then(setHistory); } }, [vorgang, storage]);

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
    await update(updated as ForschungsVorgang, storage);
    await addHistoryEntry(vorgang.id, entry, storage);
    setHistory(prev => [entry, ...prev]);
  };

  if (!vorgang) return null;

  const daysLeft = getDaysUntilDeadline(vorgang);
  const overdue = isOverdue(vorgang);
  const formatEuro = (n: number): string => n > 0 ? `${n.toLocaleString('de-DE')} €` : '—';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => setSelectedId(null)} className="flex items-center gap-1 text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] mb-4 cursor-pointer">
        <ArrowLeft size={14} /> Alle Forschungsanträge
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
          <StatusSelect currentStatus={vorgang.status} type="forschung" labels={FORSCHUNG_STATUS_LABELS} onChange={handleStatusChange} />
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
            <Field label="Projektleiter" value={vorgang.projektleiter || '—'} />
            <Field label="Institution" value={vorgang.institution || '—'} />
            <Field label="Förderprogramm" value={vorgang.foerderprogramm || '—'} />
            <Field label="Fördersumme" value={formatEuro(vorgang.foerdersumme)} />
            <Field label="Laufzeit" value={vorgang.laufzeit || '—'} />
            <Field label="Forschungsgebiet" value={vorgang.forschungsgebiet || '—'} />
            <div>
              <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-1">Frist</p>
              <div className="flex items-center gap-2">
                {daysLeft !== null && <span className={`w-1.5 h-1.5 rounded-full ${daysLeft < 3 ? 'bg-[var(--tf-danger-text)]' : daysLeft < 7 ? 'bg-[var(--tf-warning-text)]' : 'bg-[var(--tf-text-tertiary)]'}`} />}
                <p className="text-[14px] font-medium text-[var(--tf-text)]">{vorgang.deadline ? new Date(vorgang.deadline).toLocaleDateString('de-DE') : '—'}</p>
              </div>
            </div>
            <Field label="Erstellt" value={new Date(vorgang.created).toLocaleDateString('de-DE')} />
            <div>
              <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-1">Tags</p>
              <div className="flex gap-1 flex-wrap">
                {vorgang.tags.length > 0 ? vorgang.tags.map(t => <Badge key={t}>{t}</Badge>) : <span className="text-[var(--tf-text-tertiary)]">—</span>}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'dokumente' && <DokumenteTab vorgangId={vorgang.id} />}
        {activeTab === 'artefakte' && <ArtefakteTab vorgang={vorgang} userName="" />}
        {activeTab === 'verlauf' && (
          <div>
            <SectionHeader label="Änderungshistorie" />
            {history.length === 0 ? <p className="text-[13px] text-[var(--tf-text-secondary)] mt-3">Noch keine Statusänderungen</p> : (
              <div className="mt-3 space-y-4">
                {history.map((e, i) => (
                  <div key={i}>
                    <p className="text-[12px] text-[var(--tf-text-tertiary)]">{new Date(e.timestamp).toLocaleString('de-DE')}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="default">{FORSCHUNG_STATUS_LABELS[e.fromStatus] ?? e.fromStatus}</Badge>
                      <span className="text-[var(--tf-text-tertiary)]">→</span>
                      <Badge variant="info">{FORSCHUNG_STATUS_LABELS[e.toStatus] ?? e.toStatus}</Badge>
                    </div>
                    {e.comment && <p className="text-[13px] text-[var(--tf-text-secondary)] italic mt-1">{e.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'notizen' && (
          <div className="space-y-2">
            <textarea value={notes} onChange={e => handleNotesChange(e.target.value)} rows={8} placeholder="Notizen..."
              className="w-full px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none resize-y placeholder:text-[var(--tf-text-tertiary)]"
              style={{ border: '0.5px solid var(--tf-border)' }} />
            {saved && <p className="flex items-center gap-1 text-[12px] text-[var(--tf-success-text)]"><Check size={12} /> Gespeichert</p>}
          </div>
        )}
      </div>

      <ForschungForm open={showForm} onClose={() => setShowForm(false)} initialValues={vorgang} />
      <Dialog open={showDelete} onClose={() => setShowDelete(false)} title="Antrag löschen?"
        footer={<><Button variant="secondary" onClick={() => setShowDelete(false)}>Abbrechen</Button><Button variant="danger" onClick={async () => { await remove(vorgang.id, storage); setShowDelete(false); }}>Endgültig löschen</Button></>}>
        <p className="text-[13px] text-[var(--tf-text-secondary)]">Soll &quot;{vorgang.title}&quot; wirklich gelöscht werden?</p>
      </Dialog>
    </div>
  );
}

function DokumenteTab({ vorgangId }: { vorgangId: string }): React.ReactElement {
  const storage = useStorage();
  const { documents, add } = useDokumenteStore();
  const vorgangDocs = documents.filter(d => d.vorgangId === vorgangId);
  const handleFiles = async (files: File[]): Promise<void> => {
    for (const file of files) {
      try { const r = await converter.convert(file); await add({ filename: r.filename, format: r.format, markdown: r.markdown, tags: [], vorgangId }, storage); }
      catch (err) { console.error('Conversion failed:', err); }
    }
  };
  return (
    <div className="space-y-4">
      <FileDropZone onFiles={handleFiles} accept=".docx,.pdf,.md,.txt" multiple />
      {vorgangDocs.length > 0 ? (
        <div><SectionHeader label="Zugeordnete Dokumente" />
          {vorgangDocs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
              <Badge variant="info">{doc.format.toUpperCase()}</Badge>
              <span className="text-[13px] text-[var(--tf-text)]">{doc.filename}</span>
            </div>
          ))}
        </div>
      ) : <p className="text-[13px] text-[var(--tf-text-secondary)]">Noch keine Dokumente zugeordnet</p>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }): React.ReactElement {
  return (<div><p className="text-[12px] text-[var(--tf-text-tertiary)] mb-1">{label}</p><p className="text-[14px] font-medium text-[var(--tf-text)]">{value}</p></div>);
}
