/**
 * useKompetenzMatrixModel (v2.16) — geteilter State der Kompetenz-Matrix.
 *
 * EIN Modell, das Toolbar (Auto-Save-Status) und Tabelle (Zell-Edits) teilen —
 * im View erzeugt, an beide durchgereicht. Hält den lokalen Draft pro MA.
 *
 * v2.31: Auto-Save. Jeder Zell-Edit startet einen Debounce (`AUTOSAVE_DEBOUNCE_MS`);
 * nach kurzer Idle-Zeit werden alle geänderten Zeilen in EINEM Store-Batch
 * committet (`applyKompetenzMatrixBatch` → ein setState + ein persist → direkter
 * `atomicWrite` auf `_intern/auslastung.json`, Pitfall #16/#20). Kein „Speichern"-
 * Klick mehr nötig — andere PLs sehen die Änderung über den Share-Watcher live.
 * `flushNow()` (Button „Jetzt speichern") committet sofort; beim Unmount werden
 * noch offene Drafts nachgeschrieben, damit nichts verloren geht.
 *
 * Reine View-States: Sortierung, Hover (für Reveal-Bar + CSS-Highlight),
 * Kapazitäten-Toggle (localStorage), Inaktive-Toggle, „✓ Gespeichert"-Flash.
 * Sortierung nutzt bewusst die GESPEICHERTEN Werte (nicht den Draft) → kein
 * Zeilen-Springen während des Tippens; nach dem Speichern sortiert sich die
 * Liste neu.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StorageService } from '@/core/services/storage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useAuslastungData, type KompetenzMatrixUpdate } from './useAuslastungData';
import {
  type AntragstypBucket,
  type AnonymerMitarbeiter,
  type KompetenzLevel,
  type KompetenzMatrix,
} from '../types';
import type { UeberkategorieId } from '../services/default-labels';

const KAP_HIDDEN_KEY = 'komp_kaphidden';
const SAVED_FLASH_MS = 2600;
/** v2.31: Auto-Save — Edits werden nach dieser Idle-Zeit automatisch auf den
 *  Daten-Share geschrieben (kein „Speichern"-Klick mehr nötig). Coalesct rasche
 *  Zell-Klicks zu einem Batch-Write (Pitfall #16/#20). */
const AUTOSAVE_DEBOUNCE_MS = 800;

export interface Draft {
  matrix: KompetenzMatrix;
  kontingent: Partial<Record<AntragstypBucket, number>>;
  abschlag: number;
}

export type SortCol = AntragstypBucket | 'Ab';
export interface SortState {
  col: SortCol | null;
  dir: 'desc' | 'asc';
}

/** Hover-Deskriptor — einziger React-State, der das CSS-Highlight + die
 *  Reveal-Bar treibt. */
export type HoverState =
  | { kind: 'col'; subIdx: number; ueberId: UeberkategorieId; label: string; ueberLabel: string }
  | { kind: 'group'; ueberId: UeberkategorieId; ueberLabel: string }
  | null;

export interface KompetenzMatrixModel {
  rows: AnonymerMitarbeiter[];
  drafts: Record<string, Draft>;
  effective: (ma: AnonymerMitarbeiter) => Draft;
  cycleCell: (anonId: string, ueber: UeberkategorieId, label: string) => void;
  setKontingent: (anonId: string, bucket: AntragstypBucket, raw: string) => void;
  setAbschlag: (anonId: string, raw: string) => void;
  /** Anzahl Zeilen mit noch nicht committeten Edits (wird gleich auto-gespeichert). */
  dirtyCount: number;
  /** Läuft gerade ein Commit (Auto-Save oder Flush)? */
  saving: boolean;
  /** Sofort-Commit ausstehender Edits (Button „Jetzt speichern"). */
  flushNow: () => void;
  /** Kurzes „✓ Gespeichert"-Feedback nach erfolgreichem Commit. */
  justSaved: boolean;
  /** Fehler des letzten Saves (z.B. fehlendes Schreibrecht) — sonst null. */
  saveError: string | null;
  clearSaveError: () => void;
  sort: SortState;
  cycleSort: (col: SortCol) => void;
  hover: HoverState;
  setHover: (h: HoverState) => void;
  clearHover: () => void;
  kapHidden: boolean;
  toggleKap: () => void;
  /** Editier-Modus — aus = Werte read-only (Schutz vor versehentlichem Ändern). */
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  showInactive: boolean;
  setShowInactive: (v: boolean) => void;
  inactiveCount: number;
  /** Gesamtzahl MAs (aktiv + inaktiv) — für den Footer-Zähler. */
  total: number;
}

