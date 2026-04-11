import { ArrowLeft, Pencil, Trash2, Check } from 'lucide-react';
import { Button, Badge, Tabs, Dialog } from '@/ui';
import { StatusSelect } from '@/ui/StatusSelect';
import { MarkdownEditor } from '@/ui/MarkdownEditor';
import { VorgangDokumenteTab } from '@/core/components/VorgangDokumenteTab';
import { VerlaufTab } from '@/core/components/VerlaufTab';
import { SimilarCases } from '@/core/components/SimilarCases';
import { useVorgangDetail } from '@/core/hooks/useVorgangDetail';
import { useStorage } from '@/core/hooks/useStorage';
import { useForschungStore } from './store';
import { ForschungForm } from './ForschungForm';
import { ArtefakteTab } from '@/core/components/ArtefakteTab';
import { FORSCHUNG_STATUS_LABELS } from './types';

export function ForschungDetail(): React.ReactElement | null {
  const storage = useStorage();
  const { antraege, selectedId, setSelectedId, update, remove } = useForschungStore();
  const vorgang = antraege.find(v => v.id === selectedId);

  const {
    activeTab, setActiveTab, showForm, setShowForm, showDelete, setShowDelete,
    notes, saved, history, handleNotesChange, handleStatusChange, daysLeft, overdue,
  } = useVorgangDetail({ vorgang, update });

  if (!vorgang) return null;

  const formatEuro = (n: number): string => n > 0 ? `${n.toLocaleString('de-DE')} \u20ac` : '\u2014';

  return (
    <div className="p-6 max-w-5xl mx-auto">
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 mt-2">
        <div>
          <Tabs tabs={[
            { id: 'uebersicht', label: 'Übersicht' },
            { id: 'dokumente', label: 'Dokumente' },
            { id: 'artefakte', label: 'Artefakte' },
            { id: 'verlauf', label: 'Verlauf' },
          ]} activeTab={activeTab} onChange={setActiveTab} />
          <div className="mt-6">
            {activeTab === 'uebersicht' && (
              <div className="space-y-2">
                <MarkdownEditor value={notes} onChange={handleNotesChange} placeholder="Notizen zum Vorgang..." minHeight="200px" />
                {saved && <p className="flex items-center gap-1 text-[12px] text-[var(--tf-success-text)]"><Check size={12} /> Gespeichert</p>}
              </div>
            )}
            {activeTab === 'dokumente' && <VorgangDokumenteTab vorgangId={vorgang.id} />}
            {activeTab === 'artefakte' && <ArtefakteTab vorgang={vorgang} userName="" />}
            {activeTab === 'verlauf' && <VerlaufTab history={history} />}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-4 space-y-3">
            <p className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]">Details</p>
            <div className="space-y-2 text-[12px]">
              <AsideRow label="Projektleiter" value={vorgang.projektleiter || '\u2014'} />
              <AsideRow label="Institution" value={vorgang.institution || '\u2014'} />
              <AsideRow label="Foerderprogramm" value={vorgang.foerderprogramm || '\u2014'} />
              <AsideRow label="Foerdersumme" value={formatEuro(vorgang.foerdersumme)} />
              <AsideRow label="Laufzeit" value={vorgang.laufzeit || '\u2014'} />
              <AsideRow label="Forschungsgebiet" value={vorgang.forschungsgebiet || '\u2014'} />
              <AsideRow label="Erstellt" value={new Date(vorgang.created).toLocaleDateString('de-DE')} />
              <AsideRow label="Geaendert" value={new Date(vorgang.modified).toLocaleDateString('de-DE')} />
            </div>
            {vorgang.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap pt-1" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                {vorgang.tags.map(t => <Badge key={t}>{t}</Badge>)}
              </div>
            )}
          </div>
          <SimilarCases vorgang={vorgang} />
        </div>
      </div>

      <ForschungForm open={showForm} onClose={() => setShowForm(false)} initialValues={vorgang} />
      <Dialog open={showDelete} onClose={() => setShowDelete(false)} title="Antrag löschen?"
        footer={<><Button variant="secondary" onClick={() => setShowDelete(false)}>Abbrechen</Button><Button variant="danger" onClick={async () => { await remove(vorgang.id, storage); setShowDelete(false); }}>Endgültig löschen</Button></>}>
        <p className="text-[13px] text-[var(--tf-text-secondary)]">Soll &quot;{vorgang.title}&quot; wirklich gelöscht werden?</p>
      </Dialog>
    </div>
  );
}

function AsideRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--tf-text-tertiary)]">{label}</span>
      <span className="text-[var(--tf-text)]">{value}</span>
    </div>
  );
}
