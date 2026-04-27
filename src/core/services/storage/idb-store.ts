export const CSV_STORES = {
  PROGRAMME: 'programme',
  UNTERPROGRAMME: 'unterprogramme',
  CSV_SCHEMAS: 'csv_schemas',
  CSV_ROW_HASHES: 'csv_row_hashes',
  ANTRAEGE: 'antraege',
  ANTRAG_HISTORIE: 'antrag_historie',
  VERBUENDE: 'verbuende',
  VERBUND_HISTORIE: 'verbund_historie',
  AKRONYM_INDEX: 'akronym_index',
} as const;

export const FILTER_STORE_NAME = 'filter_definitionen';

export type CsvStoreName = (typeof CSV_STORES)[keyof typeof CSV_STORES] | typeof FILTER_STORE_NAME;

export class IDBStore {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'teamflow';
  private readonly storeName = 'kv';
  private readonly version = 4;

  async open(): Promise<void> {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onupgradeneeded = event => {
        const db = req.result;
        const oldVersion = event.oldVersion;
        if (oldVersion < 1 && !db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(CSV_STORES.PROGRAMME)) {
            db.createObjectStore(CSV_STORES.PROGRAMME, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(CSV_STORES.UNTERPROGRAMME)) {
            const s = db.createObjectStore(CSV_STORES.UNTERPROGRAMME, { keyPath: 'id' });
            s.createIndex('programm_id', 'programm_id', { unique: false });
          }
          if (!db.objectStoreNames.contains(CSV_STORES.CSV_SCHEMAS)) {
            const s = db.createObjectStore(CSV_STORES.CSV_SCHEMAS, { keyPath: 'id' });
            s.createIndex('programm_id', 'programm_id', { unique: false });
            s.createIndex('is_master', 'is_master', { unique: false });
          }
          if (!db.objectStoreNames.contains(CSV_STORES.CSV_ROW_HASHES)) {
            const s = db.createObjectStore(CSV_STORES.CSV_ROW_HASHES, {
              keyPath: ['csv_schema_id', 'join_value'],
            });
            s.createIndex('csv_schema_id', 'csv_schema_id', { unique: false });
          }
          if (!db.objectStoreNames.contains(CSV_STORES.ANTRAEGE)) {
            const s = db.createObjectStore(CSV_STORES.ANTRAEGE, { keyPath: 'aktenzeichen' });
            s.createIndex('programm_id', 'programm_id', { unique: false });
            s.createIndex('verbund_id', 'verbund_id', { unique: false });
            s.createIndex('akronym', 'akronym', { unique: false });
          }
          if (!db.objectStoreNames.contains(CSV_STORES.ANTRAG_HISTORIE)) {
            const s = db.createObjectStore(CSV_STORES.ANTRAG_HISTORIE, { keyPath: 'id' });
            s.createIndex('aktenzeichen', 'aktenzeichen', { unique: false });
          }
          if (!db.objectStoreNames.contains(CSV_STORES.VERBUENDE)) {
            const s = db.createObjectStore(CSV_STORES.VERBUENDE, { keyPath: 'verbund_id' });
            s.createIndex('programm_id', 'programm_id', { unique: false });
          }
          if (!db.objectStoreNames.contains(CSV_STORES.AKRONYM_INDEX)) {
            db.createObjectStore(CSV_STORES.AKRONYM_INDEX, {
              keyPath: ['programm_id', 'akronym'],
            });
          }
        }
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains(FILTER_STORE_NAME)) {
            const s = db.createObjectStore(FILTER_STORE_NAME, { keyPath: 'id' });
            s.createIndex('programm_id', 'programm_id', { unique: false });
            s.createIndex('scope', 'scope', { unique: false });
          }
        }
        if (oldVersion < 4) {
          if (!db.objectStoreNames.contains(CSV_STORES.VERBUND_HISTORIE)) {
            const s = db.createObjectStore(CSV_STORES.VERBUND_HISTORIE, { keyPath: 'id' });
            s.createIndex('verbund_id', 'verbund_id', { unique: false });
          }
        }
      };
      req.onsuccess = () => {
        this.db = req.result;
        // Wenn ein anderer Tab spaeter ein DB-Upgrade ausloest, schliessen wir
        // hier unsere Verbindung, damit der andere Tab nicht blockiert.
        this.db.onversionchange = () => {
          this.db?.close();
          this.db = null;
        };
        resolve();
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => {
        // Ein anderer Tab haelt eine aeltere DB-Version offen und verhindert das Upgrade.
        // Ohne diesen Handler wuerde die Promise nie aufgeloest — App-Loader blieb haengen.
        reject(new Error(
          'IndexedDB-Upgrade blockiert. Bitte alle anderen TeamFlow-Tabs schliessen und Seite neu laden.'
        ));
      };
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async set(key: string, value: unknown): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async delete(key: string): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async keys(prefix?: string): Promise<string[]> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const allKeys = req.result as string[];
        resolve(prefix ? allKeys.filter(k => k.startsWith(prefix)) : allKeys);
      };
      req.onerror = () => reject(req.error);
    });
  }

  getDb(): IDBDatabase {
    if (!this.db) throw new Error('IDBStore not opened. Call open() first.');
    return this.db;
  }
}
