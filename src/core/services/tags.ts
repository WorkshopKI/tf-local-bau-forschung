import type { StorageService } from '@/core/services/storage';

export interface TagEntry {
  name: string;
  color?: string;
  count: number;
}

export class TagService {
  private tags: TagEntry[] = [];

  async loadTags(storage: StorageService): Promise<void> {
    const saved = await storage.idb.get<TagEntry[]>('tag-registry');
    if (saved) this.tags = saved;
  }

  async saveTags(storage: StorageService): Promise<void> {
    await storage.idb.set('tag-registry', this.tags);
    if (storage.fs) {
      try {
        await storage.fs.writeJSON('.teamflow/tags.json', this.tags);
      } catch { /* FS write optional */ }
    }
  }

  addTag(name: string): void {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return;
    if (!this.tags.find(t => t.name === normalized)) {
      this.tags.push({ name: normalized, count: 0 });
    }
  }

  removeTag(name: string): void {
    this.tags = this.tags.filter(t => t.name !== name);
  }

  renameTag(oldName: string, newName: string): void {
    const normalized = newName.trim().toLowerCase();
    const tag = this.tags.find(t => t.name === oldName);
    if (tag && normalized) tag.name = normalized;
  }

  getPopularTags(limit = 10): TagEntry[] {
    return [...this.tags].sort((a, b) => b.count - a.count).slice(0, limit);
  }

  getAllTags(): TagEntry[] {
    return [...this.tags].sort((a, b) => a.name.localeCompare(b.name));
  }

  recountTags(allTags: string[]): void {
    const counts = new Map<string, number>();
    for (const t of allTags) {
      const n = t.trim().toLowerCase();
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    for (const tag of this.tags) {
      tag.count = counts.get(tag.name) ?? 0;
    }
    // Add new tags discovered
    for (const [name, count] of counts) {
      if (!this.tags.find(t => t.name === name)) {
        this.tags.push({ name, count });
      }
    }
  }

  suggest(prefix: string, limit = 5): string[] {
    const p = prefix.trim().toLowerCase();
    if (!p) return [];
    return this.tags
      .filter(t => t.name.startsWith(p))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(t => t.name);
  }
}
