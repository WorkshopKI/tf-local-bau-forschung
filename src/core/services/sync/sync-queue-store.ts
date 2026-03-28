import { IDBStore } from '@/core/services/storage/idb-store';

export interface SyncQueueItem {
  id: string;
  type: 'write' | 'delete';
  path: string;
  data: unknown;
  timestamp: string;
  retries: number;
  status: 'pending' | 'failed' | 'conflict';
}

export class SyncQueueStore {
  private store = new IDBStore();
  private key = 'sync-queue-items';

  async init(): Promise<void> {
    await this.store.open();
  }

  async getAll(): Promise<SyncQueueItem[]> {
    return await this.store.get<SyncQueueItem[]>(this.key) ?? [];
  }

  async add(item: SyncQueueItem): Promise<void> {
    const items = await this.getAll();
    items.push(item);
    await this.store.set(this.key, items);
  }

  async remove(id: string): Promise<void> {
    const items = await this.getAll();
    await this.store.set(this.key, items.filter(i => i.id !== id));
  }

  async update(id: string, updates: Partial<SyncQueueItem>): Promise<void> {
    const items = await this.getAll();
    const idx = items.findIndex(i => i.id === id);
    if (idx >= 0 && items[idx]) {
      items[idx] = { ...items[idx], ...updates };
      await this.store.set(this.key, items);
    }
  }

  async clear(): Promise<void> {
    await this.store.set(this.key, []);
  }

  async getPending(): Promise<SyncQueueItem[]> {
    return (await this.getAll()).filter(i => i.status === 'pending');
  }

  async getConflicts(): Promise<SyncQueueItem[]> {
    return (await this.getAll()).filter(i => i.status === 'conflict');
  }

  async getFailed(): Promise<SyncQueueItem[]> {
    return (await this.getAll()).filter(i => i.status === 'failed');
  }
}
