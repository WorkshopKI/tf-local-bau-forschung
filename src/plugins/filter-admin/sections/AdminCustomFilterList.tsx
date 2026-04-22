import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { Button } from '@/components/ui/button';
import type { FilterDefinition } from '@/core/services/csv';
import { removeFilter } from '@/core/services/csv';
import { humanizeFilterTyp } from '../utils';

interface Props {
  filters: FilterDefinition[];
  canEdit: boolean;
  onEdit: (f: FilterDefinition) => void;
  onChanged: () => Promise<void> | void;
}

export function AdminCustomFilterList({ filters, canEdit, onEdit, onChanged }: Props): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();

  const handleDelete = async (f: FilterDefinition): Promise<void> => {
    if (!confirm(`Filter "${f.name}" löschen?`)) return;
    await removeFilter(storage.idb, f.id, session.kuratorName ?? undefined);
    await onChanged();
  };

  if (filters.length === 0) {
    return (
      <div className="py-8 text-center text-[13px] text-[var(--tf-text-tertiary)]">
        Noch keine Kurator-Custom-Filter. Klick "Neuer Filter" um einen anzulegen.
      </div>
    );
  }

  return (
    <div>
      {filters.map((f, i) => (
        <div
          key={f.id}
          className="flex items-center justify-between py-3 gap-3"
          style={i === filters.length - 1 ? undefined : { borderBottom: '0.5px solid var(--tf-border)' }}
        >
          <div className="min-w-0 flex-1">
            <div className="text-[14px] text-[var(--tf-text)]">{f.name}</div>
            <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">
              <span className="font-mono">{f.feld}</span> · {humanizeFilterTyp(f.typ)}
              {f.created_by ? ` · ${f.created_by}` : ''}
              {` · Reihenfolge ${f.anzeige_reihenfolge}`}
              {f.versteckt ? ' · versteckt' : ''}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(f)} disabled={!canEdit}>
              Bearbeiten
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void handleDelete(f)} disabled={!canEdit}>
              Löschen
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
