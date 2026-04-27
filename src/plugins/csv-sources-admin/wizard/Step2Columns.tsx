import { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CANONICAL_FIELDS, getCanonicalLabel } from '@/core/services/csv/constants';
import type { ColumnLabelEntry, LabelParseResult, LabelSuggestion } from '@/core/services/csv';
import { buildSuggestions } from '@/core/services/csv';
import type { WizardApi, PerColumnDecision, MappingKindFilter } from './useCsvWizardState';
import { slugifyFieldName } from './useCsvWizardState';
import { XlsLabelUpload } from './XlsLabelUpload';
import { StandardFieldSlots } from './StandardFieldSlots';

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
  const { state, updateDecision, applyDecisions, toggleGroupCollapse, setAllGroupsCollapsed, getResolvedEntries, setKindFilter } = api;
  const [filterTerm, setFilterTerm] = useState('');
  const [highlightedColumn, setHighlightedColumn] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const highlightTimer = useRef<number | null>(null);

  const registerRow = useCallback((col: string, el: HTMLTableRowElement | null): void => {
    if (el) rowRefs.current.set(col, el);
    else rowRefs.current.delete(col);
  }, []);

  const jumpToColumn = useCallback((col: string): void => {
    // Falls die Zeile aktuell weggefiltert ist (kindFilter='custom' und Spalte ist Standard etc.),
    // erst auf 'all' zurückschalten, sonst findet sie sich nicht.
    if (state.kindFilter !== 'all') setKindFilter('all');
    // Falls die Gruppe eingeklappt ist, kurzer Frame Verzögerung damit React rendert.
    requestAnimationFrame(() => {
      const el = rowRefs.current.get(col);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedColumn(col);
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
      highlightTimer.current = window.setTimeout(() => setHighlightedColumn(null), 1600);
    });
  }, [state.kindFilter, setKindFilter]);

  const resolved = useMemo(() => getResolvedEntries(), [getResolvedEntries]);

  const suggestions: LabelSuggestion[] = useMemo(() => {
    if (!state.preview || state.labelEntries.length === 0) return [];
    const result: LabelParseResult = {
      columnEntries: state.labelEntries,
      ambiguousMerges: state.ambiguousMerges,
    };
    return buildSuggestions(state.preview.headers, result);
  }, [state.preview, state.labelEntries, state.ambiguousMerges]);

  /**
   * Mappt CSV-Preview-Header auf XLS-Label-Entries.
   * 1. Direkter Namens-Match (csv_column == header).
   * 2. Fallback positional: resolved[i] (XLS-Eintrag an gleicher Spalten-Position).
   *    Greift bei Duplikat-Spalten in der CSV: PapaParse dedupliziert mit `_1`-Suffix
   *    (z.B. `Digitale W` → `Digitale W_1`), das XLS hat aber meist eine andere
   *    Konvention (`Digitale W2`). Per Position alignieren funktioniert robust,
   *    sofern XLS und CSV die gleiche Spalten-Reihenfolge und -Anzahl haben.
   */
  const entriesByHeader = useMemo(() => {
    const m = new Map<string, ColumnLabelEntry>();
    if (!state.preview || resolved.length === 0) return m;
    const byName = new Map(resolved.map(e => [e.csv_column, e]));
    state.preview.headers.forEach((col, i) => {
      const entry = byName.get(col) ?? resolved[i];
      if (entry) m.set(col, entry);
    });
    return m;
  }, [state.preview, resolved]);

  const labelByColumn = useMemo(() => {
    const m = new Map<string, string>();
    for (const [col, e] of entriesByHeader) m.set(col, e.label);
    return m;
  }, [entriesByHeader]);

  const allGroups: GroupBucket[] = useMemo(() => {
    if (!state.preview) return [];
    const headers = state.preview.headers;
    if (resolved.length === 0) {
      // Kein Label-XLS geladen → eine einzige "Gruppe" ohne Header (flache Tabelle)
      return [{ key: NO_GROUP_KEY, label: '', columns: headers }];
    }
    const order: string[] = []; // key-Reihenfolge
    const buckets = new Map<string, GroupBucket>();

    for (const col of headers) {
      const entry = entriesByHeader.get(col);
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
  }, [resolved, state.preview, entriesByHeader]);

  const trimmedFilter = filterTerm.trim().toLowerCase();
  const searchActive = trimmedFilter.length > 0;
  const kindFilterActive = state.kindFilter !== 'all';
  const filterActive = searchActive || kindFilterActive;

  const suggestedColumns: Set<string> = useMemo(() => {
    const s = new Set<string>();
    for (const sg of suggestions) {
      if (sg.canonical && sg.confidence >= 0.6) s.add(sg.csvColumn);
    }
    return s;
  }, [suggestions]);

  const groups: GroupBucket[] = useMemo(() => {
    if (!filterActive) return allGroups;
    const filtered: GroupBucket[] = [];
    for (const g of allGroups) {
      const cols = g.columns.filter(col => {
        // Search-Filter
        if (searchActive) {
          let hit = false;
          if (col.toLowerCase().includes(trimmedFilter)) hit = true;
          else {
            const label = labelByColumn.get(col);
            if (label && label.toLowerCase().includes(trimmedFilter)) hit = true;
            else {
              const custom = state.decisions[col]?.custom;
              if (custom && custom.toLowerCase().includes(trimmedFilter)) hit = true;
            }
          }
          if (!hit) return false;
        }
        // Kind-Filter
        if (kindFilterActive) {
          const d = state.decisions[col];
          const mode = d?.mode ?? 'custom';
          if (state.kindFilter === 'standard') {
            const isCanonical = mode === 'canonical';
            const hasSugg = suggestedColumns.has(col);
            if (!isCanonical && !hasSugg) return false;
          } else if (state.kindFilter === 'custom') {
            if (mode !== 'custom') return false;
          }
        }
        return true;
      });
      if (cols.length > 0) filtered.push({ ...g, columns: cols });
    }
    return filtered;
  }, [allGroups, filterActive, searchActive, kindFilterActive, trimmedFilter, labelByColumn, state.decisions, state.kindFilter, suggestedColumns]);

  if (!state.preview) {
    return <div className="text-[13px] text-[var(--tf-text-tertiary)]">Keine Preview vorhanden.</div>;
  }

  const isGroupedView = resolved.length > 0;
  const totalColumns = state.preview.headers.length;
  const visibleColumns = groups.reduce((n, g) => n + g.columns.length, 0);
  const allGroupKeys = allGroups.map(g => g.key);
  const allCollapsed = isGroupedView && allGroupKeys.length > 0 && allGroupKeys.every(k => state.collapsedGroups[k]);
  const allExpanded = isGroupedView && allGroupKeys.every(k => !state.collapsedGroups[k]);

  // Konflikt: mehrere Spalten mappen auf dasselbe Standardfeld → letzte gewinnt im merger,
  // andere Werte gehen verloren. Hier visuell warnen, damit der User es bemerkt.
  const canonicalConflicts: { canonical: string; columns: string[] }[] = [];
  {
    const byCanonical = new Map<string, string[]>();
    for (const [col, d] of Object.entries(state.decisions)) {
      if (d.mode !== 'canonical' || !d.canonical) continue;
      const arr = byCanonical.get(d.canonical) ?? [];
      arr.push(col);
      byCanonical.set(d.canonical, arr);
    }
    for (const [canonical, columns] of byCanonical) {
      if (columns.length > 1) canonicalConflicts.push({ canonical, columns });
    }
  }

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

      {canonicalConflicts.length > 0 ? (
        <div className="mb-3 rounded-md border-[0.5px] border-amber-300 bg-amber-50 p-2.5 text-[12px] text-amber-900">
          <div className="font-medium mb-1">⚠ Mehrere Spalten mappen auf dasselbe Standardfeld</div>
          <ul className="ml-4 list-disc space-y-0.5">
            {canonicalConflicts.map(c => (
              <li key={c.canonical}>
                <span className="font-medium">{getCanonicalLabel(c.canonical)}</span>{': '}
                <span className="font-mono text-[11px]">{c.columns.join(', ')}</span>
              </li>
            ))}
          </ul>
          <div className="mt-1.5 text-[11.5px]">
            Beim Import gewinnt die Spalte, die in der CSV-Reihenfolge zuletzt steht — die Werte der anderen gehen verloren.
            Empfehlung: nur eine Spalte als Standardfeld mappen, die andere(n) auf <em>Eigenes Feld</em> umstellen
            (z.B. <code>verbund_titel</code> vs. <code>tv_titel</code>).
          </div>
        </div>
      ) : null}

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={filterTerm}
          onChange={e => setFilterTerm(e.target.value)}
          placeholder="Spalte suchen…"
          className="h-8 w-[260px] rounded border-[0.5px] border-[var(--tf-border)] bg-transparent px-2 text-[12.5px]"
        />
        <KindFilterToggle value={state.kindFilter} onChange={setKindFilter} />
        {filterActive ? (
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            zeigt {visibleColumns} von {totalColumns} Spalten
          </span>
        ) : null}
        {isGroupedView ? (
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={() => setAllGroupsCollapsed(allGroupKeys, false)}
              disabled={allExpanded}
              className="px-2 py-1 rounded text-[11.5px] text-[var(--tf-text-secondary)] border-[0.5px] border-[var(--tf-border)] hover:bg-[var(--tf-bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
              title={allExpanded ? 'Alle Gruppen sind bereits aufgeklappt' : undefined}
            >
              Alle aufklappen
            </button>
            <button
              type="button"
              onClick={() => setAllGroupsCollapsed(allGroupKeys, true)}
              disabled={allCollapsed}
              className="px-2 py-1 rounded text-[11.5px] text-[var(--tf-text-secondary)] border-[0.5px] border-[var(--tf-border)] hover:bg-[var(--tf-bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
              title={allCollapsed ? 'Alle Gruppen sind bereits eingeklappt' : undefined}
            >
              Alle einklappen
            </button>
          </div>
        ) : null}
      </div>

      <XlsLabelUpload api={api} />

      <StandardFieldSlots
        allColumns={state.preview.headers}
        decisions={state.decisions}
        suggestions={suggestions}
        labelByColumn={labelByColumn}
        onAssign={(col, canonical, type) => {
          updateDecision(col, { mode: 'canonical', canonical, type });
        }}
        onUnassign={col => {
          updateDecision(col, { mode: 'custom', canonical: undefined });
        }}
        onApplyAllConfident={() => {
          const merged: Record<string, PerColumnDecision> = {};
          // Pro Standardfeld nur die höchste Konfidenz nehmen, damit sich Vorschläge nicht gegenseitig
          // überschreiben (z.B. wenn FKZ und AKZ_NR beide auf 'aktenzeichen' gemappt würden).
          const bestPerCanonical = new Map<string, LabelSuggestion>();
          for (const s of suggestions) {
            if (!s.canonical || s.confidence < 0.6) continue;
            // Schon belegt? → überspringen.
            const alreadyAssigned = Object.values(state.decisions).some(
              d => d.mode === 'canonical' && d.canonical === s.canonical,
            );
            if (alreadyAssigned) continue;
            const prev = bestPerCanonical.get(s.canonical);
            if (!prev || s.confidence > prev.confidence) bestPerCanonical.set(s.canonical, s);
          }
          for (const s of bestPerCanonical.values()) {
            if (!s.canonical) continue;
            const field = CANONICAL_FIELDS.find(f => f.key === s.canonical);
            merged[s.csvColumn] = {
              mode: 'canonical',
              canonical: s.canonical,
              type: field?.type ?? 'string',
            };
          }
          if (Object.keys(merged).length > 0) applyDecisions(merged);
        }}
        pendingConfidentCount={(() => {
          let n = 0;
          const seen = new Set<string>();
          for (const s of suggestions) {
            if (!s.canonical || s.confidence < 0.6) continue;
            if (seen.has(s.canonical)) continue;
            seen.add(s.canonical);
            const alreadyAssigned = Object.values(state.decisions).some(
              d => d.mode === 'canonical' && d.canonical === s.canonical,
            );
            if (!alreadyAssigned) n++;
          }
          return n;
        })()}
        onJumpToColumn={jumpToColumn}
      />

      <div className="space-y-3">
        {groups.map(g => (
          <GroupSection
            key={g.key}
            bucket={g}
            state={state}
            isGroupedView={isGroupedView}
            forceExpanded={filterActive}
            labelByColumn={labelByColumn}
            updateDecision={updateDecision}
            onToggle={() => toggleGroupCollapse(g.key)}
            registerRow={registerRow}
            highlightedColumn={highlightedColumn}
          />
        ))}
        {filterActive && groups.length === 0 ? (
          <div className="text-[12.5px] text-[var(--tf-text-tertiary)] italic px-1">
            Keine Spalte passt zu Such-/Filter-Kriterien.
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface KindFilterToggleProps {
  value: MappingKindFilter;
  onChange: (v: MappingKindFilter) => void;
}

function KindFilterToggle({ value, onChange }: KindFilterToggleProps): React.ReactElement {
  const options: { key: MappingKindFilter; label: string; title: string }[] = [
    { key: 'all', label: 'Alle', title: 'Alle Spalten anzeigen' },
    { key: 'standard', label: 'Nur Standard', title: 'Nur Spalten, die auf ein Standardfeld mappen oder als Vorschlag (≥60%) gelten' },
    { key: 'custom', label: 'Nur Eigene', title: 'Nur Spalten, die als Eigenes Feld durchgereicht werden' },
  ];
  return (
    <div className="inline-flex rounded border-[0.5px] border-[var(--tf-border)] overflow-hidden">
      {options.map((opt, i) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            title={opt.title}
            className="px-2 py-1 text-[11.5px] transition"
            style={{
              background: active ? 'var(--tf-primary)' : 'transparent',
              color: active ? 'var(--tf-primary-foreground, white)' : 'var(--tf-text-secondary)',
              borderLeft: i === 0 ? undefined : '0.5px solid var(--tf-border)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

interface GroupSectionProps {
  bucket: GroupBucket;
  state: WizardApi['state'];
  isGroupedView: boolean;
  forceExpanded: boolean;
  labelByColumn: Map<string, string>;
  updateDecision: (col: string, patch: Partial<PerColumnDecision>) => void;
  onToggle: () => void;
  registerRow: (col: string, el: HTMLTableRowElement | null) => void;
  highlightedColumn: string | null;
}

function GroupSection({ bucket, state, isGroupedView, forceExpanded, labelByColumn, updateDecision, onToggle, registerRow, highlightedColumn }: GroupSectionProps): React.ReactElement {
  const collapsed = !forceExpanded && !!state.collapsedGroups[bucket.key];
  const labelMap = labelByColumn;

  // Counter pro Sektion
  const counts = { standard: 0, custom: 0, ignore: 0 };
  for (const col of bucket.columns) {
    const m = state.decisions[col]?.mode ?? 'custom';
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
                <th className="text-left p-2">Beispielwerte</th>
              </tr>
            </thead>
            <tbody>
              {bucket.columns.map(col => {
                const d = state.decisions[col] ?? { mode: 'custom' as const };
                const samples = state.preview!.rows.slice(0, 3).map(r => (r[col] ?? '').slice(0, 30)).filter(Boolean);
                const label = labelMap.get(col);
                const isHighlighted = highlightedColumn === col;
                const rowStyle: React.CSSProperties = {
                  borderTop: '0.5px solid var(--tf-border)',
                  borderLeft: d.mode === 'canonical' ? '3px solid var(--tf-primary)' : '3px solid transparent',
                  background: isHighlighted ? 'color-mix(in srgb, var(--tf-primary) 14%, transparent)' : undefined,
                  opacity: d.mode === 'ignore' ? 0.6 : 1,
                  transition: 'background 0.4s ease',
                };
                return (
                  <tr
                    key={col}
                    ref={el => registerRow(col, el)}
                    data-column={col}
                    style={rowStyle}
                  >
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
                            <optgroup label="Antrag-Ebene (TV)">
                              {CANONICAL_FIELDS.filter(f => f.level === 'antrag').map(f => (
                                <option key={f.key} value={f.key}>{getCanonicalLabel(f.key)}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Verbund-Ebene">
                              {CANONICAL_FIELDS.filter(f => f.level === 'verbund').map(f => (
                                <option key={f.key} value={f.key}>{getCanonicalLabel(f.key)}</option>
                              ))}
                            </optgroup>
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
