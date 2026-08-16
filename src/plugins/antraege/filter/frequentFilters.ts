import type { ActiveFilter, ActiveFilterValue, FilterDefinition } from '@/core/services/csv';
import { getPhaseForStatus, getPhaseLabel, type PhaseId } from './statusGroups';
import { codeFuerStatusText } from '@/core/status/kategorie-ableitung';

const STORAGE_KEY = 'teamflow_antraege_frequent_filters_v1';
const HINT_DISMISSED_KEY = 'teamflow_antraege_preset_hint_dismissed_v1';
const MAX_ENTRIES = 20;

/** Schwelle, ab welcher Apply-Anzahl ein Auto-Preset-Vorschlag erscheint. */
export const PRESET_HINT_THRESHOLD = 3;

/** Feld-spezifische Code→Label-Map (z.B. vb_phase: '1' → 'NW1'). */
export type FieldValueLabels = Record<string, Record<string, string>>;

/**
 * Persistierte Form. Bewusst OHNE `label` — das Label wird beim Lesen live aus
 * `appliedFilters + definitions + valueLabels` gerendert, damit es nicht
 * stale wird wenn sich Definitionen oder Labels ändern.
 */
export interface FrequentEntry {
  signature: string;
  appliedFilters: ActiveFilter[];
  lastUsed: number;
  count: number;
}

/** Anzeige-Form mit frisch gerendertem Label. */
export interface FrequentEntryView extends FrequentEntry {
  label: string;
}

export function signatureOf(active: ActiveFilter[]): string {
  const sorted = [...active].sort((a, b) => a.filterId.localeCompare(b.filterId));
  return JSON.stringify(sorted);
}

/**
 * Status-Werte → „Phase Eingang (3)" wenn alle ausgewählten Werte exakt einer
 * Phase angehören und mindestens 2 Werte gewählt sind. Bei 1 Wert oder
 * Querschnitt über mehrere Phasen: `null` (Caller fällt auf Werte-Listing zurück).
 */
function phaseAggregateLabel(values: string[]): string | null {
  if (values.length < 2) return null;
  const phases = new Set<PhaseId>(values.map(v => getPhaseForStatus(v)));
  if (phases.size !== 1) return null;
  const phaseId = phases.values().next().value;
  if (!phaseId) return null;
  // Gezählt werden CODES, nicht Schreibweisen: „Phase Entscheidung (7)" soll
  // sagen, wie viele Zustände gewählt sind — nicht, wie viele Schreibvarianten
  // davon im Filter stehen.
  const codes = new Set(values.map(v => v.toLowerCase().trim()).map(v => codeFuerStatusText(v) ?? v));
  return `Phase ${getPhaseLabel(phaseId)} (${codes.size})`;
}

function mapLabel(field: string, code: string, valueLabels: FieldValueLabels): string {
  return valueLabels[field]?.[code] ?? code;
}

function valueSummary(
  def: FilterDefinition,
  value: ActiveFilterValue,
  valueLabels: FieldValueLabels,
): string {
  if (typeof value === 'string') {
    return mapLabel(def.feld, value, valueLabels);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    const labels = value.map(v => mapLabel(def.feld, v, valueLabels));
    if (labels.length === 1) return labels[0] ?? '';
    if (labels.length === 2) return `${labels[0]}, ${labels[1]}`;
    return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('from' in obj || 'to' in obj) {
      const from = typeof obj.from === 'string' ? obj.from : '';
      const to = typeof obj.to === 'string' ? obj.to : '';
      if (from && to) return `${from} – ${to}`;
      if (from) return `ab ${from}`;
      if (to) return `bis ${to}`;
    }
    if ('min' in obj || 'max' in obj) {
      const min = typeof obj.min === 'number' ? obj.min : undefined;
      const max = typeof obj.max === 'number' ? obj.max : undefined;
      if (min !== undefined && max !== undefined) return `${min}–${max}`;
      if (min !== undefined) return `ab ${min}`;
      if (max !== undefined) return `bis ${max}`;
    }
  }
  return '';
}