export function maToDraft(ma: AnonymerMitarbeiter): Draft {
  const matrix: KompetenzMatrix = {};
  for (const [ueber, cells] of Object.entries(ma.kompetenzMatrix ?? {})) {
    matrix[ueber as keyof KompetenzMatrix] = { ...cells };
  }
  return {
    matrix,
    kontingent: { ...(ma.jahresKapazitaetProTyp ?? {}) },
    abschlag: ma.abschlagProzent ?? 0,
  };
}

function nextLevel(cur: KompetenzLevel | undefined): KompetenzLevel | undefined {
  return cur === undefined ? 1 : cur === 3 ? undefined : ((cur + 1) as KompetenzLevel);
}

/** Baut aus dem Draft-Snapshot die Store-Updates (eine Zeile je geändertem MA). */
function buildKompetenzUpdates(snapshot: Record<string, Draft>): KompetenzMatrixUpdate[] {
  return Object.entries(snapshot).map(([anonId, d]) => ({
    anonId,
    kompetenzMatrix: Object.keys(d.matrix).length > 0 ? d.matrix : undefined,
    jahresKapazitaetProTyp: Object.keys(d.kontingent).length > 0 ? d.kontingent : undefined,
    abschlagProzent: d.abschlag,
  }));
}

/** Sortwert einer Zeile für eine Kapazitäts-Spalte; `undefined` = leer → ans Ende.
 *  Abschlag 0 gilt als „leer" (kein Abschlag). */
function sortValue(ma: AnonymerMitarbeiter, col: SortCol): number | undefined {
  if (col === 'Ab') return ma.abschlagProzent || undefined;
  return ma.jahresKapazitaetProTyp?.[col];
}

function sortRows(list: AnonymerMitarbeiter[], sort: SortState): AnonymerMitarbeiter[] {
  if (!sort.col) return list;
  const col = sort.col;
  const withVal: AnonymerMitarbeiter[] = [];
  const empty: AnonymerMitarbeiter[] = [];
  for (const m of list) (sortValue(m, col) === undefined ? empty : withVal).push(m);
  withVal.sort((a, b) => {
    const av = sortValue(a, col)!;
    const bv = sortValue(b, col)!;
    return sort.dir === 'asc' ? av - bv : bv - av;
  });
  return [...withVal, ...empty]; // leere immer ans Ende, unabhängig von dir
}

