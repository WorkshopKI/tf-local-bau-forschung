import { create } from 'zustand';
import type { StorageService } from '@/core/services/storage';
import { uuid } from '@/core/services/id-generator';
import type { ConversionReport } from '@/core/services/converter';

export interface DocumentMeta {
  id: string;
  filename: string;
  format: string;
  tags: string[];
  created: string;
  pages?: number;
  vorgangId?: string;
  source?: string;        // 'upload' | 'filesystem' | 'seed'
  /** Konvertierungs-Report (optional; alte Docs vor v2.70 haben kein Feld). */
  conversion?: ConversionReport;
}

// Volles Dokument mit Markdown — nur beim Öffnen laden
export interface DocumentFull extends DocumentMeta {
  markdown: string;
}

// Backward-Compat: Seed-Dateien importieren `Document`
export type Document = DocumentFull;

const PINNED_KEY = 'teamflow_dokumente_pinned';

function loadPinned(): Set<string> {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr)) return new Set(arr.filter((v): v is string => typeof v === 'string'));
  } catch { /* ignore */ }
  return new Set();
}

function persistPinned(set: Set<string>): void {
  try { localStorage.setItem(PINNED_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}

interface DokumenteState {
  documents: DocumentMeta[];
  selectedId: string | null;
  searchQuery: string;
  activeTag: string | null;
  loading: boolean;
  /** Angeheftete Doc-IDs. Persisted in localStorage. */
  pinned: Set<string>;
  /** True = Fullscreen-Markdown-View aktiv (über „Öffnen" im Side-Panel).
   *  False = Liste + optional Side-Panel rechts. */
  viewingFullDoc: boolean;

  loadAll: (storage: StorageService) => Promise<void>;
  /** Speichert ein Dokument und gibt die generierte Doc-ID zurück (für späteres Re-Tagging). */
  add: (doc: Omit<DocumentFull, 'id' | 'created'>, storage: StorageService) => Promise<string>;
  remove: (id: string, storage: StorageService) => Promise<void>;
  updateTags: (id: string, tags: string[], storage: StorageService) => Promise<void>;
  setSelectedId: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setActiveTag: (tag: string | null) => void;
  togglePin: (id: string) => void;
  setViewingFullDoc: (b: boolean) => void;
  loadDocument: (id: string, storage: StorageService) => Promise<DocumentFull | null>;
}

export const useDokumenteStore = create<DokumenteState>((set, get) => ({
  documents: [],
  selectedId: null,
  searchQuery: '',
  activeTag: null,
  loading: false,
  pinned: loadPinned(),
  viewingFullDoc: false,

  loadAll: async (storage) => {
    set({ loading: true });
    const keys = await storage.idb.keys('doc:');
    const docs: DocumentMeta[] = [];
    for (const key of keys) {
      const raw = await storage.idb.get<Record<string, unknown>>(key);
      if (!raw) continue;
      // Nur Metadaten speichern, Markdown weglassen
      docs.push({
        id: String(raw.id ?? key.replace('doc:', '')),
        filename: String(raw.filename ?? ''),
        format: String(raw.format ?? 'md'),
        tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
        created: String(raw.created ?? new Date().toISOString()),
        pages: typeof raw.pages === 'number' ? raw.pages : undefined,
        vorgangId: raw.vorgangId ? String(raw.vorgangId) : undefined,
        source: raw.source ? String(raw.source) : undefined,
      });
    }
    // Neueste zuerst
    docs.sort((a, b) => b.created.localeCompare(a.created));
    set({ documents: docs, loading: false });
  },

  add: async (partial, storage) => {
    const doc: DocumentFull = {
      ...partial,
      id: uuid(),
      created: new Date().toISOString(),
    };
    await storage.idb.set(`doc:${doc.id}`, doc);
    // Nur Meta im State, neueste zuerst
    const meta: DocumentMeta = {
      id: doc.id, filename: doc.filename, format: doc.format,
      tags: doc.tags, created: doc.created, pages: doc.pages,
      vorgangId: doc.vorgangId, source: doc.source,
    };
    set({ documents: [meta, ...get().documents] });
    return doc.id;
  },

  remove: async (id, storage) => {
    await storage.idb.delete(`doc:${id}`);
    const nextPinned = new Set(get().pinned);
    if (nextPinned.delete(id)) persistPinned(nextPinned);
    set({
      documents: get().documents.filter(d => d.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
      pinned: nextPinned,
    });
  },

  updateTags: async (id, tags, storage) => {
    const docs = get().documents.map(d => d.id === id ? { ...d, tags } : d);
    // Volles Dokument aus IDB laden, Tags updaten, zurückschreiben
    const full = await storage.idb.get<DocumentFull>(`doc:${id}`);
    if (full) {
      full.tags = tags;
      await storage.idb.set(`doc:${id}`, full);
    }
    set({ documents: docs });
  },

  setSelectedId: (id) => set({ selectedId: id, viewingFullDoc: false }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setActiveTag: (tag) => set({ activeTag: tag }),

  togglePin: (id) => {
    const next = new Set(get().pinned);
    if (next.has(id)) next.delete(id); else next.add(id);
    persistPinned(next);
    set({ pinned: next });
  },

  setViewingFullDoc: (b) => set({ viewingFullDoc: b }),

  // Volles Dokument laden (mit Markdown) — nur on-demand
  loadDocument: async (id, storage) => {
    return storage.idb.get<DocumentFull>(`doc:${id}`);
  },
}));
