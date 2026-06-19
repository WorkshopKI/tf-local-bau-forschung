import { useMemo, useState } from 'react';
import { Play, Copy, Trash2, Download, ThumbsUp, ThumbsDown, MessageSquare, Sparkles } from 'lucide-react';
import {
  workflowStepsUsingSkill,
  type Reifegrad,
  type SkillRecord,
  type SkillRegistryFile,
} from '@/core/services/skills';
import {
  suggestReifegrad,
  type SkillAggregat,
  type SkillAggregatMap,
} from '@/core/services/skill-feedback';
import {
  SortableTable,
  ColumnPicker,
  useTableSort,
  useColumnVisibility,
  useColumnWidths,
} from '@/components/data-table';
import { ListItem } from '@/components/ui/ListItem';
import { RowAction } from '@/components/ui/RowAction';
import { formatDate, promptAnriss } from './registryFormat';
import { buildSkillColumns } from './skillTableColumns';
import { filterSkills, sortSkills, DEFAULT_FACETS, type SkillFacets, type SkillSortKey } from './skill-browse';
import type { RegistryViewMode } from './RegistryViewModeToggle';

interface SkillsTabProps {
  file: SkillRegistryFile;
  canEdit: boolean;
  search: string;
  viewMode: RegistryViewMode;
  /** S1-Aggregat (Nutzung/Feedback je Skill); `null` solange ladend. */
  agg: SkillAggregatMap | null;
  onEdit: (skill: SkillRecord) => void;
  onTestlauf: (skill: SkillRecord) => void;
  onDuplicate: (skill: SkillRecord) => void;
  onDelete: (skill: SkillRecord) => void;
  onExport: (skill: SkillRecord) => void;
}

const REIFEGRAD_LABEL: Record<Reifegrad, string> = { entwurf: 'Entwurf', erprobt: 'Erprobt', empfohlen: 'Empfohlen' };
const REIFEGRAD_STYLE: Record<Reifegrad, string> = {
  entwurf: 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]',
  erprobt: 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)]',
  empfohlen: 'bg-[var(--tf-text)] text-[var(--tf-bg)]',
};
const SORT_LABEL: Record<SkillSortKey, string> = {
  datum: 'Zuletzt geändert',
  nutzung: 'Meistgenutzt',
  feedback: 'Feedback',
  name: 'Name',
};
const LEER_AGG: SkillAggregat = { nutzung: 0, up: 0, down: 0, letzteNutzung: null, kommentare: [] };

function reifegradOf(s: SkillRecord): Reifegrad {
  return s.reifegrad ?? 'entwurf';
}
function aggOf(map: SkillAggregatMap | null, id: string): SkillAggregat {
  return map?.get(id) ?? LEER_AGG;
}

function ReifegradBadge({ r }: { r: Reifegrad }): React.ReactElement {
  return <span className={`text-[10.5px] px-1.5 py-0.5 rounded-[5px] whitespace-nowrap ${REIFEGRAD_STYLE[r]}`}>{REIFEGRAD_LABEL[r]}</span>;
}

/** Kompakte S1-Signal-Zeile (Nutzung, 👍/👎, Kommentare) + dezenter Reifegrad-Vorschlag. */
function SkillSignals({ a, reifegrad }: { a: SkillAggregat; reifegrad: Reifegrad }): React.ReactElement {
  const vorschlag = suggestReifegrad(a, reifegrad);
  return (
    <span className="inline-flex items-center gap-2.5 text-[11.5px] text-[var(--tf-text-tertiary)] whitespace-nowrap">
      <span title="Nutzungen">{a.nutzung}× genutzt</span>
      {(a.up > 0 || a.down > 0) && (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center gap-0.5"><ThumbsUp size={11} />{a.up}</span>
          <span className="inline-flex items-center gap-0.5"><ThumbsDown size={11} />{a.down}</span>
        </span>
      )}
      {a.kommentare.length > 0 && (
        <span className="inline-flex items-center gap-0.5" title="Kommentare"><MessageSquare size={11} />{a.kommentare.length}</span>
      )}
      {vorschlag && (
        <span className="inline-flex items-center gap-0.5 text-[var(--tf-primary)]" title="Vorschlag aus Nutzung/Feedback — Kurator entscheidet">
          <Sparkles size={11} />Vorschlag: {REIFEGRAD_LABEL[vorschlag]}
        </span>
      )}
    </span>
  );
}

