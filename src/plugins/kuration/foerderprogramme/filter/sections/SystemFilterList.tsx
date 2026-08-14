import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import type { FilterDefinition } from '@/core/services/csv';
import { updateSystemFilterVisibility } from '@/core/services/csv';
import { humanizeFilterTyp } from '../utils';

interface Props {
  filters: FilterDefinition[];
  canEdit: boolean;
  onChanged: () => Promise<void> | void;
}

export function SystemFilterList({ filters, canEdit, onChanged }: Props): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();

  const toggleHidden = async (f: FilterDefinition): Promise<void> => {
    await updateSystemFilterVisibility(
      storage.idb,
      f.id,
      !f.versteckt,
      session.kuratorName ?? undefined,
    );
    await onChanged();
  };

  if (filters.length === 0) {
    return (
      <div className="py-8 text-center text-[13px] text-[var(--tf-text-tertiary)]">
        Keine System-Filter vorhanden.
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-[12px] text-[var(--tf-text-secondary)]">
        Eingebaute Filter sind read-only, können aber aus der Sidebar ausgeblendet werden.
      </p>
      {filters.map((f, i) => (
        <div
          key={f.id}
          className="flex items-center justify-between py-3"
          style={i === filters.length - 1 ? undefined : { borderBottom: '0.5px solid var(--tf-border)' }}
        >
          <div className="min-w-0 flex-1">
            <div className="text-[14px] text-[var(--tf-text)] flex items-center gap-2">
              {f.name}
              {f.config.disabled ? (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600">
                  Platzhalter
                </span>
              ) : null}
            </div>
            <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">
              <span className="font-mono">{f.feld}</span> · {humanizeFilterTyp(f.typ)}
              {f.description ? ` · ${f.description}` : ''}
            </div>
          </div>
          <label className="flex items-center gap-2 text-[12.5px] text-[var(--tf-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={f.versteckt}
              onChange={() => void toggleHidden(f)}
              disabled={!canEdit}
              className="accent-[var(--tf-primary)]"
            />
            versteckt
          </label>
        </div>
      ))}
    </div>
  );
}
