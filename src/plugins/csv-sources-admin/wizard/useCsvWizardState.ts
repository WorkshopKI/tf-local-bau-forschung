import { useCallback, useRef, useState } from 'react';
import type {
  JoinKey,
  ColumnMapping,
  CsvEncoding,
  CsvSeparator,
  AmbiguousMergeResolution,
} from '@/core/services/csv/types';
import type { CsvPreview } from '@/core/services/csv/parser';
import type {
  ColumnLabelEntry,
  AmbiguousMerge,
  LabelParseResult,
} from '@/core/services/csv/filter/xlsLabelParser';
import { parseCsvPreview, applyAmbiguousResolution } from '@/core/services/csv';

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface PerColumnDecision {
  mode: 'canonical' | 'custom' | 'ignore';
  canonical?: string;
  custom?: string;
  type?: 'string' | 'date' | 'number' | 'boolean';
  trackHistory?: boolean;
}

export interface UpScanEntry {
  code: string;
  count: number;
  /** War bereits in IDB (von vorherigem Import) registriert. */
  existing: boolean;
  /** Aktuelle Auswahl. */
  aktiv: boolean;
  /** Klartext-Label, falls gepflegt. */
  name?: string;
  zeitraum_von?: string;
  zeitraum_bis?: string;
}

export interface WizardState {
  step: WizardStep;
  displayName: string;
  schemaId: string;
  joinKey: JoinKey;
  isMaster: boolean;
  priority: number;
  file: File | null;
  preview: CsvPreview | null;
  decisions: Record<string, PerColumnDecision>; // key = column name
  errors: string[];
  importStarted: boolean;
  skipImport: boolean;
  /** Ergebnis des Distinct-Scans auf der unterprogramm_id-Spalte (nur Master). */
  upScan: UpScanEntry[] | null;
  upScanLoading: boolean;
  /** Snapshot der aktiv-Flags wie sie beim Wizard-Start waren (für Re-Import-Diff). */
  upInitialActive: Record<string, boolean>;
  /** Aktuell vom Admin bestätigtes Encoding (initial = detectedEncoding). */
  encoding: CsvEncoding;
  /** Aktuell vom Admin bestätigter Separator (initial = detectedSeparator). */
  separator: CsvSeparator;
  /** Automatisch erkanntes Encoding (read-only, nur für Hinweis). */
  detectedEncoding: CsvEncoding | null;
  /** Automatisch erkannter Separator (read-only, nur für Hinweis). */
  detectedSeparator: CsvSeparator | null;
  /** Anzahl Header-Zeilen im Label-XLS (2-8). */
  headerRowCount: number;
  /** Letzter Parse-Output des Label-XLS (leer solange kein XLS geladen). */
  labelEntries: ColumnLabelEntry[];
  /** Erkannte vertikal-merged Gruppen-/Label-Merges. */
  ambiguousMerges: AmbiguousMerge[];
  /** Admin-Entscheidung pro Merge-Signature. */
  ambiguousResolutions: Record<string, AmbiguousMergeResolution>;
  /** Dateiname des geladenen Label-XLS (UI-Hint). */
  labelFileName: string | null;
  /** UI-Collapsible-State: key = group_path.join(' › ') oder '__none__'. true = eingeklappt. */
  collapsedGroups: Record<string, boolean>;
  /** Mapping-Filter in Step 2: 'all' (Default) | 'standard' (nur Canonical + Suggestions) | 'custom' (nur Eigene). */
  kindFilter: MappingKindFilter;
}

export type MappingKindFilter = 'all' | 'standard' | 'custom';

const INITIAL: WizardState = {
  step: 1,
  displayName: '',
  schemaId: '',
  joinKey: 'aktenzeichen',
  isMaster: false,
  priority: 50,
  file: null,
  preview: null,
  decisions: {},
  errors: [],
  importStarted: false,
  skipImport: false,
  upScan: null,
  upScanLoading: false,
  upInitialActive: {},
  encoding: 'UTF-8',
  separator: ',',
  detectedEncoding: null,
  detectedSeparator: null,
  headerRowCount: 4,
  labelEntries: [],
  ambiguousMerges: [],
  ambiguousResolutions: {},
  labelFileName: null,
  collapsedGroups: {},
  kindFilter: 'all',
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Variante fuer Custom-Feldnamen: Underscores statt Bindestriche
 * (entspricht der bestehenden Konvention bei guessDecision -> col.toLowerCase()).
 */
export function slugifyFieldName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function isDateLike(s: string): boolean {
  // DD.MM.YYYY / DD-MM-YYYY / DD/MM/YYYY (auch zweistelliges Jahr)
  if (/^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}$/.test(s)) return true;
  // YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD (ISO + Varianten)
  if (/^\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2}$/.test(s)) return true;
  return false;
}

