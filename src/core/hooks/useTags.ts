import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { TagService, benenneTagInDokumentenUm } from '@/core/services/tags';
import type { TagEntry } from '@/core/services/tags';
import type { StorageService } from '@/core/services/storage';

interface TagContextValue {
  allTags: TagEntry[];
  popularTags: TagEntry[];
  addTag: (name: string) => void;
  removeTag: (name: string) => void;
  /**
   * Benennt den Tag in der Registry UND in allen Datensätzen um. Asynchron,
   * weil die Datensätze der eigentliche Ort sind — die Registry allein zu
   * ändern hätte das nächste „Neu zählen" wortlos zurückgedreht.
   */
  renameTag: (oldName: string, newName: string) => Promise<void>;
  /** `technische`: maschinell gesetzte Tags, die nicht in die Liste gehören. */
  recountTags: (allTagNames: string[], technische?: ReadonlySet<string>) => void;
  suggest: (prefix: string) => string[];
  refresh: () => void;
}

export const TagContext = createContext<TagContextValue | null>(null);

export function useTags(): TagContextValue {
  const ctx = useContext(TagContext);
  if (!ctx) throw new Error('useTags must be used within TagProvider');
  return ctx;
}

export function useTagProvider(storage: StorageService): TagContextValue {
  const serviceRef = useRef(new TagService());
  const [allTags, setAllTags] = useState<TagEntry[]>([]);
  const [popularTags, setPopularTags] = useState<TagEntry[]>([]);
  const initRef = useRef(false);

  const refresh = useCallback(() => {
    setAllTags(serviceRef.current.getAllTags());
    setPopularTags(serviceRef.current.getPopularTags());
  }, []);

  if (!initRef.current) {
    initRef.current = true;
    serviceRef.current.loadTags(storage).then(refresh);
  }

  const save = useCallback(() => {
    serviceRef.current.saveTags(storage);
    refresh();
  }, [storage, refresh]);

  const addTag = useCallback((name: string) => {
    serviceRef.current.addTag(name);
    save();
  }, [save]);

  const removeTag = useCallback((name: string) => {
    serviceRef.current.removeTag(name);
    save();
  }, [save]);

  const renameTag = useCallback(async (oldName: string, newName: string) => {
    // ERST die Datensätze, dann das Verzeichnis: schlägt der erste Schritt
    // fehl, bleibt beides beim alten Namen statt auseinanderzulaufen.
    await benenneTagInDokumentenUm(storage, oldName, newName);
    serviceRef.current.renameTag(oldName, newName);
    save();
  }, [storage, save]);

  const recountTags = useCallback((allTagNames: string[], technische?: ReadonlySet<string>) => {
    serviceRef.current.recountTags(allTagNames, technische);
    save();
  }, [save]);

  const suggest = useCallback((prefix: string) => {
    return serviceRef.current.suggest(prefix);
  }, []);

  return { allTags, popularTags, addTag, removeTag, renameTag, recountTags, suggest, refresh };
}
