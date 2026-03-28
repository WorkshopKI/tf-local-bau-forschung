import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { TagService } from '@/core/services/tags';
import type { TagEntry } from '@/core/services/tags';
import type { StorageService } from '@/core/services/storage';

interface TagContextValue {
  allTags: TagEntry[];
  popularTags: TagEntry[];
  addTag: (name: string) => void;
  removeTag: (name: string) => void;
  renameTag: (oldName: string, newName: string) => void;
  recountTags: (allTagNames: string[]) => void;
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

  const renameTag = useCallback((oldName: string, newName: string) => {
    serviceRef.current.renameTag(oldName, newName);
    save();
  }, [save]);

  const recountTags = useCallback((allTagNames: string[]) => {
    serviceRef.current.recountTags(allTagNames);
    save();
  }, [save]);

  const suggest = useCallback((prefix: string) => {
    return serviceRef.current.suggest(prefix);
  }, []);

  return { allTags, popularTags, addTag, removeTag, renameTag, recountTags, suggest, refresh };
}
