import { useMemo } from 'react';
import {
  describeRegelParams,
  skillsUsingRegel,
  type QualitaetsRegel,
  type SkillRegistryFile,
} from '@/core/services/skills';
import {
  SortableTable,
  ColumnPicker,
  useTableSort,
  useColumnVisibility,
  useColumnWidths,
  useTotalTableWidth,
  type SortableColumn,
} from '@/components/data-table';
import { CollapsibleSeg } from '@/plugins/antraege/filter/CollapsibleSeg';
import { ListItem } from '@/components/ui/ListItem';
import { TYP_LABEL, SevPill, Switch } from './regelShared';
import { buildRegelColumns, type RegelRow } from './regelTableColumns';
import { useRegelFilters, ALLE, type RegelFacetKey } from './useRegelFilters';
import type { ViewMode as RegistryViewMode } from '@/components/ui/ViewModeToggle';

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

/** Facetten der ersten Zeile (Förderanträge-Quickfilter-Optik). Keine „Typ"-Facette:
 *  der grob gruppierte Typ verdoppelte Kategorie/Prüfart (Kategorie wird aus typ+pruefart
 *  abgeleitet). Der granulare Typ bleibt nur in der Tabellen-Spalte. */
const FACETS_ROW1: { key: RegelFacetKey; label: string }[] = [
  { key: 'kategorie', label: 'Kategorie' },
  { key: 'pruefart', label: 'Prüfart' },
  { key: 'schweregrad', label: 'Schweregrad' },
  { key: 'aktiv', label: 'Aktiv' },
];

/** „Verwendet in" steht in einer eigenen zweiten Zeile — aufgeklappt wird die
 *  Skill-Liste sehr breit und würde sonst die übrigen Pillen verdrängen. */
const FACET_SKILL: { key: RegelFacetKey; label: string } = { key: 'skill', label: 'Verwendet in' };

export function RegelnTab({
  file, canEdit, busy, search, viewMode, onEdit, onToggleAktiv,
}: RegelnTabProps): React.ReactElement {
  // 1) Freitext-Suche (Name, Typ-Label, Parameter), 2) Facetten darüber.
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return file.regeln;
    return file.regeln.filter(r =>
      r.name.toLowerCase().includes(q)
      || (TYP_LABEL[r.typ] ?? r.typ).toLowerCase().includes(q)
      || describeRegelParams(r).toLowerCase().includes(q));
  }, [file.regeln, search]);

  const { values, setValue, resetAll, anyActive, candidates, filtered: visible } =
    useRegelFilters(searched, file);

  // Spalten-Definition + Sichtbarkeit hier (statt in der Tabelle), damit der
  // „Spalten"-Picker in derselben Zeile wie die Filter-Pillen sitzt.
  const columns = useMemo(
    () => buildRegelColumns(file, { canEdit, busy, onToggleAktiv }),
    [file, canEdit, busy, onToggleAktiv],
  );
  const { visibleKeys, toggleColumn } = useColumnVisibility('teamflow_regeln_table_columns', columns);

  if (file.regeln.length === 0) {
    return (
      <p className="text-[13.5px] text-[var(--tf-text-secondary)] py-2">Noch keine Regeln. Lege die erste an →</p>
    );
  }

  const renderFacet = (f: { key: RegelFacetKey; label: string }): React.ReactElement | null => {
    const opts = candidates[f.key];
    if (opts.length === 0) return null; // nichts zu filtern → Pille ausblenden
    return (
      <CollapsibleSeg
        key={f.key}
        label={f.label}
        value={values[f.key]}
        items={[{ label: ALLE }, ...opts.map(c => ({ label: c.label, count: c.count }))]}
        onChange={v => setValue(f.key, v)}
        defaultValue={ALLE}
        startCollapsed
      />
    );
  };

  const toolbar = (
    <div className="mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {FACETS_ROW1.map(renderFacet)}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {anyActive && (
            <button
              type="button"
              onClick={resetAll}
              className="text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
            >
              Zurücksetzen
            </button>
          )}
          {viewMode === 'table' && (
            <ColumnPicker columns={columns} visibleKeys={visibleKeys} onToggleColumn={toggleColumn} />
          )}
        </div>
      </div>
      {candidates.skill.length > 0 && (
        <div className="flex items-center gap-2 mt-2 min-w-0 overflow-x-auto">
          {renderFacet(FACET_SKILL)}
        </div>
      )}
    </div>
  );

  let body: React.ReactElement;
  if (visible.length === 0) {
    body = <p className="text-[13.5px] text-[var(--tf-text-secondary)] py-6">Keine Treffer.</p>;
  } else if (viewMode === 'table') {
    body = (
      <RegelnTableView
        regeln={visible}
        columns={columns}
        visibleKeys={visibleKeys}
        onEdit={onEdit}
      />
    );
  } else if (viewMode === 'list') {
    body = (
      <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] overflow-hidden">
        {visible.map((r, i) => {
          const used = skillsUsingRegel(file, r.id);
          return (
            <ListItem
              key={r.id}
              layout="inline"
              last={i === visible.length - 1}
              onClick={() => onEdit(r)}
              titleClassName="flex items-center gap-3 shrink-0"
              title={(
                <>
                  <span className="text-[13.5px] font-medium text-[var(--tf-text)] whitespace-nowrap">{r.name}</span>
                  <TypPill typ={r.typ} />
                </>
              )}
              subtitle={describeRegelParams(r)}
              meta={(
                <span className="flex items-center gap-3">
                  <SevPill s={r.schweregrad} />
                  <span className="text-[11.5px] text-[var(--tf-text-tertiary)] whitespace-nowrap max-w-[160px] truncate">
                    {used.length ? used.join(', ') : '—'}
                  </span>
                </span>
              )}
              actions={<Switch on={r.aktiv} disabled={!canEdit || busy} onClick={() => onToggleAktiv(r)} />}
            />
          );
        })}
      </div>
    );
  } else {
    // viewMode === 'cards'
    body = (
      <div className="flex flex-col gap-3.5">
        {visible.map(r => {
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

  return <div>{toolbar}{body}</div>;
}

interface TableViewProps {
  regeln: QualitaetsRegel[];
  columns: SortableColumn<RegelRow>[];
  visibleKeys: string[];
  onEdit: (regel: QualitaetsRegel) => void;
}

function RegelnTableView({
  regeln, columns, visibleKeys, onEdit,
}: TableViewProps): React.ReactElement {
  const { widths, setWidth } = useColumnWidths('teamflow_regeln_table_col_widths', {});
  // Gesamtbreiten-Griff wie in der Skills-Tabelle — dieselbe Seite, dieselbe
  // Ursache (Spaltensumme > Content-Box).
  const { totalWidth, setTotalWidth } = useTotalTableWidth('teamflow_regeln_table_total_width');
  const visibleColumns = useMemo(
    () => columns.filter(c => visibleKeys.includes(c.key)),
    [columns, visibleKeys],
  );

  const rows = useMemo<RegelRow[]>(() => regeln.map(r => ({ regel: r, _rowKey: r.id })), [regeln]);
  const { sortKey, sortDirection, toggleSort, sortedRows } = useTableSort(rows, visibleColumns);

  return (
    <SortableTable<RegelRow>
      rows={sortedRows}
      columns={visibleColumns}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={toggleSort}
      rowKey={r => r._rowKey}
      onRowClick={r => onEdit(r.regel)}
      emptyContent="Keine Regeln."
      columnWidths={widths}
      onColumnWidthChange={setWidth}
      totalWidth={totalWidth}
      onTotalWidthChange={setTotalWidth}
    />
  );
}
