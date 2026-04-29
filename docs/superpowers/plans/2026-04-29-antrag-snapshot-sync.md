# Antrag-Snapshot + Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-Import-Ergebnisse zentral als Snapshot ins Daten-Share schreiben; alle User-Geräte syncen das Snapshot beim App-Start im Hintergrund. Damit muss der Re-Import nur einmal pro Tag (vom Kurator) durchgeführt werden — die übrigen 15–20 User ziehen die Daten automatisch.

**Architecture:** Reine Pure-Service-Layer (`snapshot.ts` + `snapshot-sync.ts`) ohne React-Bindings. Importer ruft Snapshot-Schreiber als finalen Schritt nach erfolgreichem Merge. App.tsx ergänzt einen Background-Sync-Effect nach `setReady(true)`, gleiches Pattern wie das bestehende `seedTestData`-Snippet.

**Tech Stack:** TypeScript strict, IDB (`putAntraege`/`putVerbund`/...-Bulk-Helper), File System Access API (`atomicWrite`/`readText`), Web Crypto (`crypto.subtle.digest('SHA-256', …)`), React 19 (für den App.tsx-Hook).

**Spec:** [docs/superpowers/specs/2026-04-29-antrag-snapshot-sync-design.md](../specs/2026-04-29-antrag-snapshot-sync-design.md)

---

## Task 1: Snapshot-Schreiber-Service

**Files:**
- Create: `src/core/services/csv/snapshot.ts`

**Verantwortung:** Pure Service-Funktion, die einen vollständigen Programm-Snapshot ins Daten-Share schreibt. Liest IDB, serialisiert, hasht, schreibt atomar.

- [ ] **Step 1: Datei anlegen**

