/**
 * Eine einzelne Gruppen-Sektion (Collapsible-Block) im CSV-Wizard Step 2.
 *
 * Eine Sektion ist im Label-XLS-Modus eine Header-Hierarchie-Gruppe; ohne XLS
 * wird die einzige Sektion ohne Header gerendert (`isGroupedView=false`).
 * Tabelle pro Sektion: Spalten-Name + Label + Mapping-Mode + Feldname/Canonical
 * + Typ + History-Toggle + Beispielwerte.
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import { CANONICAL_FIELDS, getCanonicalLabel } from '@/core/services/csv/constants';
import type { PerColumnDecision, WizardApi } from './useCsvWizardState';
import { slugifyFieldName } from './useCsvWizardState';

export interface GroupBucket {
  key: string;
  label: string;
  columns: string[];
}

interface Props {
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

export function Step2GroupSection({
  bucket,
  state,
  isGroupedView,
  forceExpanded,
  labelByColumn,
  updateDecision,
  onToggle,
  registerRow,
  highlightedColumn,
}: Props): React.ReactElement {
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
