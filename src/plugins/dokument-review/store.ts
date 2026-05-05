/**
 * Zustand-Store fuer Plugin "dokument-review".
 *
 * Haelt die UI-State (Selektion, Filter-Dimensionen, Sort, Pagination) und
 * eine simple Toast-Queue. Daten selbst (Manifest/Skip/Pending/Antraege)
 * leben in den Hooks (useManifestData, useAntraegeIndex), nicht hier — der
 * Store soll bei jedem View-Switch persistieren, die Daten nicht.
 *
 * viewMode wird nach localStorage gespiegelt (gleicher Pattern wie
 * GROUP_TOGGLE_KEY in AntraegeListe). Restliche Filter werden mit jedem
 * Page-Load zurueckgesetzt — bewusst so, weil Filter-Persistenz bei
 * batch-Reviews mehr stoert als hilft.
 */
import { create } from 'zustand';
import type { DocType, MatchConfidence, ClassifierSource } from '@/phase2';

const VIEW_MODE_KEY = 'teamflow_dokument_review_view';

export type ViewMode = 'review-queue' | 'all' | 'pending';
export type ConfidenceFilter = 'all' | NonNullable<MatchConfidence>;
export type DocTypeFilter = 'all' | DocType;
export type SourceFilter = 'all' | ClassifierSource;
export type SortKey = 'review_then_classified_desc' | 'filename' | 'doc_type' | 'confidence';

export interface ToastMessage {
  message: string;
  tone: 'success' | 'info' | 'error';
}

interface DokumentReviewState {
  selectedFilename: string | null;
  setSelected: (f: string | null) => void;

  viewMode: ViewMode;
  confidenceFilter: ConfidenceFilter;
  docTypeFilter: DocTypeFilter;
  sourceFilter: SourceFilter;
  setViewMode: (m: ViewMode) => void;
  setConfidenceFilter: (c: ConfidenceFilter) => void;
  setDocTypeFilter: (t: DocTypeFilter) => void;
  setSourceFilter: (s: SourceFilter) => void;
  resetFilters: () => void;

  sortKey: SortKey;
  setSortKey: (k: SortKey) => void;

  page: number;
  setPage: (p: number) => void;

  toast: ToastMessage | null;
  showToast: (message: string, tone?: ToastMessage['tone']) => void;
  dismissToast: () => void;
}

function readInitialViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    if (v === 'all' || v === 'pending' || v === 'review-queue') return v;
  } catch {
    // localStorage kann unter file:// ggf. blockiert sein
  }
  return 'review-queue';
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useDokumentReviewStore = create<DokumentReviewState>((set) => ({
  selectedFilename: null,
  setSelected: (f) => set({ selectedFilename: f }),

  viewMode: readInitialViewMode(),
  confidenceFilter: 'all',
  docTypeFilter: 'all',
  sourceFilter: 'all',
  setViewMode: (m) => {
    try { localStorage.setItem(VIEW_MODE_KEY, m); } catch {
      // noop
    }
    set({ viewMode: m, page: 0, selectedFilename: null });
  },
  setConfidenceFilter: (c) => set({ confidenceFilter: c, page: 0 }),
  setDocTypeFilter: (t) => set({ docTypeFilter: t, page: 0 }),
  setSourceFilter: (s) => set({ sourceFilter: s, page: 0 }),
  resetFilters: () => set({
    confidenceFilter: 'all',
    docTypeFilter: 'all',
    sourceFilter: 'all',
    page: 0,
  }),

  sortKey: 'review_then_classified_desc',
  setSortKey: (k) => set({ sortKey: k, page: 0 }),

  page: 0,
  setPage: (p) => set({ page: p }),

  toast: null,
  showToast: (message, tone = 'success') => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    set({ toast: { message, tone } });
    toastTimer = setTimeout(() => {
      set({ toast: null });
      toastTimer = null;
    }, 3000);
  },
  dismissToast: () => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    set({ toast: null });
  },
}));