```ts
import type { IDBStore } from '../storage/idb-store';
import { atomicWrite } from '../infrastructure/atomic-write';
import {
  listAntraegeByProgramm,
  // wir importieren weitere Helper unten — falls noch nicht exportiert: in idb-csv ergaenzen, siehe Step 2
} from './idb-csv';
import { listSchemasByProgramm } from './idb-csv';
import { getProgramm, listUnterprogrammeByProgramm } from './idb-csv';
import type {
  Antrag,
  AntragHistorieEntry,
  AkronymIndexEntry,
  CsvRowHash,
  CsvSchema,
  Programm,
  Unterprogramm,
  Verbund,
  VerbundHistorieEntry,
} from './types';

const SNAPSHOT_DIR = 'antraege/snapshot';
const SNAPSHOT_FILES = {
  antraege: 'antraege.jsonl',
  antrag_historie: 'antrag_historie.jsonl',
  verbuende: 'verbuende.jsonl',
  verbund_historie: 'verbund_historie.jsonl',
  akronym_index: 'akronym_index.jsonl',
  csv_row_hashes: 'csv_row_hashes.jsonl',
  programme: 'programme.jsonl',
  unterprogramme: 'unterprogramme.jsonl',
  csv_schemas: 'csv_schemas.jsonl',
} as const;

export type SnapshotStoreName = keyof typeof SNAPSHOT_FILES;

export interface ProgrammSnapshotManifest {
  version: 1;
  snapshotVersion: string;
  programmId: string;
  createdAt: string;
  createdBy: string;
  stores: Record<SnapshotStoreName, { count: number; hash: string }>;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return 'sha256-' + Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function toJsonl<T>(items: readonly T[], sortKey: (item: T) => string): string {
  const sorted = [...items].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  return sorted.map(it => JSON.stringify(it)).join('\n') + (sorted.length > 0 ? '\n' : '');
}

export async function writeProgrammSnapshot(
  idb: IDBStore,
  smbHandle: FileSystemDirectoryHandle,
  programmId: string,
  createdBy: string,
): Promise<{ snapshotVersion: string; manifest: ProgrammSnapshotManifest }> {
  // Programm-Verzeichnis: <programm-handle>/antraege/snapshot/<programmId>/
  const programm = await smbHandle.getDirectoryHandle('programm', { create: true });
  const antraegeDir = await programm.getDirectoryHandle('antraege', { create: true });
  const snapshotDir = await antraegeDir.getDirectoryHandle('snapshot', { create: true });
  const programmDir = await snapshotDir.getDirectoryHandle(programmId, { create: true });

  // 1. Stores aus IDB laden
  const programmObj = await getProgramm(idb, programmId);
  if (!programmObj) throw new Error(`Programm ${programmId} nicht in IDB`);

  const antraege = await listAntraegeByProgramm(idb, programmId);
  const antragHistorie = await listAntragHistorieByProgramm(idb, programmId);
  const verbuende = await listVerbundsByProgramm(idb, programmId);
  const verbundHistorie = await listVerbundHistorieByProgramm(idb, programmId);
  const akronymIndex = await listAkronymIndexByProgramm(idb, programmId);
  const csvSchemas = await listSchemasByProgramm(idb, programmId);
  const csvRowHashes = await listRowHashesBySchemas(idb, csvSchemas.map(s => s.id));
  const unterprogramme = await listUnterprogrammeByProgramm(idb, programmId);

  // 2. JSONL-Strings erzeugen (deterministisch sortiert)
  const data: Record<SnapshotStoreName, { jsonl: string; count: number }> = {
    antraege:         { jsonl: toJsonl(antraege,        a => String(a.aktenzeichen)), count: antraege.length },
    antrag_historie:  { jsonl: toJsonl(antragHistorie,  h => h.id),                   count: antragHistorie.length },
    verbuende:        { jsonl: toJsonl(verbuende,       v => v.verbund_id),           count: verbuende.length },
    verbund_historie: { jsonl: toJsonl(verbundHistorie, h => h.id),                   count: verbundHistorie.length },
    akronym_index:    { jsonl: toJsonl(akronymIndex,    e => `${e.programm_id}:${e.akronym}`), count: akronymIndex.length },
    csv_row_hashes:   { jsonl: toJsonl(csvRowHashes,    h => `${h.csv_schema_id}:${h.join_value}`), count: csvRowHashes.length },
    programme:        { jsonl: toJsonl([programmObj],   p => p.id),                   count: 1 },
    unterprogramme:   { jsonl: toJsonl(unterprogramme,  u => u.id),                   count: unterprogramme.length },
    csv_schemas:      { jsonl: toJsonl(csvSchemas,      s => s.id),                   count: csvSchemas.length },
  };

  // 3. Hashes berechnen
  const stores: ProgrammSnapshotManifest['stores'] = {} as ProgrammSnapshotManifest['stores'];
  for (const key of Object.keys(SNAPSHOT_FILES) as SnapshotStoreName[]) {
    stores[key] = { count: data[key].count, hash: await sha256Hex(data[key].jsonl) };
  }

  // 4. JSONL-Files schreiben (atomic, einzeln)
  for (const key of Object.keys(SNAPSHOT_FILES) as SnapshotStoreName[]) {
    await atomicWrite(programmDir, SNAPSHOT_FILES[key], data[key].jsonl);
  }

  // 5. Manifest als letztes (= atomarer Marker)
  const snapshotVersion = new Date().toISOString();
  const manifest: ProgrammSnapshotManifest = {
    version: 1,
    snapshotVersion,
    programmId,
    createdAt: snapshotVersion,
    createdBy,
    stores,
  };
  await atomicWrite(programmDir, 'manifest.json', JSON.stringify(manifest, null, 2));

  return { snapshotVersion, manifest };
}
```

- [ ] **Step 2: Fehlende List-Helper in `idb-csv.ts` exportieren**

Die Funktionen `listAntragHistorieByProgramm`, `listVerbundsByProgramm`, `listVerbundHistorieByProgramm`, `listAkronymIndexByProgramm`, `listRowHashesBySchemas`, `listUnterprogrammeByProgramm` sollten existieren oder in [src/core/services/csv/idb-csv.ts](src/core/services/csv/idb-csv.ts) ergänzt werden, falls sie noch nicht da sind. Verwende `Grep` um fehlende zu finden.

Skelett pro fehlendem Helper (Beispiel `listVerbundsByProgramm`):

```ts
export async function listVerbundsByProgramm(idb: IDBStore, programmId: string): Promise<Verbund[]> {
  const t = tx(idb, CSV_STORES.VERBUENDE, 'readonly');
  const idx = t.objectStore(CSV_STORES.VERBUENDE).index('programm_id');
  return (await req(idx.getAll(programmId))) as Verbund[];
}
```

Wenn der `programm_id`-Index nicht existiert, fallback auf `getAll()` + In-Memory-Filter.

- [ ] **Step 3: TypeScript-Check**