function singleFilterLabel(
  def: FilterDefinition,
  value: ActiveFilterValue,
  valueLabels: FieldValueLabels,
): string {
  // Status mit Phase-Aggregation: kompaktes Label „Phase Eingang (3)" OHNE
  // „Status · "-Prefix, weil die Phase-Bezeichnung schon selbsterklärend ist.
  if (def.feld === 'status' && Array.isArray(value)) {
    const agg = phaseAggregateLabel(value);
    if (agg) return agg;
  }
  const summary = valueSummary(def, value, valueLabels);
  if (!summary) return def.name;
  return `${def.name} · ${summary}`;
}

export function generateLabel(
  active: ActiveFilter[],
  definitions: FilterDefinition[],
  valueLabels: FieldValueLabels = {},
): string {
  const defById = new Map(definitions.map(d => [d.id, d]));
  const parts: string[] = [];
  for (const af of active) {
    const def = defById.get(af.filterId);
    if (!def) continue;
    parts.push(singleFilterLabel(def, af.value, valueLabels));
    if (parts.length >= 2) break;
  }
  if (parts.length === 0) return 'Filter-Kombination';
  if (active.length > parts.length) {
    return `${parts.join(' + ')} +${active.length - parts.length}`;
  }
  return parts.join(' + ');
}

function loadEntries(): FrequentEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // `label`-Feld wird tolerant ignoriert (alte v1-Einträge tragen es noch).
    return parsed.filter(
      (e): e is FrequentEntry =>
        !!e
        && typeof (e as FrequentEntry).signature === 'string'
        && Array.isArray((e as FrequentEntry).appliedFilters)
        && typeof (e as FrequentEntry).lastUsed === 'number'
        && typeof (e as FrequentEntry).count === 'number',
    ).map(e => ({
      signature: e.signature,
      appliedFilters: e.appliedFilters,
      lastUsed: e.lastUsed,
      count: e.count,
    }));
  } catch {
    return [];
  }
}

function saveEntries(entries: FrequentEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

export function recordFilterApply(active: ActiveFilter[], _definitions: FilterDefinition[]): void {
  if (active.length === 0) return;
  const sig = signatureOf(active);
  const entries = loadEntries();
  const now = Date.now();
  const existing = entries.find(e => e.signature === sig);
  if (existing) {
    existing.lastUsed = now;
    existing.count += 1;
  } else {
    entries.push({
      signature: sig,
      appliedFilters: active.map(af => ({ ...af })),
      lastUsed: now,
      count: 1,
    });
  }
  entries.sort((a, b) => b.lastUsed - a.lastUsed);
  saveEntries(entries.slice(0, MAX_ENTRIES));
}

/**
 * Der **Verlauf**: die zuletzt benutzten Filterstände, jüngster zuerst.
 *
 * Bis v4.65 stand hier eine Häufigkeits-Rangliste (`count` mal Halbwertszeit).
 * Die beantwortete eine andere Frage als die, die gestellt wird: „wie hatte ich
 * das neulich gemacht?" — und die Abfrage von gestern fehlte darin, wenn sie
 * einmalig war. Gezählt wird `count` weiterhin, aber nur noch als Auskunft am
 * Eintrag und als Auslöser des Anpinn-Vorschlags.
 *
 * Die Reihenfolge ist bereits die des Speichers (`recordFilterApply` sortiert
 * nach `lastUsed`); hier wird nur zugeschnitten und beschriftet.
 */
export function getVerlauf(
  n = 5,
  definitions: FilterDefinition[] = [],
  valueLabels: FieldValueLabels = {},
): FrequentEntryView[] {
  const entries = loadEntries();
  if (entries.length === 0) return [];
  return [...entries]
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, n)
    .map(e => ({ ...e, label: generateLabel(e.appliedFilters, definitions, valueLabels) }));
}

export function clearFrequent(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Apply-Count der aktuellen Kombi (0 wenn noch nie angewendet). */
export function getEntryCount(active: ActiveFilter[]): number {
  if (active.length === 0) return 0;
  const sig = signatureOf(active);
  const entries = loadEntries();
  return entries.find(e => e.signature === sig)?.count ?? 0;
}

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(HINT_DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>): void {
  try {
    localStorage.setItem(HINT_DISMISSED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

export function isHintDismissed(signature: string): boolean {
  return loadDismissed().has(signature);
}

export function dismissHint(signature: string): void {
  const set = loadDismissed();
  if (set.has(signature)) return;
  set.add(signature);
  saveDismissed(set);
}
