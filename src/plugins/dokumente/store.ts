import { create } from 'zustand';
import type { StorageService } from '@/core/services/storage';

export interface Document {
  id: string;
  filename: string;
  format: string;
  markdown: string;
  tags: string[];
  created: string;
  pages?: number;
  vorgangId?: string;
}

interface DokumenteState {
  documents: Document[];
  selectedId: string | null;
  loadAll: (storage: StorageService) => Promise<void>;
  add: (doc: Omit<Document, 'id' | 'created'>, storage: StorageService) => Promise<void>;
  remove: (id: string, storage: StorageService) => Promise<void>;
  updateTags: (id: string, tags: string[], storage: StorageService) => Promise<void>;
  setSelectedId: (id: string | null) => void;
}

export const useDokumenteStore = create<DokumenteState>((set, get) => ({
  documents: [],
  selectedId: null,

  loadAll: async (storage) => {
    const keys = await storage.idb.keys('doc:');
    const docs: Document[] = [];
    for (const key of keys) {
      const raw = await storage.idb.get<Record<string, unknown>>(key);
      if (!raw) continue;
      // Fehlende Felder normalisieren — Dokumente aus FS-Scanner / Sync fehlen format/created
      docs.push({
        id: String(raw.id ?? key.replace('doc:', '')),
        filename: String(raw.filename ?? ''),
        format: String(raw.format ?? 'md'),
        markdown: String(raw.markdown ?? ''),
        tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
        created: String(raw.created ?? new Date().toISOString()),
        pages: typeof raw.pages === 'number' ? raw.pages : undefined,
        vorgangId: raw.vorgangId ? String(raw.vorgangId) : undefined,
      });
    }
    set({ documents: docs });
  },

  add: async (partial, storage) => {
    const doc: Document = {
      ...partial,
      id: `DOC-${Date.now()}`,
      created: new Date().toISOString(),
    };
    await storage.idb.set(`doc:${doc.id}`, doc);
    set({ documents: [...get().documents, doc] });
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
    const updated = docs.find(d => d.id === id);
    if (updated) await storage.idb.set(`doc:${id}`, updated);
    set({ documents: docs });
  },

  setSelectedId: (id) => set({ selectedId: id }),
}));
