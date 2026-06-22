/**
 * Gruppierung der Qualitätsregeln-Tabelle (Tabellen-Modus). Spiegelt das
 * Förderanträge-Muster (`buildStatusSectionRows` + section-stabile Sortierung):
 * Rows werden kontiguierlich je Sektion ausgegeben, die `SortableTable` zeichnet
 * beim Sektions-Wechsel ein Band.
 *
 * `skill` ist n:m — eine Regel kann mehreren Skills zugeordnet sein und erscheint
 * dann in mehreren Sektionen (eigener `_rowKey` je (Regel, Skill)). Regeln ohne
 * Skill-Zuordnung landen in „Ohne Zuordnung".
 */
import { KATEGORIE_LABEL, KATEGORIE_ORDER, type QualitaetsRegel, type SkillRegistryFile } from '@/core/services/skills';
import { TYP_LABEL, REGEL_TYP_ORDER, typLabel, kategorieLabel } from './regelShared';

export type RegelGroupingMode = 'none' | 'typ' | 'kategorie' | 'schweregrad' | 'skill' | 'aktiv';

export const REGEL_GROUPING_OPTIONS: { mode: RegelGroupingMode; label: string }[] = [
  { mode: 'none', label: 'Keine' },
  { mode: 'typ', label: 'Typ' },
  { mode: 'kategorie', label: 'Art' },
  { mode: 'schweregrad', label: 'Schweregrad' },
  { mode: 'skill', label: 'Skill' },
  { mode: 'aktiv', label: 'Aktiv' },
];

const OHNE_ZUORDNUNG = 'Ohne Zuordnung';
const GROUPING_KEY = 'teamflow_regeln_grouping';

export function loadRegelGrouping(): RegelGroupingMode {
  try {
    const raw = localStorage.getItem(GROUPING_KEY);
    if (raw && REGEL_GROUPING_OPTIONS.some(o => o.mode === raw)) return raw as RegelGroupingMode;
  } catch { /* ignore */ }
  return 'none';
}

export function saveRegelGrouping(mode: RegelGroupingMode): void {
  try { localStorage.setItem(GROUPING_KEY, mode); } catch { /* ignore */ }
}

export function labelForMode(mode: RegelGroupingMode): string {
  return REGEL_GROUPING_OPTIONS.find(o => o.mode === mode)?.label ?? 'Keine';
}

export function modeForLabel(label: string): RegelGroupingMode {
  return REGEL_GROUPING_OPTIONS.find(o => o.label === label)?.mode ?? 'none';
}

/** Wrapper-Zeile — `regel` bleibt sauber (kein Section-Leak beim Speichern),
 *  `_rowKey` ist auch bei Skill-Duplikaten eindeutig. */
export interface RegelRow {
  regel: QualitaetsRegel;
  _rowKey: string;
  _section: string | null;
}

export interface RegelSectionResult {
  rows: RegelRow[];
  /** `null` = keine Sektionen (Gruppierung „Keine"). */
  sectionOf: ((r: RegelRow) => string) | null;
}

export function buildRegelSectionRows(
  rules: QualitaetsRegel[],
  mode: RegelGroupingMode,
  file: SkillRegistryFile,
): RegelSectionResult {
  if (mode === 'none') {
    return { rows: rules.map(r => ({ regel: r, _rowKey: r.id, _section: null })), sectionOf: null };
  }

  if (mode === 'skill') {
    const rows: RegelRow[] = [];
    // Sektionen in file.skills-Reihenfolge; je (Skill, Regel) eine Zeile.
    for (const skill of file.skills) {
      for (const r of rules) {
        if (skill.regelIds.includes(r.id)) {
          rows.push({ regel: r, _rowKey: `${r.id}::${skill.id}`, _section: skill.name });
        }
      }
    }
    // Regeln, die kein Skill nutzt → „Ohne Zuordnung" (zuletzt).
    const usedIds = new Set(file.skills.flatMap(s => s.regelIds));
    for (const r of rules) {
      if (!usedIds.has(r.id)) rows.push({ regel: r, _rowKey: r.id, _section: OHNE_ZUORDNUNG });
    }
    return { rows, sectionOf: r => r._section ?? OHNE_ZUORDNUNG };
  }

  // 1:1-Gruppierungen (typ / kategorie / schweregrad / aktiv): bucketn + in Sektions-Reihenfolge ausgeben.
  const sectionLabel = (r: QualitaetsRegel): string => {
    if (mode === 'typ') return typLabel(r);
    if (mode === 'kategorie') return kategorieLabel(r);
    if (mode === 'schweregrad') return r.schweregrad === 'fehler' ? 'Fehler' : 'Hinweis';
    return r.aktiv ? 'Aktiv' : 'Inaktiv';
  };
  const order = mode === 'typ'
    ? REGEL_TYP_ORDER.map(t => TYP_LABEL[t]!)
    : mode === 'kategorie'
      ? KATEGORIE_ORDER.map(k => KATEGORIE_LABEL[k]!)
      : mode === 'schweregrad'
        ? ['Fehler', 'Hinweis']
        : ['Aktiv', 'Inaktiv'];

  const buckets = new Map<string, RegelRow[]>();
  for (const r of rules) {
    const sec = sectionLabel(r);
    const arr = buckets.get(sec) ?? [];
    arr.push({ regel: r, _rowKey: r.id, _section: sec });
    buckets.set(sec, arr);
  }
  const rows: RegelRow[] = [];
  const seen = new Set<string>();
  for (const sec of order) {
    const arr = buckets.get(sec);
    if (arr) { rows.push(...arr); seen.add(sec); }
  }
  // Sektionen außerhalb der definierten Reihenfolge (Fallback) ans Ende.
  for (const [sec, arr] of buckets) {
    if (!seen.has(sec)) rows.push(...arr);
  }
  return { rows, sectionOf: r => r._section ?? '' };
}