export function useKompetenzMatrixModel(storage: StorageService): KompetenzMatrixModel {
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const applyBatch = useAuslastungData(s => s.applyKompetenzMatrixBatch);

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [sort, setSort] = useState<SortState>({ col: null, dir: 'desc' });
  const [hover, setHover] = useState<HoverState>(null);
  const [editMode, setEditMode] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [kapHidden, setKapHidden] = useState(() => {
    try { return localStorage.getItem(KAP_HIDDEN_KEY) === '1'; } catch { return false; }
  });
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Auto-Save (v2.31): Debounce-Timer + stets aktuelle Drafts/Run-Referenz, damit
  // der Timer-Callback den NEUESTEN Stand committet (nicht den Render-Closure).
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const runRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const allSorted = useMemo(
    () => Object.values(mitarbeiter).sort((a, b) => a.anonId.localeCompare(b.anonId)),
    [mitarbeiter],
  );
  const inactiveCount = useMemo(() => allSorted.filter(m => !m.aktiv).length, [allSorted]);
  const rows = useMemo(() => {
    const visible = showInactive ? allSorted : allSorted.filter(m => m.aktiv);
    return sortRows(visible, sort);
  }, [allSorted, showInactive, sort]);

  const effective = useCallback(
    (ma: AnonymerMitarbeiter): Draft => drafts[ma.anonId] ?? maToDraft(ma),
    [drafts],
  );

  // Auto-Save-Debounce (re)starten — coalesct rasche Zell-Klicks zu einem Write.
  const scheduleAutoCommit = useCallback((): void => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      autoTimer.current = null;
      void runRef.current();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  const update = useCallback((anonId: string, mutate: (d: Draft) => Draft): void => {
    setDrafts(prev => {
      const base = prev[anonId] ?? maToDraft(mitarbeiter[anonId]!);
      return { ...prev, [anonId]: mutate(base) };
    });
    scheduleAutoCommit();
  }, [mitarbeiter, scheduleAutoCommit]);

  const cycleCell = useCallback((anonId: string, ueber: UeberkategorieId, label: string): void => {
    update(anonId, cur => {
      const matrix: KompetenzMatrix = { ...cur.matrix };
      const sub = { ...(matrix[ueber] ?? {}) };
      const nxt = nextLevel(sub[label]);
      if (nxt === undefined) delete sub[label]; else sub[label] = nxt;
      if (Object.keys(sub).length > 0) matrix[ueber] = sub; else delete matrix[ueber];
      return { ...cur, matrix };
    });
  }, [update]);

  const setKontingent = useCallback((anonId: string, bucket: AntragstypBucket, raw: string): void => {
    update(anonId, cur => {
      const kontingent = { ...cur.kontingent };
      const v = Number(raw.trim().replace(',', '.'));
      if (raw.trim() === '' || !Number.isFinite(v) || v <= 0) delete kontingent[bucket];
      else kontingent[bucket] = v;
      return { ...cur, kontingent };
    });
  }, [update]);

  const setAbschlag = useCallback((anonId: string, raw: string): void => {
    update(anonId, cur => {
      const v = Number(raw.trim().replace(',', '.'));
      return { ...cur, abschlag: Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0 };
    });
  }, [update]);

  const cycleSort = useCallback((col: SortCol): void => {
    setSort(prev =>
      prev.col !== col ? { col, dir: 'desc' }
      : prev.dir === 'desc' ? { col, dir: 'asc' }
      : { col: null, dir: 'desc' },
    );
  }, []);

  const toggleKap = useCallback((): void => {
    setKapHidden(prev => {
      const next = !prev;
      try { localStorage.setItem(KAP_HIDDEN_KEY, next ? '1' : '0'); } catch { /* best-effort */ }
      return next;
    });
  }, []);

  const clearHover = useCallback(() => setHover(null), []);

  // Commit: liest den NEUESTEN Draft-Stand (draftsRef), schreibt in EINEM Batch
  // (ein setState + ein persist → atomicWrite, Pitfall #16/#20). Aufgerufen vom
  // Auto-Save-Timer, von flushNow() und beim Unmount.
  const save = useAsyncAction(async () => {
    const snapshot = draftsRef.current;
    const updates = buildKompetenzUpdates(snapshot);
    if (updates.length === 0) return;
    await applyBatch(storage, updates); // KEIN schema — gehört dem Import-Dialog
    // Nur die committeten Drafts entfernen, deren Referenz unverändert ist —
    // Edits, die WÄHREND des await getippt wurden, bleiben als Draft erhalten
    // (nächster Auto-Commit schreibt sie nach). Verhindert verlorene Eingaben.
    setDrafts(prev => {
      const next: Record<string, Draft> = {};
      for (const [anonId, d] of Object.entries(prev)) {
        if (snapshot[anonId] !== d) next[anonId] = d;
      }
      return next;
    });
    setJustSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setJustSaved(false), SAVED_FLASH_MS);
  });
  runRef.current = save.run;

  // Sofort-Commit (Button „Jetzt speichern") — Debounce abbrechen + jetzt schreiben.
  const flushNow = useCallback((): void => {
    if (autoTimer.current) { clearTimeout(autoTimer.current); autoTimer.current = null; }
    void runRef.current();
  }, []);

  // Unmount: ausstehende Drafts nachschreiben (sonst Verlust beim Wegnavigieren
  // innerhalb des Debounce-Fensters). Fire-and-forget — der Store lebt global.
  useEffect(() => () => {
    if (autoTimer.current) { clearTimeout(autoTimer.current); autoTimer.current = null; }
    if (savedTimer.current) { clearTimeout(savedTimer.current); savedTimer.current = null; }
    const pending = buildKompetenzUpdates(draftsRef.current);
    if (pending.length > 0) {
      void applyBatch(storage, pending).catch(err =>
        console.warn('[kompetenz-matrix] Auto-Save beim Unmount fehlgeschlagen:', err));
    }
  }, [storage, applyBatch]);

  return {
    rows,
    drafts,
    effective,
    cycleCell,
    setKontingent,
    setAbschlag,
    dirtyCount: Object.keys(drafts).length,
    saving: save.busy,
    flushNow,
    justSaved,
    saveError: save.error,
    clearSaveError: save.clearError,
    sort,
    cycleSort,
    hover,
    setHover,
    clearHover,
    kapHidden,
    toggleKap,
    editMode,
    setEditMode,
    showInactive,
    setShowInactive,
    inactiveCount,
    total: allSorted.length,
  };
}