function isNumberLike(s: string): boolean {
  // Erlaube DE- und EN-Zahlenformat: optionales Vorzeichen, Tausender-Trenner, Dezimalkomma/-punkt.
  // Bewusst eng — keine Zahlen-mit-Einheit ("47 €"), keine wissenschaftliche Notation.
  return (
    /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || // 1.234,56  oder 1.234.567
    /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s) || // 1,234.56  oder 1,234,567
    /^-?\d+([.,]\d+)?$/.test(s)               // 47 / 47,5 / 47.5
  );
}

function detectFieldType(samples: string[]): 'string' | 'date' | 'number' {
  const cleaned = samples.map(s => (s ?? '').trim()).filter(Boolean);
  if (cleaned.length === 0) return 'string';
  if (cleaned.every(isDateLike)) return 'date';
  if (cleaned.every(isNumberLike)) return 'number';
  return 'string';
}

export interface WizardApi {
  state: WizardState;
  setField: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
  setDisplayName: (name: string) => void;
  setFileAndPreview: (file: File, preview: CsvPreview) => void;
  updateDecision: (col: string, patch: Partial<PerColumnDecision>) => void;
  applyDecisions: (updates: Record<string, PerColumnDecision>) => void;
  setUpScan: (entries: UpScanEntry[], initialActive: Record<string, boolean>) => void;
  setUpScanLoading: (loading: boolean) => void;
  toggleUpSelection: (code: string, aktiv: boolean) => void;
  setAllUpSelections: (mode: 'all' | 'none' | 'onlyNew') => void;
  goto: (step: WizardStep) => void;
  next: () => void;
  back: () => void;
  setErrors: (errs: string[]) => void;
  reset: () => void;
  buildColumnMapping: () => ColumnMapping;
  /** Setzt Encoding und re-parsed die Preview. Throws bei Parse-Fehler. */
  setEncoding: (encoding: CsvEncoding) => Promise<void>;
  /** Setzt Separator und re-parsed die Preview. Throws bei Parse-Fehler. */
  setSeparator: (separator: CsvSeparator) => Promise<void>;
  /** Setzt Header-Zeilen-Anzahl; invalidiert vorherigen Parse-Output. */
  setHeaderRowCount: (n: number) => void;
  /** Schreibt Parser-Output + initialisiert Resolutions mit Defaults. */
  setLabelParseResult: (result: LabelParseResult, fileName: string) => void;
  /** Setzt Admin-Entscheidung pro Merge. */
  setAmbiguousResolution: (signature: string, resolution: AmbiguousMergeResolution) => void;
  /** Bulk-Aktion: setzt alle ambigen Merges auf eine Resolution. */
  setAllAmbiguousResolutions: (resolution: AmbiguousMergeResolution) => void;
  /** Leert geladenes Label-XLS (Reset). */
  clearLabelResult: () => void;
  /** Collapsible-State umschalten. */
  toggleGroupCollapse: (groupKey: string) => void;
  /** Bulk-Aktion: alle Gruppen auf- (collapsed=false) oder zuklappen (collapsed=true). */
  setAllGroupsCollapsed: (keys: string[], collapsed: boolean) => void;
  /** Liefert die Label-Entries nach Anwendung aller Admin-Resolutions. */
  getResolvedEntries: () => ColumnLabelEntry[];
  /** Mapping-Filter in Step 2 setzen. */
  setKindFilter: (filter: MappingKindFilter) => void;
}

