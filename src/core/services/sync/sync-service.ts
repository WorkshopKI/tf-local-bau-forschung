import { SyncQueueStore } from './sync-queue-store';
import type { SyncQueueItem } from './sync-queue-store';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { FileServerStore } from '@/core/services/storage/fs-store';

export interface SyncStatus {
  pending: number;
  syncing: boolean;
  lastSync: string | null;
  conflicts: number;
  failed: number;
  connected: boolean;
}

type StatusCallback = (status: SyncStatus) => void;

export class SyncService {
  private queue: SyncQueueStore;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private syncing = false;
  private lastSync: string | null = null;
  private subscribers: StatusCallback[] = [];
  private getFs: () => FileServerStore | null;
  private isConnected: () => boolean;

  constructor(idb: IDBStore, getFs: () => FileServerStore | null, isConnected: () => boolean) {
    this.queue = new SyncQueueStore(idb);
    this.getFs = getFs;
    this.isConnected = isConnected;
  }

  async init(): Promise<void> {
    this.start();
    // Process any pending items immediately
    await this.processQueue();
  }

  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.processQueue(), 30000);
  }

  stop(): void {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
  }

  async enqueue(item: Omit<SyncQueueItem, 'status'>): Promise<void> {
    await this.queue.add({ ...item, status: 'pending' });
    this.notifySubscribers();
    // Try to sync immediately
    setTimeout(() => this.processQueue(), 100);
  }

  async processQueue(): Promise<void> {
    if (this.syncing || !this.isConnected()) {
      this.notifySubscribers();
      return;
    }

    const fs = this.getFs();
    if (!fs) { this.notifySubscribers(); return; }

    const pending = await this.queue.getPending();
    if (pending.length === 0) { this.notifySubscribers(); return; }

    this.syncing = true;
    this.notifySubscribers();

    for (const item of pending) {
      try {
        if (item.type === 'write') {
          await fs.writeJSON(item.path, item.data);
        }
        await this.queue.remove(item.id);
      } catch {
        const newRetries = item.retries + 1;
        if (newRetries > 5) {
          await this.queue.update(item.id, { retries: newRetries, status: 'failed' });
        } else {
          await this.queue.update(item.id, { retries: newRetries });
        }
      }
      // 100ms pause between writes
      await new Promise(r => setTimeout(r, 100));
    }

    this.syncing = false;
    this.lastSync = new Date().toISOString();
    this.notifySubscribers();
  }

  async getStatus(): Promise<SyncStatus> {
    const all = await this.queue.getAll();
    return {
      pending: all.filter(i => i.status === 'pending').length,
      syncing: this.syncing,
      lastSync: this.lastSync,
      conflicts: all.filter(i => i.status === 'conflict').length,
      failed: all.filter(i => i.status === 'failed').length,
      connected: this.isConnected(),
    };
  }

  onStatusChange(callback: StatusCallback): () => void {
    this.subscribers.push(callback);
    return () => { this.subscribers = this.subscribers.filter(s => s !== callback); };
  }

  private notifySubscribers(): void {
    this.getStatus().then(status => {
      for (const cb of this.subscribers) cb(status);
    });
  }

  async retryFailed(): Promise<void> {
    const failed = await this.queue.getFailed();
    for (const item of failed) {
      await this.queue.update(item.id, { status: 'pending', retries: 0 });
    }
    await this.processQueue();
  }

  async discardFailed(): Promise<void> {
    const failed = await this.queue.getFailed();
    for (const item of failed) { await this.queue.remove(item.id); }
    this.notifySubscribers();
  }
}
