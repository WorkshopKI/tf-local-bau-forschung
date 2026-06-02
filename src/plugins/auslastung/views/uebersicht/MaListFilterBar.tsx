/**
 * MaListFilterBar — Filter-Leiste über der MA-Liste.
 *
 * Layout:
 *   [Kategorie: Alle ›]  [Antragstyp: Alle ›]   [Tabelle|Karten]  [☐ Inaktive]  [+ MA hinzufügen]
 *
 * Filter-Chips = `CollapsibleSeg` (gleicher Pattern wie im „Anträge zuweisen"-
 * Cockpit). Kein Status-Filter (in der Auslastung nicht relevant).
 * View-Switch + Inaktive-Checkbox + „+MA hinzufügen" am rechten Rand.
 */
import { LayoutGrid, Menu, Plus } from 'lucide-react';
import { SegmentedToggle } from '@/ui/SegmentedToggle';
import { CollapsibleSeg, type CollapsibleSegItem } from '@/plugins/antraege/filter/CollapsibleSeg';
import { ALL_ANTRAGSTYP_BUCKETS, type AntragstypBucket, type UeberKategorie } from '../../types';

export type ViewMode = 'table' | 'cards';

interface Props {
  kategorien: UeberKategorie[];
  kategorieFilter: string;
  onKategorieFilter: (id: string) => void;
  antragstypFilter: AntragstypBucket | '';
  onAntragstypFilter: (b: AntragstypBucket | '') => void;
  counts: {
    all: number;
    perKategorie: Record<string, number>;
    perAntragstyp: Record<AntragstypBucket, number>;
  };
  view: ViewMode;
  onView: (v: ViewMode) => void;
  showInactive: boolean;
  onShowInactive: (v: boolean) => void;
  onAddMa: () => void;
  addBusy?: boolean;
}

export function MaListFilterBar({
  kategorien, kategorieFilter, onKategorieFilter, antragstypFilter, onAntragstypFilter,
  counts, view, onView, showInactive, onShowInactive,
  onAddMa, addBusy,
}: Props): React.ReactElement {
  const kategorieItems: CollapsibleSegItem[] = [
    { label: 'Alle', count: counts.all },
    ...kategorien.map(k => ({ label: k.id, count: counts.perKategorie[k.id] ?? 0 })),
  ];
  const antragstypItems: CollapsibleSegItem[] = [
    { label: 'Alle', count: counts.all },
    ...ALL_ANTRAGSTYP_BUCKETS.map(b => ({ label: b, count: counts.perAntragstyp[b] ?? 0 })),
  ];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Filter-Chips (kollabierbar) */}
      <div className="flex items-center gap-2 flex-wrap">
        <CollapsibleSeg
          label="Kategorie"
          value={kategorieFilter || 'Alle'}
          items={kategorieItems}
          onChange={(l) => onKategorieFilter(l === 'Alle' ? '' : l)}
        />
        <CollapsibleSeg
          label="Antragstyp"
          value={antragstypFilter || 'Alle'}
          items={antragstypItems}
          onChange={(l) => onAntragstypFilter(l === 'Alle' ? '' : (l as AntragstypBucket))}
        />
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3 flex-wrap">
        <SegmentedToggle<ViewMode>
          value={view}
          onChange={onView}
          ariaLabel="MA-Liste Ansicht"
          options={[
            { id: 'table', label: 'Tabelle', icon: <Menu size={13} /> },
            { id: 'cards', label: 'Karten', icon: <LayoutGrid size={13} /> },
          ]}
        />
        <label className="inline-flex items-center gap-1.5 cursor-pointer text-[12px] text-[var(--tf-text-secondary)]">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => onShowInactive(e.target.checked)}
          />
          <span>Inaktive anzeigen</span>
        </label>
        <button
          type="button"
          onClick={onAddMa}
          disabled={addBusy}
          className="inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
          style={{
            height: 30,
            padding: '0 12px',
            background: 'var(--tf-text)',
            color: 'var(--tf-bg)',
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 500,
          }}
        >
          <Plus size={13} />
          MA hinzufügen
        </button>
      </div>
    </div>
  );
}
