export const CSV_STORES = {
  PROGRAMME: 'programme',
  UNTERPROGRAMME: 'unterprogramme',
  CSV_SCHEMAS: 'csv_schemas',
  CSV_ROW_HASHES: 'csv_row_hashes',
  ANTRAEGE: 'antraege',
  /** v8 (Phase 2): Schmale Listen-Projektion der Antraege fuer Listen/Dashboards.
   *  Volle Records bleiben in ANTRAEGE; LIST_VIEW spart bei 13k+ Records ~95 %
   *  structured-clone-Volumen beim Mount-Read. Schreib-Pfad: csv/merger/* +
   *  Bulk-Migration in App.tsx. */
  ANTRAEGE_LIST_VIEW: 'antraege_list_view',
  ANTRAG_HISTORIE: 'antrag_historie',
  VERBUENDE: 'verbuende',
  VERBUND_HISTORIE: 'verbund_historie',
  AKRONYM_INDEX: 'akronym_index',
} as const;

export const FILTER_STORE_NAME = 'filter_definitionen';

/** Phase-2-Stores für Triage / Matcher / Skip-List. */
export const PHASE2_STORES = {
  SKIP_LIST: 'phase2_skip_list',
  PENDING_ANTRAEGE: 'phase2_pending_antraege',
  SCAN_MANIFEST: 'phase2_scan_manifest',
  SCAN_CONFIG: 'phase2_scan_config',
} as const;

/** v1.15: Multi-Source-DMS-Konfigurations-Store. */
export const DMS_SOURCES_STORE = 'dms_sources';

/** v9 (Assistent Phase 0): Gerätelokales Ereignisprotokoll. Append-orientiert,
 *  Index auf `zeitstempel`. STRIKT LOKAL — steht in KEINER Snapshot-Allowlist,
 *  wird nie auf den Share gespiegelt (Invariante 1, Pitfall #37). Der Store-Name
 *  lebt in der Assistent-Domäne (src/core/services/assistent/protokoll/types.ts),
 *  hier bewusst gespiegelt, damit die Migration ohne Cross-Import auskommt. */
export const ASSISTENT_EREIGNISPROTOKOLL_STORE = 'assistent_ereignisprotokoll';

/** v10 (Assistent Phase 2): Gerätelokaler Gedächtnis-Store (konsolidierte Memory-
 *  Blocks). KeyPath `id`, Indexe `block` + `aktualisiert`. STRIKT LOKAL — steht in
 *  KEINER Snapshot-Allowlist, wird nie auf den Share gespiegelt (Invariante 1).
 *  Der Store-Name lebt in der Assistent-Domäne (src/core/services/assistent/
 *  gedaechtnis/types.ts), hier bewusst gespiegelt (Migration ohne Cross-Import). */
export const ASSISTENT_GEDAECHTNIS_STORE = 'assistent_gedaechtnis';

/** v11 (Status-System neu): versionierte Katalog-Fassungen (Mapping-Versionen),
 *  KeyPath `version`. Gerätelokal — kein Snapshot-/Share-Anteil (Portabilität nur
 *  über explizites JSON-Export/Import im Cockpit). Der Store-Name lebt in der
 *  Status-Domäne (src/core/status/stores.ts), hier gespiegelt (Migration ohne
 *  Cross-Import). */
export const STATUS_KATALOG_STORE = 'status_katalog';

/** v11 (Status-System neu): append-only Status-Event-Log. KeyPath `id`, Indexe
 *  `verbundId` + `feldId`. Gerätelokal — nie in einer Snapshot-Allowlist. Der
 *  Store-Name lebt in src/core/status/stores.ts, hier gespiegelt. */
export const STATUS_EVENT_STORE = 'status_event';

export type CsvStoreName =
  | (typeof CSV_STORES)[keyof typeof CSV_STORES]
  | typeof FILTER_STORE_NAME
  | (typeof PHASE2_STORES)[keyof typeof PHASE2_STORES]
  | typeof DMS_SOURCES_STORE;

export class IDBStore {
  private db: IDBDatabase | null = null;
  private readonly dbName: string;
  private readonly storeName = 'kv';
  private readonly version = 11;

