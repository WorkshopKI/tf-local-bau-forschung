import { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CANONICAL_FIELDS, getCanonicalLabel } from '@/core/services/csv/constants';
import type { WizardApi, PerColumnDecision } from './useCsvWizardState';
import { slugifyFieldName } from './useCsvWizardState';
import { XlsLabelUpload } from './XlsLabelUpload';

interface Step2Props {
  api: WizardApi;
}

const NO_GROUP_KEY = '__none__';
const NO_GROUP_LABEL = 'Ohne Gruppierung';

interface GroupBucket {
  key: string;
  label: string;
  columns: string[];
}

export function Step2Columns({ api }: Step2Props): React.ReactElement {
  const { state, updateDecision, applyDecisions, toggleGroupCollapse, getResolvedEntries } = api;
  const [filterTerm, setFilterTerm] = useState('');
  const mappingRef = useRef<HTMLDivElement | null>(null);

  const scrollToMapping = (): void => {
    mappingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const resolved = useMemo(() => getResolvedEntries(), [getResolvedEntries]);

  const labelByColumn = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of state.labelEntries) m.set(e.csv_column, e.label);
    return m;
  }, [state.labelEntries]);

  const allGroups: GroupBucket[] = useMemo(() => {
    if (!state.preview) return [];
    const headers = state.preview.headers;
    if (resolved.length === 0) {
      // Kein Label-XLS geladen → eine einzige "Gruppe" ohne Header (flache Tabelle)
      return [{ key: NO_GROUP_KEY, label: '', columns: headers }];
    }
    const byColumn = new Map(resolved.map(e => [e.csv_column, e]));
    const order: string[] = []; // key-Reihenfolge
    const buckets = new Map<string, GroupBucket>();

    for (const col of headers) {
      const entry = byColumn.get(col);
      const path = entry?.group_path ?? [];
      const key = path.length === 0 ? NO_GROUP_KEY : path.join(' › ');
      const label = path.length === 0 ? NO_GROUP_LABEL : key;
      if (!buckets.has(key)) {
        buckets.set(key, { key, label, columns: [] });
        order.push(key);
      }
      buckets.get(key)!.columns.push(col);
    }

    // "Ohne Gruppierung" ans Ende
    const ordered = order.filter(k => k !== NO_GROUP_KEY).map(k => buckets.get(k)!);
    const none = buckets.get(NO_GROUP_KEY);
    if (none) ordered.push(none);
    return ordered;
  }, [resolved, state.preview]);

  const trimmedFilter = filterTerm.trim().toLowerCase();
  const filterActive = trimmedFilter.length > 0;

  const groups: GroupBucket[] = useMemo(() => {
    if (!filterActive) return allGroups;
    const filtered: GroupBucket[] = [];
    for (const g of allGroups) {
      const cols = g.columns.filter(col => {
        if (col.toLowerCase().includes(trimmedFilter)) return true;
        const label = labelByColumn.get(col);
        if (label && label.toLowerCase().includes(trimmedFilter)) return true;
        const custom = state.decisions[col]?.custom;
        if (custom && custom.toLowerCase().includes(trimmedFilter)) return true;
        return false;
      });
      if (cols.length > 0) filtered.push({ ...g, columns: cols });
    }
    return filtered;
  }, [allGroups, filterActive, trimmedFilter, labelByColumn, state.decisions]);

  if (!state.preview) {
    return <div className="text-[13px] text-[var(--tf-text-tertiary)]">Keine Preview vorhanden.</div>;
  }

  const isGroupedView = resolved.length > 0;
  const totalColumns = state.preview.headers.length;
  const visibleColumns = groups.reduce((n, g) => n + g.columns.length, 0);

  return (
    <div>
      <div className="text-[12px] text-[var(--tf-text-secondary)] mb-3 leading-relaxed">
        Pro Spalte entscheiden, wie sie übernommen wird:
        <span className="ml-1"><strong>Standardfeld</strong> = auf ein vom System bekanntes Feld mappen
        (z.B. Aktenzeichen, Status) — wird in Listen, Filtern und der Detailansicht besonders behandelt;</span>
        <span className="ml-1"><strong>Eigenes Feld</strong> = die Spalte unter einem frei wählbaren Namen
        durchreichen (erscheint als zusätzliches Feld in der Detailansicht);</span>
        <span className="ml-1"><strong>Ignorieren</strong> = beim Import weglassen.</span>
        <span className="ml-1">„Historie tracken" nur für Felder aktivieren, die sich tatsächlich ändern können (z.B. Status).</span>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <input
          type="text"
          value={filterTerm}
          onChange={e => setFilterTerm(e.target.value)}
          placeholder="Spalte suchen…"
          className="h-8 w-[260px] rounded border-[0.5px] border-[var(--tf-border)] bg-transparent px-2 text-[12.5px]"
        />
        {filterActive ? (
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            zeigt {visibleColumns} von {totalColumns} Spalten
          </span>
        ) : null}
      </div>

      <XlsLabelUpload
        previewHeaders={state.preview.headers}
        api={api}
        onApply={applyDecisions}
        onApplied={scrollToMapping}
      />

      <div ref={mappingRef} className="space-y-3">
        {groups.map(g => (
          <GroupSection
            key={g.key}
            bucket={g}
            state={state}
            isGroupedView={isGroupedView}
            forceExpanded={filterActive}
            updateDecision={updateDecision}
            onToggle={() => toggleGroupCollapse(g.key)}
          />
        ))}
        {filterActive && groups.length === 0 ? (
          <div className="text-[12.5px] text-[var(--tf-text-tertiary)] italic px-1">
            Keine Spalte passt zum Suchbegriff.
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface GroupSectionProps {
  bucket: GroupBucket;
  state: WizardApi['state'];
  isGroupedView: boolean;
  forceExpanded: boolean;
  updateDecision: (col: string, patch: Partial<PerColumnDecision>) => void;
  onToggle: () => void;
}

function GroupSection({ bucket, state, isGroupedView, forceExpanded, updateDecision, onToggle }: GroupSectionProps): React.ReactElement {
  const collapsed = !forceExpanded && !!state.collapsedGroups[bucket.key];
  const labelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of state.labelEntries) m.set(e.csv_column, e.label);
    return m;
  }, [state.labelEntries]);

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
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">({bucket.columns.length})</span>
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
                <th className="text-left p-2">Beispielwerte</th>
              </tr>
            </thead>
            <tbody>
              {bucket.columns.map(col => {
                const d = state.decisions[col] ?? { mode: 'custom' as const };
                const samples = state.preview!.rows.slice(0, 3).map(r => (r[col] ?? '').slice(0, 30)).filter(Boolean);
                const label = labelMap.get(col);
                return (
                  <tr key={col} style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                    <td className="p-2 font-mono text-[11.5px] text-[var(--tf-text)]">{col}</td>
                    {isGroupedView ? (
                      <td className="p-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
                        {label && label !== col ? label : <span className="italic">—</span>}
                      </td>
                    ) : null}
                    <td className="p-2">
                      <select
                        value={d.mode}
                        onChange={e => {
                          const newMode = e.target.value as 'canonical' | 'custom' | 'ignore';
                          if (newMode === 'custom' && !d.custom) {
                            const lab = labelMap.get(col);
                            const derived = lab && lab !== col ? slugifyFieldName(lab) : '';
                            const fallback = col.toLowerCase();
                            updateDecision(col, { mode: 'custom', custom: derived || fallback });
                          } else {
                            updateDecision(col, { mode: newMode });
                          }
                        }}
                        className="h-7 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent px-1.5 text-[12px]"
                      >
                        <option value="canonical">Standardfeld</option>
                        <option value="custom">Eigenes Feld</option>
                        <option value="ignore">Ignorieren</option>
                      </select>
                    </td>
                    <td className="p-2">
                      {d.mode === 'canonical' ? (
                        <>
                          <select
                            value={d.canonical ?? ''}
                            onChange={e => {
                              const canonical = e.target.value;
                              const field = CANONICAL_FIELDS.find(f => f.key === canonical);
                              updateDecision(col, { canonical, type: field?.type ?? 'string' });
                            }}
                            className="h-7 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent px-1.5 text-[12px]"
                          >
                            <option value="">– auswählen –</option>
                            {CANONICAL_FIELDS.map(f => (
                              <option key={f.key} value={f.key}>{getCanonicalLabel(f.key)}</option>
                            ))}
                          </select>
                          {d.canonical === state.joinKey ? (
                            <div className="mt-1 text-[10.5px] text-[var(--tf-text-tertiary)] italic">
                              Dieses Feld dient als Join-Key und wird aus anderen Quellen übernommen.
                            </div>
                          ) : null}
                        </>
                      ) : d.mode === 'custom' ? (
                        <input
                          type="text"
                          value={d.custom ?? ''}
                          onChange={e => updateDecision(col, { custom: e.target.value })}
                          placeholder={col.toLowerCase()}
                          className="h-7 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent px-1.5 text-[12px] w-[160px]"
                        />
                      ) : (
                        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">–</span>
                      )}
                    </td>
                    <td className="p-2">
                      {d.mode !== 'ignore' ? (
                        <select
                          value={d.type ?? 'string'}
                          onChange={e => updateDecision(col, { type: e.target.value as 'string' | 'date' | 'number' | 'boolean' })}
                          className="h-7 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent px-1.5 text-[12px]"
                        >
                          <option value="string">string</option>
                          <option value="date">date</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                        </select>
                      ) : null}
                    </td>
                    <td className="p-2">
                      {d.mode !== 'ignore' ? (
                        <input
                          type="checkbox"
                          checked={!!d.trackHistory}
                          onChange={e => updateDecision(col, { trackHistory: e.target.checked })}
                        />
                      ) : null}
                    </td>
                    <td className="p-2 text-[11.5px] text-[var(--tf-text-tertiary)] max-w-[280px] truncate">
                      {samples.join(' · ')}
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
