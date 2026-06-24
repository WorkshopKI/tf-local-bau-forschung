import { useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { CsvSchema } from '@/core/services/csv/types';
import './felder.css';
import { type DisplayGroup, type DisplayRow } from './buildDisplayRows';
import { classifyField, adminBadgeLabel } from './felderKuration';
import {
  assembleFlagCluster,
  isFlagGroup,
  isLooseFlagRow,
  leafSubgroup,
  looseFlagSubgroup,
  type FlagSubgroup,
} from './flags';
import { FlagCluster } from './FlagCluster';

type Tab = 'relevant' | 'mit' | 'alle';

interface Props {
  groups: DisplayGroup[];
  schemas: CsvSchema[];
  sourceNames: Record<string, string>;
  historyCounts: Record<string, number>;
  onOpenHistory: (field: string) => void;
  /** Header-Darstellung: 'compact' (11px uppercase, Default — z.B. im TV-Detail
   *  zwischen anderen Sub-Sektionen) oder 'section' (16px medium, wie die
   *  Top-Level-Abschnitte der Verbund-Detailseite). */
  headerVariant?: 'compact' | 'section';
}

const OTHER_LABEL = 'Weitere Felder';
const FLAG_KEY = '__flags__';
const FLAG_TITLE = 'Technologie-Kennzeichen';

function isEmptyRow(r: DisplayRow): boolean {
  if (r.rawValue === null || r.rawValue === undefined) return true;
  if (typeof r.rawValue === 'string' && r.rawValue.trim() === '') return true;
  return false;
}
const withValue = (r: DisplayRow): boolean => !isEmptyRow(r);

/** Flag-/Verwaltungs-Gruppen starten eingeklappt (Hebel 5). */
const defaultOpen = (label: string): boolean => label !== OTHER_LABEL && label !== FLAG_TITLE;

function Caret({ open }: { open: boolean }): React.ReactElement {
  return (
    <svg className={'af-caret' + (open ? ' open' : '')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

interface FieldsEntry { key: string; title: string; kind: 'fields'; rows: DisplayRow[]; count: number; }
interface FlagsEntry { key: string; title: string; kind: 'flags'; subgroups: FlagSubgroup[]; count: number; meta: string; }
type Entry = FieldsEntry | FlagsEntry;

/**
 * „Alle Felder" — optimierte Ansicht (Hebel 3–5): Relevant/Mit-Werten/Alle-Tabs,
 * Sticky-Sprung-Index, Akkordeon-Gruppen und der konsolidierte Technologie-
 * Kennzeichen-Cluster. Gemeinsames Bauteil für Verbund (gemergte Felder) UND
 * Einzel-TV (`TvDetailBlock`).
 */
export function AlleFelderSection({
  groups,
  schemas,
  historyCounts,
  onOpenHistory,
  headerVariant = 'compact',
}: Props): React.ReactElement {
  const [tab, setTab] = useState<Tab>('relevant');
  const [q, setQ] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [activeIdx, setActiveIdx] = useState<string | null>(null);
  const refMap = useRef<Record<string, HTMLDivElement | null>>({});

  // Partition: normale Feld-Gruppen vs. Flag-Rows (in den konsolidierten Cluster
  // gehoben). Flag-Erkennung dual: group_path-getrieben (echte Schemas) ODER
  // boolean-Typ/`zt_`-Präfix (Fixtures ohne group_path).
  const { normalGroups, flagSubgroups, otherIndex, counts } = useMemo(() => {
    const normal: { label: string; rows: DisplayRow[] }[] = [];
    const flagRows: { row: DisplayRow; subgroup: string }[] = [];
    let other = -1;
    for (const g of groups) {
      // Flag-Cluster: group_path-Keyword ODER reiner Boolean-Inhalt (robust gegen
      // echte Schemas, die Y/N als String + verschachtelte group_paths liefern).
      if (isFlagGroup(g)) {
        const sub = leafSubgroup(g);
        for (const r of g.rows) flagRows.push({ row: r, subgroup: sub });
        continue;
      }
      // Loose-Flags in Nicht-Flag-Gruppen (Fixtures: zt_ in „Weitere Felder").
      const groupSub = g.path.length > 0 ? g.path[g.path.length - 1]! : null;
      const keep: DisplayRow[] = [];
      for (const r of g.rows) {
        if (isLooseFlagRow(r, schemas)) flagRows.push({ row: r, subgroup: groupSub ?? looseFlagSubgroup(r) });
        else keep.push(r);
      }
      if (keep.length > 0) {
        if (g.label === OTHER_LABEL) other = normal.length;
        normal.push({ label: g.label, rows: keep });
      }
    }
    const subgroups = assembleFlagCluster(flagRows);
    const allNormal = normal.flatMap(g => g.rows);
    const c = {
      total: allNormal.length + flagRows.length,
      mit: allNormal.filter(withValue).length + flagRows.filter(f => withValue(f.row)).length,
      relevant: allNormal.filter(r => withValue(r) && !classifyField(r).admin).length,
      adminHidden: allNormal.filter(r => withValue(r) && classifyField(r).admin).length,
      flagWithValues: flagRows.filter(f => withValue(f.row)).length,
    };
    return { normalGroups: normal, flagSubgroups: subgroups, otherIndex: other, counts: c };
  }, [groups, schemas]);

  const ql = q.trim().toLowerCase();
  const rowVisible = (r: DisplayRow): boolean => {
    if (tab === 'relevant' && (!withValue(r) || classifyField(r).admin)) return false;
    if (tab === 'mit' && !withValue(r)) return false;
    if (ql && !(r.label.toLowerCase().includes(ql) || r.field.toLowerCase().includes(ql) || r.value.toLowerCase().includes(ql))) return false;
    return true;
  };

  // Render-Reihenfolge: normale Gruppen, Flag-Cluster vor „Weitere Felder" (sonst am Ende).
  const entries: Entry[] = [];
  const totalDesc = flagSubgroups.reduce((a, s) => a + s.total, 0);
  const matchedDesc = ql
    ? flagSubgroups.reduce((a, s) => a + s.descriptors.filter(d => d.label.toLowerCase().includes(ql)).length, 0)
    : totalDesc;
  const flagEntry: FlagsEntry | null = flagSubgroups.length > 0
    ? {
        key: FLAG_KEY,
        title: FLAG_TITLE,
        kind: 'flags',
        subgroups: flagSubgroups,
        count: matchedDesc,
        meta: `${flagSubgroups.reduce((a, s) => a + s.yesCount, 0)} / ${totalDesc} zutreffend`,
      }
    : null;
  normalGroups.forEach((g, i) => {
    if (flagEntry && i === otherIndex) entries.push(flagEntry);
    const rows = g.rows.filter(rowVisible);
    entries.push({ key: g.label, title: g.label, kind: 'fields', rows, count: rows.length });
  });
  if (flagEntry && otherIndex < 0) entries.push(flagEntry);

  const indexEntries = entries.filter(e => e.count > 0);

  const isOpen = (key: string): boolean => (ql.length > 0 ? true : (openGroups[key] ?? defaultOpen(key)));
  const toggle = (key: string): void =>
    setOpenGroups(s => ({ ...s, [key]: !(s[key] ?? defaultOpen(key)) }));
  const jump = (key: string): void => {
    setActiveIdx(key);
    setOpenGroups(s => ({ ...s, [key]: true }));
    refMap.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h3 className={headerVariant === 'section'
          ? 'text-[16px] font-medium text-[var(--tf-text)]'
          : 'text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]'}>Alle Felder</h3>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {counts.total.toLocaleString('de-DE')} Felder gesamt · {counts.mit.toLocaleString('de-DE')} mit Werten
        </span>
      </div>

      <div className="af-bar">
        <div className="af-tabs">
          <button type="button" className={'af-tab' + (tab === 'relevant' ? ' on' : '')} onClick={() => setTab('relevant')}>
            Relevant <span className="c">{counts.relevant}</span>
          </button>
          <button type="button" className={'af-tab' + (tab === 'mit' ? ' on' : '')} onClick={() => setTab('mit')}>
            Mit Werten <span className="c">{counts.mit}</span>
          </button>
          <button type="button" className={'af-tab' + (tab === 'alle' ? ' on' : '')} onClick={() => setTab('alle')}>
            Alle <span className="c">{counts.total}</span>
          </button>
        </div>
        <div className="af-search">
          <Search size={14} aria-hidden="true" />
          <input
            placeholder="Feld oder Wert suchen …"
            value={q}
            onChange={e => setQ(e.target.value)}
            aria-label="Felder durchsuchen"
          />
        </div>
      </div>

      {tab === 'relevant' && (counts.adminHidden > 0 || totalDesc > 0) ? (
        <div className="af-hint">
          „Relevant" blendet {counts.adminHidden} Verwaltungs-/Duplikat-Felder aus und bündelt {counts.flagWithValues} Technologie-Kennzeichen. Über „Alle" einblendbar.
        </div>
      ) : null}

      {indexEntries.length === 0 ? (
        <div className="af-empty">Keine Felder matchen die aktuellen Filter.</div>
      ) : (
        <div className="af-cols">
          <nav className="af-index">
            {indexEntries.map(e => (
              <button
                key={e.key}
                type="button"
                className={'af-idx' + (activeIdx === e.key ? ' on' : '')}
                onClick={() => jump(e.key)}
              >
                <span className="lbl">{e.title}</span>
                <span className="c">{e.count}</span>
              </button>
            ))}
          </nav>
          <div>
            {entries.map(e => {
              if (e.kind === 'fields' && e.rows.length === 0) return null;
              const open = isOpen(e.key);
              return (
                <div key={e.key} className="af-grp" ref={el => { refMap.current[e.key] = el; }}>
                  <button type="button" className="af-grp-head" onClick={() => toggle(e.key)} aria-expanded={open}>
                    <Caret open={open} />
                    <span className="af-grp-title">{e.title}</span>
                    <span className="af-grp-meta">
                      {e.kind === 'flags' ? e.meta : `${e.count} Feld${e.count === 1 ? '' : 'er'}`}
                    </span>
                  </button>
                  {open ? (
                    e.kind === 'flags' ? (
                      <FlagCluster subgroups={e.subgroups} query={q} />
                    ) : (
                      <div className="af-grp-body">
                        {e.rows.map(r => {
                          const cls = classifyField(r);
                          const badge = adminBadgeLabel(cls);
                          return (
                            <div key={r.field} className="af-row">
                              <span className="af-k">
                                {r.label}
                                {badge ? (
                                  <span className="af-badge-admin" title={cls.dupOf ? `Duplikat von ${cls.dupOf}` : undefined}>
                                    {badge}
                                  </span>
                                ) : null}
                              </span>
                              <span className={'af-v' + (isEmptyRow(r) ? ' empty' : '')}>
                                {r.value}
                                {historyCounts[r.field] ? (
                                  <button
                                    type="button"
                                    className="af-hist"
                                    onClick={() => onOpenHistory(r.field)}
                                    title={`${historyCounts[r.field]} ${historyCounts[r.field] === 1 ? 'Änderung' : 'Änderungen'}`}
                                    aria-label={`${historyCounts[r.field]} Änderungen anzeigen`}
                                  >
                                    {' '}↻ {historyCounts[r.field]}
                                  </button>
                                ) : null}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
