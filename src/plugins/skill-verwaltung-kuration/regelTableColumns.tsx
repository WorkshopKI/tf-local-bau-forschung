/**
 * Spalten-Definitionen für die Qualitätsregeln-Tabellen-Ansicht.
 * Spiegelt die Skills-Tabelle (gleiche `SortableTable`-Optik). Die Aktiv-Zelle
 * trägt einen interaktiven Toggle — `stopPropagation`, damit der Zeilen-Klick
 * (= Bearbeiten) nicht zusätzlich feuert.
 */
import type { SortableColumn } from '@/components/data-table';
import {
  describeRegelParams,
  skillsUsingRegel,
  type QualitaetsRegel,
  type SkillRegistryFile,
} from '@/core/services/skill-registry';
import { TYP_LABEL, SevPill, Switch } from './regelShared';

export interface RegelColumnActions {
  canEdit: boolean;
  busy: boolean;
  onToggleAktiv: (r: QualitaetsRegel) => void;
}

export function buildRegelColumns(
  file: SkillRegistryFile,
  actions: RegelColumnActions,
): SortableColumn<QualitaetsRegel>[] {
  return [
    {
      key: 'name', label: 'Regel', defaultVisible: true, locked: true, sortable: true, width: 180, wrap: false,
      accessor: r => r.name.toLowerCase(),
      render: r => <span className="font-medium text-[var(--tf-text)]">{r.name}</span>,
    },
    {
      key: 'typ', label: 'Typ', defaultVisible: true, sortable: true, width: 150, wrap: false,
      accessor: r => TYP_LABEL[r.typ] ?? r.typ,
      render: r => (
        <span className="text-[11px] px-2.5 py-1 rounded-[99px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
          {TYP_LABEL[r.typ] ?? 'unbekannter Typ'}
        </span>
      ),
    },
    {
      key: 'parameter', label: 'Parameter', defaultVisible: true, sortable: false, width: 300, wrap: true,
      accessor: r => describeRegelParams(r),
      render: r => <span className="text-[var(--tf-text-secondary)]">{describeRegelParams(r)}</span>,
    },
    {
      key: 'schweregrad', label: 'Schweregrad', defaultVisible: true, sortable: true, width: 120, wrap: false,
      accessor: r => r.schweregrad,
      render: r => <SevPill s={r.schweregrad} />,
    },
    {
      key: 'aktiv', label: 'Aktiv', defaultVisible: true, sortable: false, width: 80, wrap: false,
      accessor: r => (r.aktiv ? 1 : 0),
      render: r => (
        <span className="inline-flex" onClick={e => e.stopPropagation()}>
          <Switch on={r.aktiv} disabled={!actions.canEdit || actions.busy} onClick={() => actions.onToggleAktiv(r)} />
        </span>
      ),
    },
    {
      key: 'verwendet', label: 'Verwendet in', defaultVisible: true, sortable: false, width: 160, wrap: true,
      accessor: r => skillsUsingRegel(file, r.id).join(', '),
      render: r => {
        const used = skillsUsingRegel(file, r.id);
        return used.length
          ? <span className="text-[var(--tf-text-secondary)]">{used.join(', ')}</span>
          : <span className="text-[var(--tf-text-tertiary)]">—</span>;
      },
    },
  ];
}