export function SkillsTab({
  file, canEdit, search, viewMode, agg, onEdit, onTestlauf, onDuplicate, onDelete, onExport,
}: SkillsTabProps): React.ReactElement {
  const [facets, setFacets] = useState<SkillFacets>(DEFAULT_FACETS);
  const [sortKey, setSortKey] = useState<SkillSortKey>('datum');

  const searchFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return file.skills;
    return file.skills.filter(s =>
      s.name.toLowerCase().includes(q)
      || s.beschreibung.toLowerCase().includes(q)
      || s.promptTemplate.toLowerCase().includes(q));
  }, [file.skills, search]);

  const facetFiltered = useMemo(() => filterSkills(searchFiltered, facets), [searchFiltered, facets]);
  const sorted = useMemo(() => sortSkills(facetFiltered, agg, sortKey), [facetFiltered, agg, sortKey]);

  if (file.skills.length === 0) {
    return (
      <p className="text-[13.5px] text-[var(--tf-text-secondary)] py-6">
        Noch keine Skills. Lege den ersten an →
      </p>
    );
  }

  const facetBar = (
    <FacetBar
      file={file}
      facets={facets}
      sortKey={sortKey}
      showSort={viewMode !== 'table'}
      onFacets={setFacets}
      onSort={setSortKey}
    />
  );

  const leer = facetFiltered.length === 0;

  return (
    <div className="flex flex-col gap-3.5">
      {facetBar}
      {leer ? (
        <p className="text-[13.5px] text-[var(--tf-text-secondary)] py-6">Keine Treffer.</p>
      ) : viewMode === 'table' ? (
        <SkillsTableView
          skills={facetFiltered}
          canEdit={canEdit}
          onEdit={onEdit}
          onTestlauf={onTestlauf}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      ) : viewMode === 'list' ? (
        <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] overflow-hidden">
          {sorted.map((skill, i) => (
            <ListItem
              key={skill.id}
              layout="inline"
              last={i === sorted.length - 1}
              onClick={() => onEdit(skill)}
              titleClassName="flex items-center gap-2 shrink-0"
              title={(
                <>
                  <span className="text-[13.5px] font-medium text-[var(--tf-text)] whitespace-nowrap">{skill.name}</span>
                  <ReifegradBadge r={reifegradOf(skill)} />
                </>
              )}
              subtitle={skill.beschreibung}
              meta={(
                <span className="flex items-center gap-3">
                  <SkillSignals a={aggOf(agg, skill.id)} reifegrad={reifegradOf(skill)} />
                  <span className="text-[11.5px] text-[var(--tf-text-tertiary)] whitespace-nowrap">
                    v{skill.version}<span className="px-1">·</span>{formatDate(skill.geaendert_am)}
                  </span>
                </span>
              )}
              actions={(
                <div className="flex items-center gap-0.5">
                  <RowAction title="Testlauf" onClick={() => onTestlauf(skill)}><Play size={14} /></RowAction>
                  <RowAction title="Als Bündel exportieren" onClick={() => onExport(skill)}><Download size={14} /></RowAction>
                  {canEdit && <RowAction title="Duplizieren" onClick={() => onDuplicate(skill)}><Copy size={14} /></RowAction>}
                  {canEdit && <RowAction title="Löschen" danger onClick={() => onDelete(skill)}><Trash2 size={14} /></RowAction>}
                </div>
              )}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {sorted.map(skill => (
            <SkillCard
              key={skill.id}
              file={file}
              skill={skill}
              a={aggOf(agg, skill.id)}
              canEdit={canEdit}
              onEdit={onEdit}
              onTestlauf={onTestlauf}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onExport={onExport}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FacetBarProps {
  file: SkillRegistryFile;
  facets: SkillFacets;
  sortKey: SkillSortKey;
  showSort: boolean;
  onFacets: (f: SkillFacets) => void;
  onSort: (k: SkillSortKey) => void;
}

const SELECT_CLS = 'text-[12px] rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-transparent px-2 py-1 text-[var(--tf-text-secondary)] outline-none focus:border-[var(--tf-primary)]';

function FacetBar({ file, facets, sortKey, showSort, onFacets, onSort }: FacetBarProps): React.ReactElement {
  const reifegrade: Array<Reifegrad | 'alle'> = ['alle', 'entwurf', 'erprobt', 'empfohlen'];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="inline-flex items-center gap-1">
        {reifegrade.map(r => {
          const active = facets.reifegrad === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => onFacets({ ...facets, reifegrad: r })}
              className={`text-[12px] px-2.5 py-1 rounded-[99px] border-[0.5px] transition-colors ${
                active
                  ? 'border-[var(--tf-text)] text-[var(--tf-text)] font-medium'
                  : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:border-[var(--tf-border-hover)]'
              }`}
            >
              {r === 'alle' ? 'Alle' : REIFEGRAD_LABEL[r]}
            </button>
          );
        })}
      </div>
      <label className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-tertiary)]">
        nutzt Regel
        <select
          value={facets.regelId ?? ''}
          onChange={e => onFacets({ ...facets, regelId: e.target.value || null })}
          className={SELECT_CLS}
        >
          <option value="">— alle —</option>
          {file.regeln.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>
      {showSort && (
        <label className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-tertiary)] ml-auto">
          Sortieren
          <select value={sortKey} onChange={e => onSort(e.target.value as SkillSortKey)} className={SELECT_CLS}>
            {(['datum', 'nutzung', 'feedback', 'name'] as SkillSortKey[]).map(k => (
              <option key={k} value={k}>{SORT_LABEL[k]}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

interface SkillCardProps {
  file: SkillRegistryFile;
  skill: SkillRecord;
  a: SkillAggregat;
  canEdit: boolean;
  onEdit: (skill: SkillRecord) => void;
  onTestlauf: (skill: SkillRecord) => void;
  onDuplicate: (skill: SkillRecord) => void;
  onDelete: (skill: SkillRecord) => void;
  onExport: (skill: SkillRecord) => void;
}

function SkillCard({ file, skill, a, canEdit, onEdit, onTestlauf, onDuplicate, onDelete, onExport }: SkillCardProps): React.ReactElement {
  const fundstellen = useMemo(() => workflowStepsUsingSkill(file, skill.id), [file, skill.id]);
  const verwendetIn = fundstellen.map(f => `${f.nr} · ${f.label}`).join(', ');
  return (
    <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] p-[20px]">
      <div className="flex items-center gap-2.5 flex-wrap">
        <h2 className="text-[15px] font-medium text-[var(--tf-text)] m-0">{skill.name}</h2>
        <ReifegradBadge r={reifegradOf(skill)} />
        {fundstellen.length > 0 && (
          <span className="text-[10.5px] px-1.5 py-0.5 rounded-[5px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] whitespace-nowrap">
            Abschnitt {fundstellen[0]!.nr}
          </span>
        )}
      </div>
      {skill.beschreibung && (
        <p className="text-[13.5px] leading-[1.55] text-[var(--tf-text-secondary)] mt-1.5">{skill.beschreibung}</p>
      )}
      <div className="text-[12px] text-[var(--tf-text-tertiary)] mt-2">
        Version&nbsp;{skill.version}
        <span className="px-1">·</span>geändert {formatDate(skill.geaendert_am)}
        {skill.historie?.[0]?.userId ? <> · {skill.historie[0].userId}</> : null}
        <span className="px-1">·</span>{skill.regelIds.length} {skill.regelIds.length === 1 ? 'Regel' : 'Regeln'}
      </div>
      <div className="mt-1.5"><SkillSignals a={a} reifegrad={reifegradOf(skill)} /></div>
      <div className="mt-1.5 text-[11.5px] text-[var(--tf-text-tertiary)]">
        verwendet in: {verwendetIn || '—'}
      </div>
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
        <span className="text-[var(--tf-text-tertiary)] text-[12px]">·</span>
        <button onClick={() => onExport(skill)} className="text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">
          Export
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
