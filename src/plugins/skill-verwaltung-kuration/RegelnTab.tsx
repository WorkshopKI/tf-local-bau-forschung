import { useMemo, useState } from 'react';
import {
  describeRegelParams,
  skillsUsingRegel,
  type QualitaetsRegel,
  type SkillRegistryFile,
} from '@/core/services/skill-registry';
import {
  SortableTable,
  ColumnPicker,
  useTableSort,
  useColumnVisibility,
  useColumnWidths,
  compareValues,
} from '@/components/data-table';
import { CollapsibleSeg } from '@/plugins/antraege/filter/CollapsibleSeg';
import { TYP_LABEL, SevPill, Switch } from './regelShared';
import { buildRegelColumns } from './regelTableColumns';
import { useRegelColumnFilters } from './useRegelColumnFilters';
import {
  buildRegelSectionRows,
  loadRegelGrouping,
  saveRegelGrouping,
  labelForMode,
  modeForLabel,
  REGEL_GROUPING_OPTIONS,
  type RegelGroupingMode,
  type RegelRow,
} from './regelGrouping';
import type { RegistryViewMode } from './RegistryViewModeToggle';

interface RegelnTabProps {
  file: SkillRegistryFile;
  canEdit: boolean;
  busy: boolean;
  search: string;
  viewMode: RegistryViewMode;
  onEdit: (regel: QualitaetsRegel) => void;
  onToggleAktiv: (regel: QualitaetsRegel) => void;
}

function TypPill({ typ }: { typ: string }): React.ReactElement {
  return (
    <span className="text-[11px] px-2.5 py-1 rounded-[99px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] whitespace-nowrap">
      {TYP_LABEL[typ] ?? 'unbekannter Typ'}
    </span>
  );
}

/** Sektions-Band in der gruppierten Tabelle (Optik wie Förderanträge `StatusBand`). */
function RegelBand({ label, count }: { label: string; count: number }): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] tracking-[0.08em] uppercase font-medium text-[var(--tf-text-tertiary)]">{label}</span>
      <span className="text-[10.5px] font-mono text-[var(--tf-text-tertiary)]">{count.toLocaleString('de-DE')}</span>
      <div className="flex-1 h-px bg-[var(--tf-border)]" />
    </div>
  );
}

