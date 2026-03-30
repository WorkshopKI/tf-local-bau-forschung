import { useEffect, useMemo, useState } from 'react';
import { Plus, FlaskConical } from 'lucide-react';
import { Button, Badge, SectionHeader, ListItem } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useSearch } from '@/core/hooks/useSearch';
import { useForschungStore } from './store';
import { ForschungForm } from './ForschungForm';
import { FORSCHUNG_STATUS_LABELS, FORSCHUNG_STATUS_VARIANTS } from './types';

export function ForschungListe(): React.ReactElement {
  const storage = useStorage();
  const { indexDocument } = useSearch();
  const { antraege, filters, loadAll, setSelectedId, setFilters } = useForschungStore();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadAll(storage); }, [storage, loadAll]);

  useEffect(() => {
    for (const v of antraege) {
      indexDocument({ id: v.id, text: `${v.title} ${v.notes} ${v.foerderprogramm} ${v.forschungsgebiet} ${v.tags.join(' ')}`, title: v.title, source: v.id, tags: v.tags, type: 'forschung' });
    }
  }, [antraege, indexDocument]);

  const filtered = useMemo(() => {
    return antraege.filter(v => {
      if (filters.status && v.status !== filters.status) return false;
      if (filters.search && !v.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  }, [antraege, filters]);

  const formatEuro = (n: number): string => n > 0 ? `${n.toLocaleString('de-DE')} €` : '';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Forschungsanträge</h1>
        <Button variant="secondary" icon={Plus} onClick={() => setShowForm(true)}>Neuer Antrag</Button>
      </div>

      <div className="flex gap-3 mb-6">
        <select value={filters.status} onChange={e => setFilters({ status: e.target.value })}
          className="px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
          style={{ border: '0.5px solid var(--tf-border)' }}>
          <option value="">Alle Status</option>
          {Object.entries(FORSCHUNG_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={filters.search} onChange={e => setFilters({ search: e.target.value })}
          placeholder="Suche..." className="flex-1 px-3 py-2 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none placeholder:text-[var(--tf-text-tertiary)]"
          style={{ border: '0.5px solid var(--tf-border)' }} />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FlaskConical size={40} className="text-[var(--tf-text-tertiary)] mb-4" />
          <p className="text-[var(--tf-text-secondary)] mb-4">Noch keine Forschungsanträge</p>
          <Button variant="ghost" icon={Plus} onClick={() => setShowForm(true)}>Ersten Antrag erstellen</Button>
        </div>
      ) : (
        <div>
          <SectionHeader label="Aktuelle Anträge" />
          {filtered.map((v, i) => (
            <ListItem key={v.id} title={v.title}
              subtitle={`${v.foerderprogramm}${v.foerdersumme ? ` · ${formatEuro(v.foerdersumme)}` : ''}`}
              meta={<><Badge variant={FORSCHUNG_STATUS_VARIANTS[v.status] ?? 'default'}>{FORSCHUNG_STATUS_LABELS[v.status] ?? v.status}</Badge>
                <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)]">{v.id}</span></>}
              onClick={() => setSelectedId(v.id)} last={i === filtered.length - 1} />
          ))}
        </div>
      )}

      <ForschungForm open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}
