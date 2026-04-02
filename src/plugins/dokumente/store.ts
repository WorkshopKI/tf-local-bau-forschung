import { create } from 'zustand';
import type { StorageService } from '@/core/services/storage';

export interface DocumentMeta {
  id: string;
  filename: string;
  format: string;
  tags: string[];
  created: string;
  pages?: number;
  vorgangId?: string;
  source?: string;        // 'upload' | 'filesystem' | 'seed'
}

// Volles Dokument mit Markdown — nur beim Öffnen laden
export interface DocumentFull extends DocumentMeta {
  markdown: string;
}

// Backward-Compat: Seed-Dateien importieren `Document`
export type Document = DocumentFull;

interface DokumenteState {
  documents: DocumentMeta[];
  selectedId: string | null;
  searchQuery: string;
  activeTag: string | null;
  loading: boolean;

  loadAll: (storage: StorageService) => Promise<void>;
  add: (doc: Omit<DocumentFull, 'id' | 'created'>, storage: StorageService) => Promise<void>;
  remove: (id: string, storage: StorageService) => Promise<void>;
  updateTags: (id: string, tags: string[], storage: StorageService) => Promise<void>;
  setSelectedId: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setActiveTag: (tag: string | null) => void;
  loadDocument: (id: string, storage: StorageService) => Promise<DocumentFull | null>;
}

export const useDokumenteStore = create<DokumenteState>((set, get) => ({
  documents: [],
  selectedId: null,
  searchQuery: '',
  activeTag: null,
  loading: false,

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
      id: `DOC-${Date.now()}`,
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
  },

  remove: async (id, storage) => {
    await storage.idb.delete(`doc:${id}`);
    set({
      documents: get().documents.filter(d => d.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
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

  setSelectedId: (id) => set({ selectedId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setActiveTag: (tag) => set({ activeTag: tag }),

  // Volles Dokument laden (mit Markdown) — nur on-demand
  loadDocument: async (id, storage) => {
    return storage.idb.get<DocumentFull>(`doc:${id}`);
  },
}));