Run: `npx tsc -b`
Expected: keine Errors.

- [ ] **Step 4: Commit**

```
feat(csv-snapshot): writeProgrammSnapshot — vollstaendiger IDB-Stand als JSONL

Neuer Pure-Service src/core/services/csv/snapshot.ts mit
writeProgrammSnapshot(idb, smbHandle, programmId, createdBy). Liest 9
relevante Stores fuer das Programm aus IDB, serialisiert deterministisch
(sortiert nach Primary Key), berechnet SHA-256 pro Store, schreibt JSONL-
Files in programm/antraege/snapshot/<programmId>/ und das manifest.json
zuletzt als atomarer Marker.

Fehlende List-Helper in idb-csv.ts ergaenzt (Verbund / VerbundHistorie /
AkronymIndex / RowHashesBySchemas / UnterprogrammeByProgramm).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Task 2: Importer ruft Snapshot-Schreiber

**Files:**
- Modify: `src/core/services/csv/importer.ts`

- [ ] **Step 1: Import des Snapshot-Schreibers**

In den Imports oben ergänzen:

```ts
import { writeProgrammSnapshot } from './snapshot';
import { getSmbHandle } from '../infrastructure/smb-handle';
import { readKuratorName } from '../infrastructure/kurator-config';
```

- [ ] **Step 2: Snapshot-Aufruf am Ende des Imports**

Direkt vor der Stelle `result.durationMs = Date.now() - started;` (aktuell etwa Zeile 200, kurz vor `logAudit`):

```ts
// Snapshot ins Daten-Share — best-effort, blockiert den Import-Result nicht
try {
  const handle = await getSmbHandle(idb);
  if (handle) {
    const kuratorName = (await readKuratorName(idb)) ?? 'unbekannt';
    await writeProgrammSnapshot(idb, handle, schema.programm_id, kuratorName);
    await logAudit(idb, {
      action: 'snapshot_written',
      details: { programmId: schema.programm_id, schemaId },
    });
  }
} catch (e) {
  await logAudit(idb, {
    action: 'snapshot_failed',
    details: { programmId: schema.programm_id, schemaId, error: (e as Error).message },
  }).catch(() => undefined);
  console.warn('[csv-import] Snapshot-Write fehlgeschlagen:', e);
}
```

`readKuratorName` existiert in der Infrastructure-Schicht (siehe [CLAUDE.md](../../../CLAUDE.md) Abschnitt „Kurator-Config"). Falls es nicht direkt verfügbar ist (z.B. unter anderem Namen exportiert): kurz mit `Grep` lokalisieren oder `'unbekannt'` als Fallback.

- [ ] **Step 3: TypeScript-Check + Commit**

```
feat(csv-import): Snapshot ins Daten-Share schreiben nach erfolgreichem Merge

Importer ruft writeProgrammSnapshot am Ende des Imports auf (best-effort).
Audit-Eintraege snapshot_written / snapshot_failed. Fehler beim Snapshot
brechen den Import nicht ab — der lokale IDB-Stand ist trotzdem korrekt.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Task 3: Snapshot-Sync-Service (Reader)

**Files:**
- Create: `src/core/services/csv/snapshot-sync.ts`

**Verantwortung:** Liest das Manifest, vergleicht mit lokalem Stand, lädt geänderte Stores per `clear()` + chunked `put`-Bulk in IDB nach.

- [ ] **Step 1: Datei anlegen**

