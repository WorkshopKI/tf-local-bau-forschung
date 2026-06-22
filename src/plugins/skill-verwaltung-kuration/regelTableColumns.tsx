/**
 * Spalten-Definitionen für die Qualitätsregeln-Tabellen-Ansicht.
 * Spiegelt die Skills-Tabelle (gleiche `SortableTable`-Optik). Operiert auf
 * `RegelRow` (Wrapper um die Regel — erlaubt Skill-Duplikate bei „Gruppiert:
 * Skill"). Die Aktiv-Zelle trägt einen interaktiven Toggle — `stopPropagation`,
 * damit der Zeilen-Klick (= Bearbeiten) nicht zusätzlich feuert.
 *
 * Filter: typ/schweregrad/aktiv/verwendet sind `filterable` → die `SortableTable`
 * rendert die Filter-Dropdowns. Kandidaten + Matching liefert
 * `useRegelColumnFilters` (Membership für „Verwendet in").
 */
import type { SortableColumn } from '@/components/data-table';
import {
  describeRegelParams,
  skillsUsingRegel,
  type QualitaetsRegel,
  type SkillRegistryFile,
} from '@/core/services/skills';
import { SevPill, Switch, typLabel, kategorieLabel } from './regelShared';
import type { RegelRow } from './regelGrouping';

export interface RegelColumnActions {
  canEdit: boolean;
  busy: boolean;
  onToggleAktiv: (r: QualitaetsRegel) => void;
}

export function buildRegelColumns(
  file: SkillRegistryFile,
  actions: RegelColumnActions,
): SortableColumn<RegelRow>[] {
  return [
    {
      key: 'name', label: 'Regel', defaultVisible: true, locked: true, sortable: true, width: 180, wrap: false,
      accessor: row => row.regel.name.toLowerCase(),
      render: row => <span className="font-medium text-[var(--tf-text)]">{row.regel.name}</span>,
    },
    {
      key: 'typ', label: 'Typ', defaultVisible: true, sortable: true, filterable: true, width: 150, wrap: false,
      accessor: row => typLabel(row.regel),
      render: row => (
        <span className="text-[11px] px-2.5 py-1 rounded-[99px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
          {typLabel(row.regel)}
        </span>
      ),
    },
    {
      key: 'kategorie', label: 'Art', defaultVisible: true, sortable: true, filterable: true, width: 150, wrap: false,
      accessor: row => kategorieLabel(row.regel),
      render: row => (
        <span className="text-[11px] px-2.5 py-1 rounded-[99px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
          {kategorieLabel(row.regel)}
        </span>
      ),
    },
    {
      key: 'parameter', label: 'Parameter', defaultVisible: true, sortable: false, width: 300, wrap: true,
      accessor: row => describeRegelParams(row.regel),
      render: row => <span className="text-[var(--tf-text-secondary)]">{describeRegelParams(row.regel)}</span>,
    },
    {
      key: 'schweregrad', label: 'Schweregrad', defaultVisible: true, sortable: true, filterable: true, width: 120, wrap: false,
      accessor: row => row.regel.schweregrad,
      render: row => <SevPill s={row.regel.schweregrad} />,
    },
    {
      key: 'aktiv', label: 'Aktiv', defaultVisible: true, sortable: false, filterable: true, width: 80, wrap: false,
      accessor: row => (row.regel.aktiv ? 1 : 0),
      render: row => (
        <span className="inline-flex" onClick={e => e.stopPropagation()}>
          <Switch on={row.regel.aktiv} disabled={!actions.canEdit || actions.busy} onClick={() => actions.onToggleAktiv(row.regel)} />
        </span>
      ),
    },
    {
      key: 'verwendet', label: 'Verwendet in', defaultVisible: true, sortable: false, filterable: true, width: 160, wrap: true,
      accessor: row => skillsUsingRegel(file, row.regel.id).join(', '),
      render: row => {
        const used = skillsUsingRegel(file, row.regel.id);
        return used.length
          ? <span className="text-[var(--tf-text-secondary)]">{used.join(', ')}</span>
          : <span className="text-[var(--tf-text-tertiary)]">—</span>;
      },
    },
  ];
}