export function useCsvWizardState(): WizardApi {
  const [state, setState] = useState<WizardState>(INITIAL);
  const stateRef = useRef(state);
  stateRef.current = state;

  const setField: WizardApi['setField'] = useCallback((k, v) => {
    setState(s => ({ ...s, [k]: v }));
  }, []);

  const setDisplayName: WizardApi['setDisplayName'] = useCallback(name => {
    setState(s => ({
      ...s,
      displayName: name,
      schemaId: slugify(name),
    }));
  }, []);

  const setFileAndPreview: WizardApi['setFileAndPreview'] = useCallback((file, preview) => {
    setState(s => {
      const decisions: Record<string, PerColumnDecision> = {};
      for (const h of preview.headers) {
        const existing = s.decisions[h];
        if (existing) {
          decisions[h] = existing;
        } else {
          const samples = preview.rows.slice(0, 5).map(r => (r[h] ?? '').trim());
          decisions[h] = guessDecision(h, samples);
        }
      }
      return {
        ...s,
        file,
        preview,
        decisions,
        encoding: preview.encoding,
        separator: preview.separator,
        detectedEncoding: preview.detected.encoding,
        detectedSeparator: preview.detected.separator,
      };
    });
  }, []);

  const setEncoding: WizardApi['setEncoding'] = useCallback(async (encoding) => {
    const file = stateRef.current.file;
    if (!file) return;
    const preview = await parseCsvPreview(file, 5, {
      encoding,
      separator: stateRef.current.separator,
    });
    setState(s => ({ ...s, encoding, preview }));
  }, []);

  const setSeparator: WizardApi['setSeparator'] = useCallback(async (separator) => {
    const file = stateRef.current.file;
    if (!file) return;
    const preview = await parseCsvPreview(file, 5, {
      encoding: stateRef.current.encoding,
      separator,
    });
    setState(s => ({ ...s, separator, preview }));
  }, []);

  const updateDecision: WizardApi['updateDecision'] = useCallback((col, patch) => {
    setState(s => {
      const prev = s.decisions[col] ?? { mode: 'custom' as const };
      const next: PerColumnDecision = { ...prev, ...patch };
      return {
        ...s,
        decisions: { ...s.decisions, [col]: next },
      };
    });
  }, []);

  const applyDecisions: WizardApi['applyDecisions'] = useCallback((updates) => {
    setState(s => {
      const next = { ...s.decisions };
      for (const [col, d] of Object.entries(updates)) {
        next[col] = { ...(next[col] ?? { mode: 'custom' as const }), ...d };
      }
      return { ...s, decisions: next };
    });
  }, []);

  const setUpScan: WizardApi['setUpScan'] = useCallback((entries, initialActive) => {
    setState(s => ({ ...s, upScan: entries, upScanLoading: false, upInitialActive: initialActive }));
  }, []);

  const setUpScanLoading: WizardApi['setUpScanLoading'] = useCallback((loading) => {
    setState(s => ({ ...s, upScanLoading: loading }));
  }, []);

  const toggleUpSelection: WizardApi['toggleUpSelection'] = useCallback((code, aktiv) => {
    setState(s => {
      if (!s.upScan) return s;
      return {
        ...s,
        upScan: s.upScan.map(e => (e.code === code ? { ...e, aktiv } : e)),
      };
    });
  }, []);

  const setAllUpSelections: WizardApi['setAllUpSelections'] = useCallback((mode) => {
    setState(s => {
      if (!s.upScan) return s;
      return {
        ...s,
        upScan: s.upScan.map(e => {
          if (mode === 'all') return { ...e, aktiv: true };
          if (mode === 'none') return { ...e, aktiv: false };
          // onlyNew: neue auf aktiv, bestehende behalten ihren vorherigen Zustand
          return e.existing ? e : { ...e, aktiv: true };
        }),
      };
    });
  }, []);

  const goto: WizardApi['goto'] = useCallback((step) => {
    setState(s => ({ ...s, step, errors: [] }));
  }, []);

  const next = useCallback(() => {
    setState(s => ({ ...s, step: Math.min(5, s.step + 1) as WizardStep, errors: [] }));
  }, []);

  const back = useCallback(() => {
    setState(s => ({ ...s, step: Math.max(1, s.step - 1) as WizardStep, errors: [] }));
  }, []);

  const setErrors: WizardApi['setErrors'] = useCallback(errs => setState(s => ({ ...s, errors: errs })), []);

  const reset = useCallback(() => setState(INITIAL), []);

  const setHeaderRowCount: WizardApi['setHeaderRowCount'] = useCallback((n) => {
    const clamped = Math.max(2, Math.min(8, Math.round(n)));
    setState(s => ({
      ...s,
      headerRowCount: clamped,
      // Parser-Ergebnis invalidieren: Admin muss XLS neu laden
      labelEntries: [],
      ambiguousMerges: [],
      ambiguousResolutions: {},
      labelFileName: null,
    }));
  }, []);

  const setLabelParseResult: WizardApi['setLabelParseResult'] = useCallback((result, fileName) => {
    setState(s => {
      const resolutions: Record<string, AmbiguousMergeResolution> = {};
      for (const m of result.ambiguousMerges) {
        resolutions[m.signature] = s.ambiguousResolutions[m.signature] ?? m.default_resolution;
      }
      // Custom-Feldnamen aus Label ableiten, wenn der User sie noch nicht editiert hat.
      // "Noch nicht editiert" = custom === col.toLowerCase() (Auto-Default aus guessDecision).
      const labelByCol = new Map<string, string>();
      for (const e of result.columnEntries) labelByCol.set(e.csv_column, e.label);
      const refreshed: Record<string, PerColumnDecision> = { ...s.decisions };
      for (const [col, d] of Object.entries(refreshed)) {
        if (d.mode !== 'custom') continue;
        const autoName = col.toLowerCase();
        if (d.custom !== undefined && d.custom !== autoName) continue; // user-editiert
        const label = labelByCol.get(col);
        if (!label || label === col) continue;
        const slug = slugifyFieldName(label);
        if (!slug || slug === autoName) continue;
        refreshed[col] = { ...d, custom: slug };
      }
      return {
        ...s,
        labelEntries: result.columnEntries,
        ambiguousMerges: result.ambiguousMerges,
        ambiguousResolutions: resolutions,
        labelFileName: fileName,
        decisions: refreshed,
      };
    });
  }, []);

  const setAmbiguousResolution: WizardApi['setAmbiguousResolution'] = useCallback((signature, resolution) => {
    setState(s => ({
      ...s,
      ambiguousResolutions: { ...s.ambiguousResolutions, [signature]: resolution },
    }));
  }, []);

  const setAllAmbiguousResolutions: WizardApi['setAllAmbiguousResolutions'] = useCallback((resolution) => {
    setState(s => {
      const next: Record<string, AmbiguousMergeResolution> = {};
      for (const m of s.ambiguousMerges) next[m.signature] = resolution;
      return { ...s, ambiguousResolutions: next };
    });
  }, []);

  const clearLabelResult: WizardApi['clearLabelResult'] = useCallback(() => {
    setState(s => ({
      ...s,
      labelEntries: [],
      ambiguousMerges: [],
      ambiguousResolutions: {},
      labelFileName: null,
    }));
  }, []);

  const toggleGroupCollapse: WizardApi['toggleGroupCollapse'] = useCallback((groupKey) => {
    setState(s => ({
      ...s,
      collapsedGroups: { ...s.collapsedGroups, [groupKey]: !s.collapsedGroups[groupKey] },
    }));
  }, []);

  const setAllGroupsCollapsed: WizardApi['setAllGroupsCollapsed'] = useCallback((keys, collapsed) => {
    setState(s => {
      if (!collapsed) return { ...s, collapsedGroups: {} };
      const next: Record<string, boolean> = {};
      for (const k of keys) next[k] = true;
      return { ...s, collapsedGroups: next };
    });
  }, []);

  const setKindFilter: WizardApi['setKindFilter'] = useCallback((filter) => {
    setState(s => ({ ...s, kindFilter: filter }));
  }, []);

  const getResolvedEntries: WizardApi['getResolvedEntries'] = useCallback(() => {
    let entries = state.labelEntries;
    for (const m of state.ambiguousMerges) {
      const res = state.ambiguousResolutions[m.signature] ?? m.default_resolution;
      entries = applyAmbiguousResolution(entries, m, res);
    }
    return entries;
  }, [state.labelEntries, state.ambiguousMerges, state.ambiguousResolutions]);

  const buildColumnMapping: WizardApi['buildColumnMapping'] = useCallback(() => {
    // Resolved entries ermitteln (inline, ohne Hook-Kreis)
    let resolved = state.labelEntries;
    for (const m of state.ambiguousMerges) {
      const res = state.ambiguousResolutions[m.signature] ?? m.default_resolution;
      resolved = applyAmbiguousResolution(resolved, m, res);
    }
    const byColumn = new Map(resolved.map(e => [e.csv_column, e]));
    // Merge-Signature pro Spalte ermitteln für Persistenz der Admin-Entscheidung
    const mergeByColumn = new Map<string, { signature: string; resolution: AmbiguousMergeResolution }>();
    for (const m of state.ambiguousMerges) {
      const res = state.ambiguousResolutions[m.signature] ?? m.default_resolution;
      for (const col of m.affected_columns) {
        mergeByColumn.set(col, { signature: m.signature, resolution: res });
      }
    }

    const mapping: ColumnMapping = {};
    for (const [col, d] of Object.entries(state.decisions)) {
      const label = byColumn.get(col)?.label;
      const groupPath = byColumn.get(col)?.group_path;
      const merge = mergeByColumn.get(col);
      const labelFields = label !== undefined && label !== col ? { label } : {};
      const groupFields = groupPath && groupPath.length > 0 ? { group_path: groupPath } : {};
      const mergeFields = merge ? { ambiguous_merge_resolution: merge.resolution } : {};

      if (d.mode === 'ignore') {
        mapping[col] = { ignore: true, ...labelFields, ...groupFields, ...mergeFields };
      } else if (d.mode === 'canonical' && d.canonical) {
        mapping[col] = {
          canonical: d.canonical,
          type: d.type ?? 'string',
          trackHistory: d.trackHistory ?? false,
          ...labelFields,
          ...groupFields,
          ...mergeFields,
        };
      } else if (d.mode === 'custom') {
        mapping[col] = {
          custom: (d.custom && d.custom.trim()) || col.toLowerCase(),
          type: d.type ?? 'string',
          trackHistory: d.trackHistory ?? false,
          ...labelFields,
          ...groupFields,
          ...mergeFields,
        };
      } else {
        mapping[col] = { custom: col.toLowerCase(), type: 'string', ...labelFields, ...groupFields };
      }
    }
    return mapping;
  }, [state.decisions, state.labelEntries, state.ambiguousMerges, state.ambiguousResolutions]);

  return {
    state,
    setField,
    setDisplayName,
    setFileAndPreview,
    updateDecision,
    applyDecisions,
    setUpScan,
    setUpScanLoading,
    toggleUpSelection,
    setAllUpSelections,
    goto,
    next,
    back,
    setErrors,
    reset,
    buildColumnMapping,
    setEncoding,
    setSeparator,
    setHeaderRowCount,
    setLabelParseResult,
    setAmbiguousResolution,
    setAllAmbiguousResolutions,
    clearLabelResult,
    toggleGroupCollapse,
    setAllGroupsCollapsed,
    getResolvedEntries,
    setKindFilter,
  };
}