```ts
import type { IDBStore } from '../storage/idb-store';
import { CSV_STORES, type CsvStoreName } from '../storage/idb-store';
import { readText } from '../infrastructure/atomic-write';
import type { ProgrammSnapshotManifest, SnapshotStoreName } from './snapshot';
import { MAX_WRITES_PER_TX } from './constants';

export interface SyncProgress {
  phase: 'manifest' | 'store' | 'done';
  currentStore?: SnapshotStoreName;
  storesDone: number;
  storesTotal: number;
}

export interface SyncResult {
  synced: boolean;
  snapshotVersion?: string;
  createdAt?: string;
  /** Welche Stores wirklich neu geladen wurden (Hash-Mismatch). */
  reloadedStores?: SnapshotStoreName[];
}

const SYNC_VERSION_KEY = (programmId: string) => `snapshot-version-${programmId}`;
const SYNC_STORE_HASH_KEY = (programmId: string, store: SnapshotStoreName) =>
  `snapshot-store-hash-${programmId}-${store}`;

const STORE_FILES: Record<SnapshotStoreName, string> = {
  antraege: 'antraege.jsonl',
  antrag_historie: 'antrag_historie.jsonl',
  verbuende: 'verbuende.jsonl',
  verbund_historie: 'verbund_historie.jsonl',
  akronym_index: 'akronym_index.jsonl',
  csv_row_hashes: 'csv_row_hashes.jsonl',
  programme: 'programme.jsonl',
  unterprogramme: 'unterprogramme.jsonl',
  csv_schemas: 'csv_schemas.jsonl',
};

const STORE_TARGETS: Record<SnapshotStoreName, CsvStoreName> = {
  antraege: CSV_STORES.ANTRAEGE,
  antrag_historie: CSV_STORES.ANTRAG_HISTORIE,
  verbuende: CSV_STORES.VERBUENDE,
  verbund_historie: CSV_STORES.VERBUND_HISTORIE,
  akronym_index: CSV_STORES.AKRONYM_INDEX,
  csv_row_hashes: CSV_STORES.CSV_ROW_HASHES,
  programme: CSV_STORES.PROGRAMME,
  unterprogramme: CSV_STORES.UNTERPROGRAMME,
  csv_schemas: CSV_STORES.CSV_SCHEMAS,
};

export async function syncProgrammSnapshot(
  idb: IDBStore,
  smbHandle: FileSystemDirectoryHandle,
  programmId: string,
  onProgress?: (p: SyncProgress) => void,
): Promise<SyncResult> {
  // Verzeichnisstruktur: <handle>/programm/antraege/snapshot/<programmId>/
  let programmDir: FileSystemDirectoryHandle;
  try {
    const programm = await smbHandle.getDirectoryHandle('programm');
    const antraegeDir = await programm.getDirectoryHandle('antraege');
    const snapshotDir = await antraegeDir.getDirectoryHandle('snapshot');
    programmDir = await snapshotDir.getDirectoryHandle(programmId);
  } catch {
    return { synced: false };
  }

  // 1. Manifest lesen
  onProgress?.({ phase: 'manifest', storesDone: 0, storesTotal: 0 });
  let manifest: ProgrammSnapshotManifest;
  try {
    const manifestText = await readText(programmDir, 'manifest.json');
    if (!manifestText) return { synced: false };
    manifest = JSON.parse(manifestText) as ProgrammSnapshotManifest;
  } catch {
    return { synced: false };
  }

  // 2. Idempotenz-Check
  const lastSyncedVersion = await idb.get<string>(SYNC_VERSION_KEY(programmId));
  if (lastSyncedVersion === manifest.snapshotVersion) {
    return { synced: false };
  }

  // 3. Pro Store: Hash-Check + bei Mismatch laden
  const storeKeys = Object.keys(manifest.stores) as SnapshotStoreName[];
  const reloadedStores: SnapshotStoreName[] = [];
  let storesDone = 0;
  for (const storeKey of storeKeys) {
    onProgress?.({
      phase: 'store',
      currentStore: storeKey,
      storesDone,
      storesTotal: storeKeys.length,
    });
    const localHash = await idb.get<string>(SYNC_STORE_HASH_KEY(programmId, storeKey));
    const remoteHash = manifest.stores[storeKey].hash;
    if (localHash === remoteHash) {
      storesDone++;
      continue;
    }

    const jsonl = await readText(programmDir, STORE_FILES[storeKey]);
    if (jsonl === null) {
      console.warn(`[snapshot-sync] ${storeKey} fehlt im Snapshot, skip`);
      storesDone++;
      continue;
    }
    const items = jsonl
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => JSON.parse(line) as unknown);

    await replaceStore(idb, STORE_TARGETS[storeKey], items);
    await idb.set(SYNC_STORE_HASH_KEY(programmId, storeKey), remoteHash);
    reloadedStores.push(storeKey);
    storesDone++;
  }

  await idb.set(SYNC_VERSION_KEY(programmId), manifest.snapshotVersion);
  onProgress?.({ phase: 'done', storesDone, storesTotal: storeKeys.length });

  return {
    synced: true,
    snapshotVersion: manifest.snapshotVersion,
    createdAt: manifest.createdAt,
    reloadedStores,
  };
}

/**
 * clear() + chunked put. Wenn moeglich in einer einzigen Transaction;
 * bei sehr grossen Stores in mehreren TX (akzeptierter mid-sync-Glitch).
 */
async function replaceStore(idb: IDBStore, storeName: CsvStoreName, items: unknown[]): Promise<void> {
  const db = idb.getDb();

  // Erste TX: clear()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(storeName, 'readwrite');
    t.objectStore(storeName).clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });

  // Folge-TX: chunked put
  for (let i = 0; i < items.length; i += MAX_WRITES_PER_TX) {
    const chunk = items.slice(i, i + MAX_WRITES_PER_TX);
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(storeName, 'readwrite');
      const s = t.objectStore(storeName);
      for (const item of chunk) {
        s.put(item);
      }
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
}
```

