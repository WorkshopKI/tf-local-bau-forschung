import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { getCanonicalLabel } from '@/core/services/csv/constants';
import type { CsvSchema, ColumnMappingEntry } from '@/core/services/csv/types';

interface Props {
  schema: CsvSchema;
  onClose: () => void;
}

interface GroupBucket {
  key: string;
  label: string;
  columns: string[];
}

const NO_GROUP_KEY = '__none__';
const NO_GROUP_LABEL = 'Ohne Gruppierung';

type DisplayMode = 'canonical' | 'custom' | 'ignore';

function detectMode(entry: ColumnMappingEntry): DisplayMode {
  if (entry.ignore) return 'ignore';
  if (entry.canonical) return 'canonical';
  return 'custom';
}

export function CsvSchemaDetailDialog({ schema, onClose }: Props): React.ReactElement {
  const columnMapping = schema.column_mapping;

  const hasGroups = useMemo(
    () => Object.values(columnMapping).some(e => (e.group_path?.length ?? 0) > 0),
    [columnMapping],
  );

  const buckets: GroupBucket[] = useMemo(() => {
    const cols = Object.keys(columnMapping);
    if (!hasGroups) {
      return [{ key: NO_GROUP_KEY, label: NO_GROUP_LABEL, columns: cols }];
    }
    const order: string[] = [];
    const map = new Map<string, GroupBucket>();
    for (const col of cols) {
      const path = columnMapping[col]?.group_path ?? [];
      const key = path.length === 0 ? NO_GROUP_KEY : path.join(' › ');
      const label = path.length === 0 ? NO_GROUP_LABEL : key;
      if (!map.has(key)) {
        map.set(key, { key, label, columns: [] });
        order.push(key);
      }
      map.get(key)!.columns.push(col);
    }
    const ordered = order.filter(k => k !== NO_GROUP_KEY).map(k => map.get(k)!);
    const none = map.get(NO_GROUP_KEY);
    if (none) ordered.push(none);
    return ordered;
  }, [columnMapping, hasGroups]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string): void =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const totals = useMemo(() => {
    let standard = 0;
    let custom = 0;
    let ignore = 0;
    for (const e of Object.values(columnMapping)) {
      const m = detectMode(e);
      if (m === 'canonical') standard++;
      else if (m === 'ignore') ignore++;
      else custom++;
    }
    return { standard, custom, ignore, total: standard + custom + ignore };
  }, [columnMapping]);

  const lastImported = schema.last_imported_at
    ? new Date(schema.last_imported_at).toLocaleString('de-DE')
    : '—';

  return (
    <Dialog
      open={true}
      onClose={onClose}
      className="max-w-[960px] self-start"
      title={
        <span className="flex items-center gap-2">
          <span className="truncate">{schema.csv_source_name}</span>
          {schema.is_master ? (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-800">
              Master
            </span>
          ) : null}
          <span className="ml-1 text-[12px] font-normal text-[var(--tf-text-tertiary)]">
            · Mapping (read-only)
          </span>
        </span>
      }
      footer={
        <Button variant="outline" size="sm" onClick={onClose}>
          Schließen
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-4 text-[13px]">
        <section>
          <div className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">
            Metadaten
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-y-1">
            <div className="text-[var(--tf-text-secondary)]">Schema-ID</div>
            <div className="font-mono text-[12px]">{schema.id}</div>
            <div className="text-[var(--tf-text-secondary)]">Join-Key</div>
            <div>{schema.join_key}</div>
            <div className="text-[var(--tf-text-secondary)]">Master</div>
            <div>{schema.is_master ? 'ja' : 'nein'}</div>
            <div className="text-[var(--tf-text-secondary)]">Priority</div>
            <div>{schema.priority}</div>
            <div className="text-[var(--tf-text-secondary)]">Encoding</div>
            <div>{schema.encoding ?? 'UTF-8'}</div>
            <div className="text-[var(--tf-text-secondary)]">Separator</div>
            <div className="font-mono">{schema.separator ?? ','}</div>
            {typeof schema.label_xlsx_header_rows === 'number' ? (
              <>
                <div className="text-[var(--tf-text-secondary)]">Label-XLS-Header</div>
                <div>{schema.label_xlsx_header_rows} Zeilen</div>
              </>
            ) : null}
            <div className="text-[var(--tf-text-secondary)]">Letzter Import</div>
            <div>{lastImported}</div>
            <div className="text-[var(--tf-text-secondary)]">Zeilen</div>
            <div>
              {typeof schema.last_row_count === 'number'
                ? schema.last_row_count.toLocaleString('de-DE')
                : '—'}
            </div>
          </div>
        </section>

        <section>
          <div className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">
            Mapping ({totals.total} Spalten — {totals.standard} Standard · {totals.custom} Eigen ·{' '}
            {totals.ignore} Ignore)
          </div>
          <div className="flex flex-col gap-2">
            {buckets.map(bucket => (
              <BucketSection
                key={bucket.key}
                bucket={bucket}
                isGroupedView={hasGroups}
                collapsed={!!collapsed[bucket.key]}
                onToggle={() => toggleGroup(bucket.key)}
                columnMapping={columnMapping}
              />
            ))}
          </div>
        </section>
      </div>
    </Dialog>
  );
}

interface BucketProps {
  bucket: GroupBucket;
  isGroupedView: boolean;
  collapsed: boolean;
  onToggle: () => void;
  columnMapping: Record<string, ColumnMappingEntry>;
}

function BucketSection({
  bucket,
  isGroupedView,
  collapsed,
  onToggle,
  columnMapping,
}: BucketProps): React.ReactElement {
  const counts = { standard: 0, custom: 0, ignore: 0 };
  for (const col of bucket.columns) {
    const m = detectMode(columnMapping[col] ?? {});
    if (m === 'canonical') counts.standard++;
    else if (m === 'ignore') counts.ignore++;
    else counts.custom++;
  }
  const counterParts: string[] = [];
  if (counts.standard > 0) counterParts.push(`${counts.standard} Standard`);
  if (counts.custom > 0) counterParts.push(`${counts.custom} Eigen`);
  if (counts.ignore > 0) counterParts.push(`${counts.ignore} Ignore`);

  return (
    <div style={{ border: '0.5px solid var(--tf-border)', borderRadius: 8 }}>
      {isGroupedView ? (
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--tf-bg-secondary)]"
          style={{ borderBottom: collapsed ? undefined : '0.5px solid var(--tf-border)' }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          <span className="text-[12.5px] font-medium text-[var(--tf-text)]">{bucket.label}</span>
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">
            ({bucket.columns.length}
            {counterParts.length > 0 ? ` — ${counterParts.join(' · ')}` : ''})
          </span>
        </button>
      ) : null}

      {!collapsed ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
                <th className="text-left p-2">CSV-Spalte</th>
                {isGroupedView ? <th className="text-left p-2">Label</th> : null}
                <th className="text-left p-2">Übernehmen als</th>
                <th className="text-left p-2">Feldname</th>
                <th className="text-left p-2">Typ</th>
                <th className="text-left p-2">Historie</th>
              </tr>
            </thead>
            <tbody>
              {bucket.columns.map(col => {
                const entry = columnMapping[col] ?? {};
                const mode = detectMode(entry);
                const rowStyle: React.CSSProperties = {
                  borderTop: '0.5px solid var(--tf-border)',
                  borderLeft:
                    mode === 'canonical' ? '3px solid var(--tf-primary)' : '3px solid transparent',
                  opacity: mode === 'ignore' ? 0.6 : 1,
                };
                return (
                  <tr key={col} style={rowStyle}>
                    <td className="p-2 font-mono text-[11.5px] text-[var(--tf-text)]">{col}</td>
                    {isGroupedView ? (
                      <td className="p-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
                        {entry.label && entry.label !== col ? (
                          entry.label
                        ) : (
                          <span className="italic">—</span>
                        )}
                      </td>
                    ) : null}
                    <td className="p-2">
                      <ModeBadge mode={mode} />
                    </td>
                    <td className="p-2">
                      {mode === 'canonical' ? (
                        <div className="flex flex-col">
                          <span className="text-[var(--tf-text)]">
                            {getCanonicalLabel(String(entry.canonical))}
                          </span>
                          <span className="font-mono text-[10.5px] text-[var(--tf-text-tertiary)]">
                            {String(entry.canonical)}
                          </span>
                        </div>
                      ) : mode === 'custom' ? (
                        <span className="font-mono text-[11.5px] text-[var(--tf-text)]">
                          {entry.custom ?? '—'}
                        </span>
                      ) : (
                        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">—</span>
                      )}
                    </td>
                    <td className="p-2 text-[11.5px] text-[var(--tf-text-secondary)]">
                      {mode === 'ignore' ? '—' : entry.type ?? 'string'}
                    </td>
                    <td className="p-2 text-[11.5px]">
                      {entry.trackHistory ? (
                        <span className="text-amber-700" title="Wird in Historie versioniert">
                          🕒
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function ModeBadge({ mode }: { mode: DisplayMode }): React.ReactElement {
  if (mode === 'canonical') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-800">
        Standardfeld
      </span>
    );
  }
  if (mode === 'ignore') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]">
        Ignoriert
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
      Eigenes Feld
    </span>
  );
}