  /**
   * @param dbName Variantenspezifischer DB-Name (`teamflow-<outputFilename>`).
   *   Produktiv von `storage/index.ts` via `getVariantDbName()` reingereicht —
   *   so bleibt diese Klasse konfig-frei. Der Default `'teamflow-test'` greift nur
   *   in Tests (`new IDBStore()` mit fake-indexeddb); er ist bewusst NICHT der
   *   nackte `'teamflow'`, damit Tests nie auf eine echte Varianten-DB zeigen.
   */
  constructor(dbName: string = 'teamflow-test') {
    this.dbName = dbName;
  }

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
        if (oldVersion < 5) {
          if (!db.objectStoreNames.contains(PHASE2_STORES.SKIP_LIST)) {
            // KeyPath = filename (DocID ist global eindeutig in der DMS-Welt).
            // antrag_id liegt als Sekundär-Feld in der Row + Index, weil es bei
            // orphan-irrelevant null sein darf — IDB-Composite-Keys vertragen
            // kein null.
            const s = db.createObjectStore(PHASE2_STORES.SKIP_LIST, { keyPath: 'filename' });
            s.createIndex('antrag_id', 'antrag_id', { unique: false });
            s.createIndex('classifier_version', 'classifier_version', { unique: false });
          }
          if (!db.objectStoreNames.contains(PHASE2_STORES.PENDING_ANTRAEGE)) {
            const s = db.createObjectStore(PHASE2_STORES.PENDING_ANTRAEGE, { keyPath: 'id' });
            s.createIndex('akronym', 'akronym', { unique: false });
          }
          if (!db.objectStoreNames.contains(PHASE2_STORES.SCAN_MANIFEST)) {
            const s = db.createObjectStore(PHASE2_STORES.SCAN_MANIFEST, { keyPath: 'filename' });
            s.createIndex('matched_antrag_id', 'matched_antrag_id', { unique: false });
            s.createIndex('triage_state', 'triage_state', { unique: false });
          }
        }
        if (oldVersion < 6) {
          // Singleton-Store für Dev-konfigurierte Scan-Pfade. Genau ein Eintrag
          // mit id='default'. Erlaubt zur Laufzeit Sub-Roots zu setzen ohne
          // Rebuild — Bulk-Triage liest die persistierte Liste statt
          // scanConfig.sub_roots aus der Build-Config.
          if (!db.objectStoreNames.contains(PHASE2_STORES.SCAN_CONFIG)) {
            db.createObjectStore(PHASE2_STORES.SCAN_CONFIG, { keyPath: 'id' });
          }
        }
        if (oldVersion < 7) {
          // v1.15: Multi-Source-DMS-Konfiguration. Ersetzt den Singleton-
          // SCAN_CONFIG-Store inhaltlich; SCAN_CONFIG bleibt als Read-Only-
          // Legacy fuer die Migration.
          if (!db.objectStoreNames.contains(DMS_SOURCES_STORE)) {
            const s = db.createObjectStore(DMS_SOURCES_STORE, { keyPath: 'id' });
            s.createIndex('by_active', 'is_active', { unique: false });
          }
          // Manifest bekommt einen neuen Sekundaer-Index auf source_id, damit
          // Listing pro Source ohne Full-Scan moeglich ist. Bestehende
          // Eintraege ohne source_id liefern fuer den Index undefined und
          // werden vom Index ignoriert — Listing-Helper mappt sie transparent
          // auf die Default-Source.
          const tx = req.transaction;
          if (tx) {
            const manifest = tx.objectStore(PHASE2_STORES.SCAN_MANIFEST);
            if (!manifest.indexNames.contains('by_source_id')) {
              manifest.createIndex('by_source_id', 'source_id', { unique: false });
            }
          }
        }
        if (oldVersion < 8) {
          // Phase 2 / Slim-List-Projection: schmaler Antrag-Spiegel-Store.
          // Der bestehende ANTRAEGE-Store bleibt unangetastet — er ist die
          // Source-of-Truth fuer Detail-Views. ANTRAEGE_LIST_VIEW haelt nur
          // die ~14 Felder, die Listen + Dashboards + Filter brauchen.
          // Bulk-Migration der bereits importierten Antraege laeuft beim
          // ersten App-Start nach dem Update (siehe ensureListViewProjection
          // in src/core/App.tsx).
          if (!db.objectStoreNames.contains(CSV_STORES.ANTRAEGE_LIST_VIEW)) {
            const s = db.createObjectStore(CSV_STORES.ANTRAEGE_LIST_VIEW, {
              keyPath: 'aktenzeichen',
            });
            s.createIndex('programm_id', 'programm_id', { unique: false });
          }
        }
        if (oldVersion < 9) {
          // Assistent Phase 0: gerätelokales Ereignisprotokoll. Append-orientiert,
          // Index auf zeitstempel (Retention + „letzte 100"-Ansicht). Existiert
          // schema-seitig in ALLEN Varianten (wie die Phase-2-Stores); geschrieben
          // wird nur hinter Feature-Flag + Opt-in (Gate im Recorder). STRIKT LOKAL —
          // niemals in einer Snapshot-Allowlist (Pitfall #37).
          if (!db.objectStoreNames.contains(ASSISTENT_EREIGNISPROTOKOLL_STORE)) {
            const s = db.createObjectStore(ASSISTENT_EREIGNISPROTOKOLL_STORE, { keyPath: 'id' });
            s.createIndex('zeitstempel', 'zeitstempel', { unique: false });
          }
        }
        if (oldVersion < 10) {
          // Assistent Phase 2: gerätelokaler Gedächtnis-Store (konsolidierte
          // Memory-Blocks). Existiert schema-seitig in ALLEN Varianten (wie die
          // Phase-0/Phase-2-Stores); geschrieben wird nur hinter Feature-Flag +
          // doppeltem Opt-in (Gate in gedaechtnis/recorder.ts + konsolidierung.ts).
          // STRIKT LOKAL — niemals in einer Snapshot-Allowlist (Invariante 1).
          if (!db.objectStoreNames.contains(ASSISTENT_GEDAECHTNIS_STORE)) {
            const s = db.createObjectStore(ASSISTENT_GEDAECHTNIS_STORE, { keyPath: 'id' });
            s.createIndex('block', 'block', { unique: false });
            s.createIndex('aktualisiert', 'aktualisiert', { unique: false });
          }
        }
        if (oldVersion < 11) {
          // Status-System neu: Katalog-Versionen + append-only Status-Event-Log.
          // Existieren schema-seitig in ALLEN Varianten; befüllt/gelesen wird nur
          // hinter dem `statusCockpit`-Flag. GERÄTELOKAL — nie in einer Snapshot-
          // Allowlist (Portabilität ausschließlich über JSON-Export/Import).
          if (!db.objectStoreNames.contains(STATUS_KATALOG_STORE)) {
            db.createObjectStore(STATUS_KATALOG_STORE, { keyPath: 'version' });
          }
          if (!db.objectStoreNames.contains(STATUS_EVENT_STORE)) {
            const s = db.createObjectStore(STATUS_EVENT_STORE, { keyPath: 'id' });
            s.createIndex('verbundId', 'verbundId', { unique: false });
            s.createIndex('feldId', 'feldId', { unique: false });
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
          'IndexedDB-Upgrade blockiert. Bitte alle anderen ZAH-Tabs schliessen und Seite neu laden.'
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

  /**
   * Alle Key/Value-Paare (optional Prefix-gefiltert) in EINER readonly-
   * Transaktion via Cursor. Fuer Bulk-Reads — z.B. den Embedding-Korpus —
   * drastisch schneller als `keys()` + N einzelne `get()`-Roundtrips (jeder
   * `get()` oeffnet sonst seine eigene Transaktion).
   *
   * Prefix-Filter ueber eine String-Range `[prefix, prefix+￿]`. Setzt
   * String-Keys voraus (der `kv`-Store nutzt out-of-line String-Keys) und dass
   * kein Key das Zeichen U+FFFF enthaelt — fuer alle bestehenden Prefixe erfuellt.
   */
  async entries(prefix?: string): Promise<Array<[string, unknown]>> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const range = prefix ? IDBKeyRange.bound(prefix, `${prefix}￿`) : undefined;
      const req = store.openCursor(range);
      const result: Array<[string, unknown]> = [];
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          result.push([cursor.key as string, cursor.value]);
          cursor.continue();
        } else {
          resolve(result);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  getDb(): IDBDatabase {
    if (!this.db) throw new Error('IDBStore not opened. Call open() first.');
    return this.db;
  }
}