- [ ] **Step 2: TypeScript-Check + Commit**

```
feat(csv-snapshot): syncProgrammSnapshot — Snapshot in lokale IDB ziehen

Neuer Service src/core/services/csv/snapshot-sync.ts. Liest manifest.json,
vergleicht snapshotVersion mit lokalem Cache, laedt nur Stores mit Hash-
Mismatch. Pro Store: clear() + chunked put. Idempotenter Skip wenn keine
neue Snapshot-Version. Fail-soft: fehlendes Manifest oder fehlende Datei
=> { synced: false }, kein Throw.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Task 4: Background-Sync-Hook + Toast in App.tsx

**Files:**
- Modify: `src/core/App.tsx`

- [ ] **Step 1: Imports erweitern**

```ts
import { listProgramme } from '@/core/services/csv';
import { syncProgrammSnapshot } from '@/core/services/csv/snapshot-sync';
```

(falls `listProgramme` noch nicht aus dem `csv`-Barrel exportiert wird, im Barrel ergänzen)

- [ ] **Step 2: `syncToast`-State + UI-Slot in `AppInner`**

Im `AppInner`-Component (etwa Zeile 134), neben `seedToast`:

```ts
const [syncToast, setSyncToast] = useState<string | null>(null);
```

In `AppProviders` als Prop durchreichen analog zu `seedToast`/`setSeedToast`. Toast-Render-Block kopieren mit anderem Icon (`📥`):

```tsx
{syncToast && (
  <div
    className="fixed top-16 right-4 z-[60] max-w-[360px] px-3.5 py-2.5 rounded-[var(--tf-radius-lg)] bg-[var(--tf-bg)] text-[12.5px] text-[var(--tf-text)] shadow-lg animate-in fade-in slide-in-from-top-2"
    style={{ border: '0.5px solid var(--tf-border)' }}
    role="status"
  >
    <div className="flex items-start gap-2">
      <span>📥</span>
      <div className="flex-1">{syncToast}</div>
      <button
        type="button"
        onClick={() => setSyncToast(null)}
        className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
        aria-label="Schließen"
      >
        ×
      </button>
    </div>
  </div>
)}
```

`top-16` statt `top-4` damit der Sync-Toast nicht mit `seedToast` (top-4) kollidiert.

- [ ] **Step 3: Background-Sync-Effect in `AppInner`**

Direkt nach dem Demo-Auto-Seed-Effekt (etwa Zeile 220), neuer `useEffect`:

```ts
// Snapshot-Sync — non-blocking, nach App-Start
useEffect(() => {
  if (!ready || showOnboarding) return;
  let cancelled = false;
  (async () => {
    const handle = await getDatenShareHandle(storage.idb);
    if (!handle) return; // Demo-Variante oder kein Daten-Share
    const programme = await listProgramme(storage.idb);
    for (const p of programme) {
      if (cancelled) return;
      const r = await syncProgrammSnapshot(storage.idb, handle, p.id).catch(err => {
        console.warn(`[snapshot-sync] ${p.id} fehlgeschlagen`, err);
        return { synced: false } as const;
      });
      if (!cancelled && r.synced && 'createdAt' in r && r.createdAt) {
        const stamp = new Date(r.createdAt).toLocaleString('de-DE', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
        setSyncToast(`${p.name}: Antragsdaten aktualisiert (Stand: ${stamp})`);
        setTimeout(() => { if (!cancelled) setSyncToast(null); }, 6000);
      }
    }
  })();
  return () => { cancelled = true; };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [ready, showOnboarding]);
```

`getDatenShareHandle` ist bereits importiert ([App.tsx:18](src/core/App.tsx)).

- [ ] **Step 4: TypeScript-Check + Commit**

```
feat(app): Snapshot-Sync im Hintergrund nach App-Start

Neuer useEffect nach dem ready-Flag laeuft fire-and-forget durch alle
Programme und ruft syncProgrammSnapshot. Bei Erfolg: Toast oben rechts
"<Programm>: Antragsdaten aktualisiert (Stand: …)", auto-dismiss nach 6s.
Toast-Slot teilt sich Layout mit seedToast/quarterToast — neue Position
top-16. Sync ueberspringt sauber, wenn kein SMB-Handle (Demo-Variante).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Task 5: Build + visuelle Verifikation

**Files:**
- (keine Änderungen — nur Build und manueller Test)

- [ ] **Step 1: Dev-Build**

Run: `npm run build:dev`
Expected: erfolgreich, HTML in `dist-single/dev/teamflow-dev.html`.

- [ ] **Step 2: Test-Szenario aufsetzen**

Zwei separate Chrome-Profile öffnen (nennen wir sie A=Kurator, B=User).
- A öffnet `dist-single/dev/teamflow-dev.html`, picked Daten-Share, macht Onboarding.
- B öffnet die HTML, picked **denselben** Daten-Share, macht Onboarding.

- [ ] **Step 3: Re-Import bei A**

A geht in den Kurator-Bereich → CSV-Sources → Re-Import einer der vorhandenen Sources. Lasse durchlaufen.

Im Datei-Browser sollte unter dem Daten-Share das Verzeichnis `programm/antraege/snapshot/<programmId>/` mit `manifest.json` und 9 JSONL-Files erscheinen.

- [ ] **Step 4: B neu starten**

B schließt Tab, öffnet Datei neu. Erwartung:
- App ist sofort benutzbar (kein Loader-Block)
- Innerhalb weniger Sekunden: Toast oben rechts: *„<Programm>: Antragsdaten aktualisiert (Stand: …)"*
- Antraege-Plugin in B zeigt dieselben Anträge wie A.

- [ ] **Step 5: Idempotenz-Check**

B schließt Tab nochmal, öffnet ihn nochmal. Erwartung:
- Kein Sync-Toast (Snapshot-Version unverändert).
- Antrag-Daten unverändert.

- [ ] **Step 6: Inkrementeller Sync**

A macht erneut Re-Import (kann auch mit derselben Datei sein, falls `file_checksum` nicht mehr matched — sonst neue Datei). Snapshot-Version ändert sich.

B schließt + öffnet Tab. Erwartung:
- Sync-Toast erscheint wieder.
- DEV-Tools-Console (in B) sollte `[snapshot-sync]` Logs zeigen, oder bei einem Audit-Log-Lauf nur die `antraege` (oder welche-auch-immer) reloaded werden, nicht alle 9 Stores.

- [ ] **Step 7: Demo-Variante kein Sync**

`build:demo` bauen, Demo-HTML öffnen. Erwartung:
- Kein Sync-Toast (kein Daten-Share-Handle).
- Keine Console-Errors.

- [ ] **Step 8: Sync-Fehler-Resilienz (optional)**

Während B's Sync läuft (sehr kurzer Window): Daten-Share kurzfristig offline machen. Erwartung:
- Console-Warning, aber keine Crash, kein Data-Loss.
- App nutzt lokale Kopie weiter.

---

## Spec-Coverage-Check

| Anforderung | Task |
|---|---|
| 1. Snapshot-Schreibung nach Re-Import | Task 1 + 2 |
| 2. Atomar geschrieben (Manifest als Marker) | Task 1 (Step 1, manifest as last write) |
| 3. App-Start prüft Manifest, syncs bei Differenz | Task 3 + 4 |
| 4. Non-blocking + Toast | Task 4 |
| 5. Demo-Variante skippt sauber | Task 4 (`if (!handle) return`) |
| 6. Build-Lock-Konflikt-frei | Task 1 (kein Lock im Reader) + Task 2 (innerhalb Lock im Writer) |
| 7. Per-Store-Hash-Skip | Task 1 (Hash) + Task 3 (Vergleich) |
| 8. Erfolgs-Toast | Task 4 |
| Demo skippt | Task 4 |
