import { useEffect, useMemo, useState } from 'react';
import { Plus, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Badge, SectionHeader, ListItem } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useSearch } from '@/core/hooks/useSearch';
import { useBauantraegeStore } from './store';
import { BauantragForm } from './BauantragForm';
import { BAUANTRAG_STATUS_LABELS, BAUANTRAG_STATUS_VARIANTS } from './types';

export function BauantraegeListe(): React.ReactElement {
  const storage = useStorage();
  const navigate = useNavigate();
  const { indexDocument } = useSearch();
  const { bauantraege, filters, loadAll, setFilters } = useBauantraegeStore();
  const [showForm, setShowForm] = useState(false);
  const openDetail = (id: string): void => navigate(`/bauantraege/${encodeURIComponent(id)}`);

  useEffect(() => { loadAll(storage); }, [storage, loadAll]);

  useEffect(() => {
    for (const v of bauantraege) {
      indexDocument({ id: v.id, text: `${v.title} ${v.notes} ${v.tags.join(' ')}`, title: v.title, source: v.id, tags: v.tags, type: 'bauantrag' });
    }
  }, [bauantraege, indexDocument]);

  const filtered = useMemo(() => {
    return bauantraege.filter(v => {
      if (filters.status && v.status !== filters.status) return false;
      if (filters.search && !v.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  }, [bauantraege, filters]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Bauanträge</h1>
        <Button variant="secondary" icon={Plus} onClick={() => setShowForm(true)}>Neuer Antrag</Button>
      </div>

      <div className="flex gap-3 mb-6">
        <select
          value={filters.status}
          onChange={e => setFilters({ status: e.target.value })}
          className="px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          <option value="">Alle Status</option>
          {Object.entries(BAUANTRAG_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input
          value={filters.search}
          onChange={e => setFilters({ search: e.target.value })}
          placeholder="Suche..."
          className="flex-1 px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
          style={{ border: '0.5px solid var(--tf-border)' }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 size={40} className="text-[var(--tf-text-tertiary)] mb-4" />
          <p className="text-[var(--tf-text-secondary)] mb-4">Noch keine Bauanträge</p>
          <Button variant="ghost" icon={Plus} onClick={() => setShowForm(true)}>Ersten Antrag erstellen</Button>
        </div>
      ) : (
        <div>
          <SectionHeader label="Aktuelle Vorgänge" />
          {filtered.map((v, i) => (
            <ListItem
              key={v.id}
              title={v.title}
              subtitle={`${v.deadline ? new Date(v.deadline).toLocaleDateString('de-DE') : 'Keine Frist'} · ${v.assignee || 'Nicht zugewiesen'}`}
              meta={
                <>
                  <Badge variant={BAUANTRAG_STATUS_VARIANTS[v.status]}>{BAUANTRAG_STATUS_LABELS[v.status]}</Badge>
                  <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)]">{v.id}</span>
                </>
              }
              onClick={() => openDetail(v.id)}
              last={i === filtered.length - 1}
            />
          ))}
        </div>
      )}

      <BauantragForm open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}
