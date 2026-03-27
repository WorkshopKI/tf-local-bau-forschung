import { useEffect, useMemo, useState } from 'react';
import { Plus, Building2 } from 'lucide-react';
import { Button, Badge, Card } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useBauantraegeStore } from './store';
import { BauantragForm } from './BauantragForm';
import type { VorgangStatus } from '@/core/types/vorgang';

const STATUS_LABELS: Record<VorgangStatus, string> = {
  neu: 'Neu', in_bearbeitung: 'In Bearbeitung', nachforderung: 'Nachforderung',
  in_pruefung: 'In Prüfung', genehmigt: 'Genehmigt', abgelehnt: 'Abgelehnt', archiviert: 'Archiviert',
};

const STATUS_VARIANTS: Record<VorgangStatus, 'info' | 'warning' | 'success' | 'error' | 'default'> = {
  neu: 'info', in_bearbeitung: 'warning', nachforderung: 'warning',
  in_pruefung: 'info', genehmigt: 'success', abgelehnt: 'error', archiviert: 'default',
};

export function BauantraegeListe(): React.ReactElement {
  const storage = useStorage();
  const { bauantraege, filters, loadAll, setSelectedId, setFilters } = useBauantraegeStore();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadAll(storage); }, [storage, loadAll]);

  const filtered = useMemo(() => {
    return bauantraege.filter(v => {
      if (filters.status && v.status !== filters.status) return false;
      if (filters.search && !v.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  }, [bauantraege, filters]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[var(--tf-text)]">Bauanträge</h1>
        <Button icon={Plus} onClick={() => setShowForm(true)}>Neuer Antrag</Button>
      </div>

      <div className="flex gap-3 mb-6">
        <select
          value={filters.status}
          onChange={e => setFilters({ status: e.target.value })}
          className="px-3 py-2 text-sm bg-[var(--tf-bg)] text-[var(--tf-text)] border border-[var(--tf-border)] rounded-[var(--tf-radius-sm)] outline-none"
        >
          <option value="">Alle Status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input
          value={filters.search}
          onChange={e => setFilters({ search: e.target.value })}
          placeholder="Suche..."
          className="flex-1 px-3 py-2 text-sm bg-[var(--tf-bg)] text-[var(--tf-text)] border border-[var(--tf-border)] rounded-[var(--tf-radius-sm)] outline-none focus:ring-2 focus:ring-[var(--tf-primary)]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 size={48} className="text-[var(--tf-text-secondary)] mb-4" />
          <p className="text-lg text-[var(--tf-text-secondary)] mb-4">Noch keine Bauanträge</p>
          <Button icon={Plus} onClick={() => setShowForm(true)}>Ersten Antrag erstellen</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(v => (
            <Card key={v.id} className="cursor-pointer hover:border-[var(--tf-primary)] transition-colors"
              title={undefined}>
              <div onClick={() => setSelectedId(v.id)} className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm text-[var(--tf-text)]">{v.id}</span>
                  <span className="text-sm text-[var(--tf-text)]">{v.title}</span>
                  <Badge variant={STATUS_VARIANTS[v.status]}>{STATUS_LABELS[v.status]}</Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-[var(--tf-text-secondary)]">
                  <span>📅 {v.deadline ? new Date(v.deadline).toLocaleDateString('de-DE') : 'Keine Frist'}</span>
                  <span>👤 {v.assignee || 'Nicht zugewiesen'}</span>
                  {v.tags.length > 0 && (
                    <div className="flex gap-1">
                      {v.tags.map(t => <Badge key={t}>{t}</Badge>)}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <BauantragForm open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}