export function RegelnTab({
  file, canEdit, busy, search, viewMode, onEdit, onToggleAktiv,
}: RegelnTabProps): React.ReactElement {
  const [grouping, setGrouping] = useState<RegelGroupingMode>(loadRegelGrouping);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return file.regeln;
    return file.regeln.filter(r =>
      r.name.toLowerCase().includes(q)
      || (TYP_LABEL[r.typ] ?? r.typ).toLowerCase().includes(q)
      || describeRegelParams(r).toLowerCase().includes(q));
  }, [file.regeln, search]);

  const onGroupingChange = (mode: RegelGroupingMode): void => {
    setGrouping(mode);
    saveRegelGrouping(mode);
  };

  const intro = (
    <p className="text-[13.5px] leading-[1.55] text-[var(--tf-text-secondary)] m-0 mb-4 max-w-[720px]">
      Jede Regel kodiert eine Erfahrung — sie wird automatisch geprüft und der KI als Vorgabe mitgegeben.
    </p>
  );

  if (file.regeln.length === 0) {
    return (
      <div>
        {intro}
        <p className="text-[13.5px] text-[var(--tf-text-secondary)] py-2">Noch keine Regeln. Lege die erste an →</p>
      </div>
    );
  }

  let body: React.ReactElement;
  if (viewMode === 'table') {
    // Gruppierung + Spalten-Filter sind Tabellen-Features (wie Förderanträge).
    body = (
      <RegelnTableView
        file={file}
        regeln={filtered}
        canEdit={canEdit}
        busy={busy}
        grouping={grouping}
        onGroupingChange={onGroupingChange}
        onEdit={onEdit}
        onToggleAktiv={onToggleAktiv}
      />
    );
  } else if (filtered.length === 0) {
    body = <p className="text-[13.5px] text-[var(--tf-text-secondary)] py-6">Keine Treffer.</p>;
  } else if (viewMode === 'list') {
    body = (
      <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] overflow-hidden">
        {filtered.map((r, i) => {
          const used = skillsUsingRegel(file, r.id);
          return (
            <div
              key={r.id}
              onClick={() => onEdit(r)}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--tf-bg-secondary)] ${i > 0 ? 'border-t-[0.5px] border-[var(--tf-border)]' : ''}`}
            >
              <span className="text-[13.5px] font-medium text-[var(--tf-text)] whitespace-nowrap">{r.name}</span>
              <TypPill typ={r.typ} />
              <span className="text-[12px] text-[var(--tf-text-tertiary)] truncate flex-1 min-w-0">{describeRegelParams(r)}</span>
              <SevPill s={r.schweregrad} />
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)] whitespace-nowrap max-w-[160px] truncate">
                {used.length ? used.join(', ') : '—'}
              </span>
              <span className="inline-flex shrink-0" onClick={e => e.stopPropagation()}>
                <Switch on={r.aktiv} disabled={!canEdit || busy} onClick={() => onToggleAktiv(r)} />
              </span>
            </div>
          );
        })}
      </div>
    );
  } else {
    // viewMode === 'cards'
    body = (
      <div className="flex flex-col gap-3.5">
        {filtered.map(r => {
          const used = skillsUsingRegel(file, r.id);
          return (
            <div key={r.id} className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] p-[20px]">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[15px] font-medium text-[var(--tf-text)] m-0">{r.name}</h2>
                <span className="inline-flex shrink-0" onClick={e => e.stopPropagation()}>
                  <Switch on={r.aktiv} disabled={!canEdit || busy} onClick={() => onToggleAktiv(r)} />
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2.5">
                <TypPill typ={r.typ} />
                <SevPill s={r.schweregrad} />
              </div>
              <p className="text-[13px] leading-[1.55] text-[var(--tf-text-secondary)] mt-2.5">{describeRegelParams(r)}</p>
              <p className="text-[12px] text-[var(--tf-text-tertiary)] mt-2">
                Verwendet in: {used.length ? used.join(', ') : '—'}
              </p>
              <div className="mt-4 pt-3.5 border-t-[0.5px] border-[var(--tf-border)]">
                <button onClick={() => onEdit(r)} className="text-[13px] text-[var(--tf-text)] hover:opacity-70">
                  {canEdit ? 'Bearbeiten' : 'Ansehen'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return <div>{intro}{body}</div>;
}

interface TableViewProps {
  file: SkillRegistryFile;
  regeln: QualitaetsRegel[];
  canEdit: boolean;
  busy: boolean;
  grouping: RegelGroupingMode;
  onGroupingChange: (mode: RegelGroupingMode) => void;
  onEdit: (regel: QualitaetsRegel) => void;
  onToggleAktiv: (regel: QualitaetsRegel) => void;
}

function RegelnTableView({
  file, regeln, canEdit, busy, grouping, onGroupingChange, onEdit, onToggleAktiv,
}: TableViewProps): React.ReactElement {
  const columns = useMemo(
    () => buildRegelColumns(file, { canEdit, busy, onToggleAktiv }),
    [file, canEdit, busy, onToggleAktiv],
  );
  const { visibleKeys, toggleColumn } = useColumnVisibility('teamflow_regeln_table_columns', columns);
  const { widths, setWidth } = useColumnWidths('teamflow_regeln_table_col_widths', {});
  const visibleColumns = useMemo(
    () => columns.filter(c => visibleKeys.includes(c.key)),
    [columns, visibleKeys],
  );

  // Spalten-Header-Filter (inkl. n:m „Verwendet in") VOR der Gruppierung.
  const { columnFilters, setColumnFilter, filterCandidates, filteredRules } =
    useRegelColumnFilters(regeln, file);

  // Gruppierung → Section-Rows (kontiguierlich).
  const { rows, sectionOf } = useMemo(
    () => buildRegelSectionRows(filteredRules, grouping, file),
    [filteredRules, grouping, file],
  );

  const { sortKey, sortDirection, toggleSort, sortedRows } = useTableSort(rows, visibleColumns);

  // Section-stabil: bei aktiver Gruppierung INNERHALB der Sektionen sortieren
  // (der globale `sortedRows` würde die Bänder zerreißen) — Muster aus AntraegeTable.
  const orderedRows = useMemo(() => {
    if (sectionOf === null) return sortedRows;
    if (!sortKey) return rows;
    const col = visibleColumns.find(c => c.key === sortKey);
    if (!col) return rows;
    const out: RegelRow[] = [];
    let i = 0;
    while (i < rows.length) {
      const sec = sectionOf(rows[i]!);
      let j = i;
      while (j < rows.length && sectionOf(rows[j]!) === sec) j++;
      const slice = rows.slice(i, j);
      slice.sort((a, b) => compareValues(col.accessor(a), col.accessor(b), sortDirection));
      out.push(...slice);
      i = j;
    }
    return out;
  }, [sectionOf, sortKey, sortDirection, rows, sortedRows, visibleColumns]);

  const sectionProps = sectionOf !== null
    ? {
        sectionKeyOf: (r: RegelRow) => sectionOf(r),
        renderSectionHeader: (key: string, count: number) => <RegelBand label={key} count={count} />,
      }
    : {};

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <CollapsibleSeg
          label="Gruppiert"
          value={labelForMode(grouping)}
          items={REGEL_GROUPING_OPTIONS.map(o => ({ label: o.label }))}
          onChange={lbl => onGroupingChange(modeForLabel(lbl))}
          defaultValue="Keine"
          startCollapsed
        />
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[12px] text-[var(--tf-text-tertiary)]">
            {filteredRules.length} {filteredRules.length === 1 ? 'Regel' : 'Regeln'}
          </span>
          <ColumnPicker columns={columns} visibleKeys={visibleKeys} onToggleColumn={toggleColumn} />
        </div>
      </div>
      <SortableTable<RegelRow>
        rows={orderedRows}
        columns={visibleColumns}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        rowKey={r => r._rowKey}
        onRowClick={r => onEdit(r.regel)}
        emptyContent="Keine Regeln."
        columnWidths={widths}
        onColumnWidthChange={setWidth}
        columnFilters={columnFilters}
        onColumnFilterChange={setColumnFilter}
        filterCandidates={filterCandidates}
        {...sectionProps}
      />
    </div>
  );
}