function guessDecision(col: string, samples: string[] = []): PerColumnDecision {
  const c = col.toLowerCase();
  if (/akz|aktenzeichen|fkz/.test(c)) return { mode: 'canonical', canonical: 'aktenzeichen', type: 'string' };
  if (/kurz|akronym/.test(c)) return { mode: 'canonical', canonical: 'akronym', type: 'string' };
  if (/verbund.?id|vb_nr/.test(c)) return { mode: 'canonical', canonical: 'verbund_id', type: 'string' };
  // Verbund-Ebene vor TV-Ebene matchen: VB-spezifische Felder zuerst, sonst gewinnt 'titel'/'status' fuer beides
  if (/(verbund|vb).*titel|titel.*(verbund|vb)/.test(c)) return { mode: 'canonical', canonical: 'verbund_titel', type: 'string' };
  if (/(verbund|vb).*status|status.*(verbund|vb)/.test(c)) return { mode: 'canonical', canonical: 'verbund_status', type: 'string' };
  if (/titel|title/.test(c)) return { mode: 'canonical', canonical: 'titel', type: 'string' };
  if (/antragsteller|bearbeiter/.test(c)) return { mode: 'canonical', canonical: 'antragsteller', type: 'string' };
  if (/status/.test(c)) return { mode: 'canonical', canonical: 'status', type: 'string' };
  if (/fm.?nummer|foerdermassnahme|foerder.?massn|unterprog/.test(c)) return { mode: 'canonical', canonical: 'unterprogramm_id', type: 'string' };
  if (/bew.*dat|bewilligung/.test(c)) return { mode: 'canonical', canonical: 'bewilligung_datum', type: 'date' };
  if (/antrags.*dat/.test(c)) return { mode: 'canonical', canonical: 'antragsdatum', type: 'date' };
  if (/frist/.test(c)) return { mode: 'canonical', canonical: 'frist_datum', type: 'date' };
  if (/foerder|summe|betrag/.test(c)) return { mode: 'canonical', canonical: 'foerdersumme', type: 'number' };
  if (/export_ts|timestamp/.test(c)) return { mode: 'ignore' };
  return { mode: 'custom', custom: col.toLowerCase(), type: detectFieldType(samples) };
}
