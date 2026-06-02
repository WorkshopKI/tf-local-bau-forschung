/**
 * useKompetenzMatrixModel (v2.16) — geteilter State der Kompetenz-Matrix.
 *
 * EIN Modell, das Toolbar (Speichern + Dirty-Count) und Tabelle (Zell-Edits)
 * teilen — im View erzeugt, an beide durchgereicht. Hält den lokalen Draft pro
 * MA; „Speichern" committet alle geänderten Zeilen in EINEM Store-Batch
 * (`applyKompetenzMatrixBatch` → ein setState + ein persist, Pitfall #16/#20).
 *
 * Reine View-States: Sortierung, Hover (für Reveal-Bar + CSS-Highlight),
 * Kapazitäten-Toggle (localStorage), Inaktive-Toggle, „✓ Gespeichert"-Flash.
 * Sortierung nutzt bewusst die GESPEICHERTEN Werte (nicht den Draft) → kein
 * Zeilen-Springen während des Tippens; nach dem Speichern sortiert sich die
 * Liste neu.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { StorageService } from '@/core/services/storage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useAuslastungData } from './useAuslastungData';
import {
  type AntragstypBucket,
  type AnonymerMitarbeiter,
  type KompetenzLevel,
  type KompetenzMatrix,
} from '../types';
import type { UeberkategorieId } from '../services/default-labels';

const KAP_HIDDEN_KEY = 'komp_kaphidden';
const SAVED_FLASH_MS = 2600;

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
  dirtyCount: number;
  save: ReturnType<typeof useAsyncAction>;
  justSaved: boolean;
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

  const update = useCallback((anonId: string, mutate: (d: Draft) => Draft): void => {
    setDrafts(prev => {
      const base = prev[anonId] ?? maToDraft(mitarbeiter[anonId]!);
      return { ...prev, [anonId]: mutate(base) };
    });
  }, [mitarbeiter]);

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

  const save = useAsyncAction(async () => {
    const updates = Object.entries(drafts).map(([anonId, d]) => ({
      anonId,
      kompetenzMatrix: Object.keys(d.matrix).length > 0 ? d.matrix : undefined,
      jahresKapazitaetProTyp: Object.keys(d.kontingent).length > 0 ? d.kontingent : undefined,
      abschlagProzent: d.abschlag,
    }));
    await applyBatch(storage, updates); // KEIN schema — gehört dem Import-Dialog
    setDrafts({}); // erst nach Resolve clearen (nicht optimistisch, Plan-Risiko #7)
    setJustSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setJustSaved(false), SAVED_FLASH_MS);
  });

  return {
    rows,
    drafts,
    effective,
    cycleCell,
    setKontingent,
    setAbschlag,
    dirtyCount: Object.keys(drafts).length,
    save,
    justSaved,
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
