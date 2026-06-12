import { useMemo } from 'react';
import { Play, Copy, Trash2 } from 'lucide-react';
import type { SkillRecord, SkillRegistryFile } from '@/core/services/skill-registry';
import {
  SortableTable,
  ColumnPicker,
  useTableSort,
  useColumnVisibility,
  useColumnWidths,
} from '@/components/data-table';
import { formatDate, promptAnriss } from './registryFormat';
import { buildSkillColumns } from './skillTableColumns';
import type { RegistryViewMode } from './RegistryViewModeToggle';

interface SkillsTabProps {
  file: SkillRegistryFile;
  canEdit: boolean;
  search: string;
  viewMode: RegistryViewMode;
  onEdit: (skill: SkillRecord) => void;
  onTestlauf: (skill: SkillRecord) => void;
  onDuplicate: (skill: SkillRecord) => void;
  onDelete: (skill: SkillRecord) => void;
}

export function SkillsTab({
  file, canEdit, search, viewMode, onEdit, onTestlauf, onDuplicate, onDelete,
}: SkillsTabProps): React.ReactElement {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return file.skills;
    return file.skills.filter(s =>
      s.name.toLowerCase().includes(q)
      || s.beschreibung.toLowerCase().includes(q)
      || s.promptTemplate.toLowerCase().includes(q));
  }, [file.skills, search]);

  if (file.skills.length === 0) {
    return (
      <p className="text-[13.5px] text-[var(--tf-text-secondary)] py-6">
        Noch keine Skills. Lege den ersten an →
      </p>
    );
  }
  if (filtered.length === 0) {
    return <p className="text-[13.5px] text-[var(--tf-text-secondary)] py-6">Keine Treffer.</p>;
  }

  if (viewMode === 'table') {
    return (
      <SkillsTableView
        skills={filtered}
        canEdit={canEdit}
        onEdit={onEdit}
        onTestlauf={onTestlauf}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] overflow-hidden">
        {filtered.map((skill, i) => (
          <div
            key={skill.id}
            onClick={() => onEdit(skill)}
            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--tf-bg-secondary)] ${i > 0 ? 'border-t-[0.5px] border-[var(--tf-border)]' : ''}`}
          >
            <span className="text-[13.5px] font-medium text-[var(--tf-text)] whitespace-nowrap">{skill.name}</span>
            <span className="text-[12px] text-[var(--tf-text-tertiary)] truncate flex-1 min-w-0">{skill.beschreibung}</span>
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)] whitespace-nowrap">
              v{skill.version}<span className="px-1">·</span>{formatDate(skill.geaendert_am)}<span className="px-1">·</span>
              {skill.regelIds.length} {skill.regelIds.length === 1 ? 'Regel' : 'Regeln'}
            </span>
            <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
              <RowAction title="Testlauf" onClick={() => onTestlauf(skill)}><Play size={14} /></RowAction>
              {canEdit && <RowAction title="Duplizieren" onClick={() => onDuplicate(skill)}><Copy size={14} /></RowAction>}
              {canEdit && <RowAction title="Löschen" danger onClick={() => onDelete(skill)}><Trash2 size={14} /></RowAction>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // viewMode === 'cards'
  return (
    <div className="flex flex-col gap-3.5">
      {filtered.map(skill => (
        <div key={skill.id} className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] p-[20px]">
          <h2 className="text-[15px] font-medium text-[var(--tf-text)] m-0">{skill.name}</h2>
          {skill.beschreibung && (
            <p className="text-[13.5px] leading-[1.55] text-[var(--tf-text-secondary)] mt-1.5">{skill.beschreibung}</p>
          )}
          <p className="text-[12px] text-[var(--tf-text-tertiary)] mt-2">
            Version&nbsp;{skill.version}
            <span className="px-1">·</span>geändert {formatDate(skill.geaendert_am)}
            <span className="px-1">·</span>{skill.regelIds.length} {skill.regelIds.length === 1 ? 'Regel' : 'Regeln'} zugeordnet
          </p>
          <pre className="mt-3.5 rounded-[8px] bg-[var(--tf-bg-secondary)] px-3.5 py-3 font-mono text-[12.5px] leading-[1.65] text-[var(--tf-text-secondary)] whitespace-pre-wrap m-0">
            {promptAnriss(skill.promptTemplate)}
          </pre>
          <div className="mt-4 pt-3.5 border-t-[0.5px] border-[var(--tf-border)] flex items-center gap-3">
            <button onClick={() => onEdit(skill)} className="text-[13px] text-[var(--tf-text)] hover:opacity-70">
              {canEdit ? 'Bearbeiten' : 'Ansehen'}
            </button>
            <span className="text-[var(--tf-text-tertiary)] text-[12px]">·</span>
            <button onClick={() => onTestlauf(skill)} className="text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">
              Testlauf
            </button>
            {canEdit && (
              <>
                <span className="text-[var(--tf-text-tertiary)] text-[12px]">·</span>
                <button onClick={() => onDuplicate(skill)} className="text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">
                  Duplizieren
                </button>
              </>
            )}
            <span className="flex-1" />
            {canEdit && (
              <button onClick={() => onDelete(skill)} className="text-[13px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]">
                Löschen
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RowAction({
  title, onClick, danger, children,
}: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }): React.ReactElement {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`p-1 rounded hover:bg-[var(--tf-hover)] ${
        danger
          ? 'text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]'
          : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
      }`}
    >
      {children}
    </button>
  );
}

interface TableViewProps {
  skills: SkillRecord[];
  canEdit: boolean;
  onEdit: (skill: SkillRecord) => void;
  onTestlauf: (skill: SkillRecord) => void;
  onDuplicate: (skill: SkillRecord) => void;
  onDelete: (skill: SkillRecord) => void;
}

function SkillsTableView({
  skills, canEdit, onEdit, onTestlauf, onDuplicate, onDelete,
}: TableViewProps): React.ReactElement {
  const columns = useMemo(
    () => buildSkillColumns({ canEdit, onTestlauf, onDuplicate, onDelete }),
    [canEdit, onTestlauf, onDuplicate, onDelete],
  );
  const { visibleKeys, toggleColumn } = useColumnVisibility('teamflow_skills_table_columns', columns);
  const { widths, setWidth } = useColumnWidths('teamflow_skills_table_col_widths', {});
  const visibleColumns = useMemo(
    () => columns.filter(c => visibleKeys.includes(c.key)),
    [columns, visibleKeys],
  );
  const { sortKey, sortDirection, toggleSort, sortedRows } = useTableSort(skills, visibleColumns);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-[var(--tf-text-tertiary)]">
          {skills.length} {skills.length === 1 ? 'Skill' : 'Skills'}
        </span>
        <ColumnPicker columns={columns} visibleKeys={visibleKeys} onToggleColumn={toggleColumn} />
      </div>
      <SortableTable<SkillRecord>
        rows={sortedRows}
        columns={visibleColumns}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        rowKey={s => s.id}
        onRowClick={onEdit}
        emptyContent="Keine Skills."
        columnWidths={widths}
        onColumnWidthChange={setWidth}
      />
    </div>
  );
}
