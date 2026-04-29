# Antrag-Snapshot + Sync-on-Boot

Date: 2026-04-29
Scope: Importer (Snapshot-Schreiber), neuer Snapshot-Service, App-Boot-Hook, Toast-UI

## Kontext

Die Anwendung wird täglich von 15–20 Usern genutzt. Drei CSV-Dateien werden je Tag aktualisiert; der Kurator macht den Re-Import. Heute landen die teuren Ergebnisse (Antrag-Datensätze, Verbund-Objekte, Akronym-Index, Historien, Row-Hashes) **nur in der lokalen IndexedDB des Kurators** — andere User-Geräte sehen davon nichts. Das passt nicht zur Realität, wo der Re-Import die geteilte Wahrheit für alle 15–20 User produzieren soll.

CSV-Files und CSV-Schemas werden bereits zentral abgelegt (`programm/csv-sources/<id>.csv`, `programm/csv-schemas/<id>.json` via [schemaRegistry.ts:9–62](src/core/services/csv/schemaRegistry.ts:9)). Was fehlt: das **Antrag-Aggregat** (Output des Mergers).

Ziel: nach jedem erfolgreichen Re-Import schreibt der Importer einen Snapshot der relevanten IDB-Stores ins Daten-Share. Beim App-Start prüft jedes User-Gerät, ob der Snapshot neuer ist als der lokal zuletzt eingelesene, und übernimmt ihn als Bulk-Import in seine IDB.

### Welche IDB-Stores gehören in den Snapshot?

| Store | Zweck | Sync? |
|---|---|---|
| `antraege` | Antrag-Datensätze, Hauptobjekt | **ja** |
| `antrag_historie` | Diff-Historie pro Antrag | **ja** |
| `verbuende` | Verbund-Aggregate | **ja** |
| `verbund_historie` | Diff-Historie pro Verbund | **ja** |
| `akronym_index` | Akronym → Aktenzeichen-Lookup | **ja** |
| `csv_row_hashes` | nötig, damit beim nächsten Re-Import auf User-Geräten `unchanged`-Buckets korrekt erkannt werden | **ja** |
| `programme` / `unterprogramme` / `csv_schemas` | Stamm-Daten | **ja** (Konsistenz mit Antrag-Daten erfordert dasselbe Programm-Setup) |
| `filter_definitionen` | UI-Filter | **nein**, User-spezifisch |

## Anforderungen

1. Nach erfolgreichem Re-Import schreibt der Importer einen vollständigen Snapshot des Programms ins Daten-Share.
2. Snapshot ist atomar geschrieben (keine halbgeschriebenen Manifeste).
3. Beim App-Start prüfen alle User-Geräte (nicht nur Kurator) das Manifest pro Programm und syncen bei Differenz.
4. Sync läuft **non-blocking im Hintergrund**, nachdem die App schon benutzbar ist (`setReady(true)`). Während des Syncs zeigt der Antraege-Plugin die jeweils zuletzt sichtbaren Daten — kurze visuelle Verschiebung beim Bulk-Replace ist akzeptiert.
5. User ohne Daten-Share-Handle (Demo-Variante) überspringen den Sync (kein Hard-Fehler).
6. Sync ist read-only vom Share, schreibt nur lokal in IDB. Keine Race-Condition mit dem Build-Lock-geschützten Re-Import.
7. Pro Store wird ein Hash gespeichert; Clients laden nur die Stores neu, die sich seit dem letzten Sync geändert haben.
8. Toast nach erfolgreichem Sync: *„Antragsdaten aktualisiert (Stand: 29.04.2026 14:32)"* (gleiches Pattern wie der bestehende `seedToast`/`quarterToast`). Bei Sync-Fehler: stiller Console-Warn, kein User-Toast (App nutzt lokale Kopie weiter).

## Lösung

### 1. Snapshot-Format auf dem Share

Pfad-Struktur unter dem bestehenden `programm/`-Root:

```
programm/
├── antraege/
│   └── snapshot/
│       └── <programmId>/
│           ├── manifest.json
│           ├── antraege.jsonl
│           ├── antrag_historie.jsonl
│           ├── verbuende.jsonl
│           ├── verbund_historie.jsonl
│           ├── akronym_index.jsonl
│           ├── csv_row_hashes.jsonl
│           ├── programme.jsonl       (1 Zeile, das Programm)
│           ├── unterprogramme.jsonl
│           └── csv_schemas.jsonl
```

`manifest.json`:

```json
{
  "version": 1,
  "snapshotVersion": "2026-04-29T14:32:00.000Z",
  "programmId": "fzd-2024",
  "createdAt": "2026-04-29T14:32:00.000Z",
  "createdBy": "kurator-anna",
  "stores": {
    "antraege":         { "count": 13521, "hash": "sha256-…" },
    "antrag_historie":  { "count":  8420, "hash": "sha256-…" },
    "verbuende":        { "count":  4200, "hash": "sha256-…" },
    "verbund_historie": { "count":   190, "hash": "sha256-…" },
    "akronym_index":    { "count":  3211, "hash": "sha256-…" },
    "csv_row_hashes":   { "count": 41477, "hash": "sha256-…" },
    "programme":        { "count":     1, "hash": "sha256-…" },
    "unterprogramme":   { "count":    12, "hash": "sha256-…" },
    "csv_schemas":      { "count":     3, "hash": "sha256-…" }
  }
}
```

`snapshotVersion` ist die für Idempotenz benutzte Identität. Format: ISO-8601-Timestamp des Re-Import-Endes. `hash` pro Store: `sha256-Hex` der konkatenierten JSONL-Bytes — erlaubt Clients, einzelne Stores zu skippen.

JSONL-Format: pro Zeile genau ein JSON-Objekt, abgeschlossen mit `\n`. Reihenfolge stabil sortiert nach Primary Key (für deterministische Hashes).

### 2. Snapshot-Schreiber im Importer

Neue Datei [src/core/services/csv/snapshot.ts](src/core/services/csv/snapshot.ts) mit:

```ts
export async function writeProgrammSnapshot(
  idb: IDBStore,
  smbHandle: FileSystemDirectoryHandle,
  programmId: string,
  createdBy: string,
): Promise<{ snapshotVersion: string; manifest: ProgrammSnapshotManifest }>
```

Funktion:
1. Liest alle relevanten Stores für die `programmId` aus IDB (`listAntraegeByProgramm`, `listVerbundsByProgramm`, …).
2. Sortiert deterministisch.
3. Serialisiert pro Store als JSONL-String.
4. Berechnet pro Store SHA-256.
5. Schreibt JSONL via `atomicWrite` ins Share.
6. Schreibt zuletzt das `manifest.json` via `atomicWrite` (atomarer Marker — solange Manifest fehlt oder ältere Version hat, ignoriert der Sync den Snapshot).

[importer.ts](src/core/services/csv/importer.ts) ruft am Ende, **nach** allen IDB-Writes und vor dem `logAudit`-Aufruf, `writeProgrammSnapshot(idb, smbHandle, schema.programm_id, kuratorName)` auf. Bei Fehler: best-effort, Audit-Log notiert `snapshot_failed` aber der Import-Result selbst ist erfolgreich (User sieht trotzdem die Bucket-Cards).

### 3. Sync-Service

Neue Datei [src/core/services/csv/snapshot-sync.ts](src/core/services/csv/snapshot-sync.ts) mit:

```ts
export interface SyncProgress {
  phase: 'manifest' | 'store' | 'done';
  currentStore?: string;
  storesDone: number;
  storesTotal: number;
}

export async function syncProgrammSnapshot(
  idb: IDBStore,
  smbHandle: FileSystemDirectoryHandle,
  programmId: string,
  onProgress?: (p: SyncProgress) => void,
): Promise<{ synced: boolean; snapshotVersion?: string; createdAt?: string }>
```

Algorithmus:
1. Manifest lesen. Wenn nicht vorhanden → `{ synced: false }`.
2. IDB-Key `snapshot-version-<programmId>` lesen. Wenn === `manifest.snapshotVersion` → `{ synced: false }` (idempotent skip).
3. Pro Store im Manifest:
   - IDB-Key `snapshot-store-hash-<programmId>-<storeName>` lesen.
   - Wenn === `manifest.stores[storeName].hash` → skip.
   - Sonst: JSONL streamend lesen (Line-Reader), jede Zeile parse, in chunked `put`-Bulks (z.B. 500/Batch) in den Ziel-Store schreiben. **Vor dem ersten Bulk** wird der Store komplett geleert (`clear()`-Operation), sodass deterministisch der gesamte Snapshot-Inhalt gespiegelt wird.
   - Hash nach erfolgreichem Schreiben in IDB persistieren.
4. Am Ende `snapshot-version-<programmId>` setzen + Manifest-Metadaten cachen für Toast-Anzeige.

`onProgress` feuert nach jedem Store mit `{ phase: 'store', currentStore, storesDone, storesTotal }`.

**`clear()`-Strategie:** sicherer als individuelle Diff-Berechnungen, weil der Snapshot per Definition die ground truth ist. User-spezifischer State (Filter etc.) liegt in anderen Stores, ist nicht betroffen.

### 4. Background-Sync-Hook in App.tsx

Der Sync läuft **nach** `setReady(true)` in einem separaten `useEffect`, sodass die App sofort benutzbar ist. Pattern entspricht der bestehenden `seedTestData`-Logik in [App.tsx:208–220](src/core/App.tsx:208) (auch fire-and-forget mit Toast).

Skizze:

```ts
// Snapshot-Sync im Hintergrund — App ist schon ready.
useEffect(() => {
  if (!ready || showOnboarding) return;
  let cancelled = false;
  (async () => {
    const handle = await getSmbHandle(storage.idb);
    if (!handle) return; // Demo-Variante oder kein Daten-Share gewählt
    const programme = await listProgramme(storage.idb);
    for (const p of programme) {
      if (cancelled) return;
      const r = await syncProgrammSnapshot(storage.idb, handle, p.id).catch(err => {
        console.warn(`[snapshot-sync] ${p.id} fehlgeschlagen`, err);
        return { synced: false } as const;
      });
      if (!cancelled && r.synced && r.createdAt) {
        setSyncToast(`${p.name}: Antragsdaten aktualisiert (Stand: ${formatDate(r.createdAt)})`);
        setTimeout(() => setSyncToast(null), 6000);
      }
    }
  })();
  return () => { cancelled = true; };
}, [ready, showOnboarding, storage]);
```

Toast-Komponente: ein zusätzliches `syncToast`-State analog zum bestehenden `seedToast` ([App.tsx:95–114](src/core/App.tsx:95)) und `quarterToast`. Render-Block kopiert dasselbe Markup mit anderem Icon (z.B. `📥` oder `🔄`).

**Wichtige UX-Notiz:** Während ein Store mid-sync ist (per `clear()` gefolgt von `put`-Bulks innerhalb einer einzigen IDB-Transaction wo möglich), kann das Antraege-Plugin kurzzeitig (~hundert Millisekunden) eine Liste mit veralteten oder unvollständigen Daten zeigen. Das ist durch IDB's Read-Snapshot-Verhalten innerhalb einer Transaction und die `useEffect`-Refresh-Trigger der React-Components weitgehend gedeckt. Für v1 keine spezielle Mid-Sync-UI — siehe „Out of Scope".

### 5. Force-Resync (Out of Scope für v1)

Optional als Folge-Feature: Button im Antraege-Plugin oder in den Einstellungen, der `snapshot-version-<programmId>` aus IDB löscht und den Sync neu triggert. **Nicht in dieser Spec.**

### Anti-Konfliktstrategie

- **Concurrent Re-Imports:** der existierende Build-Lock im Importer ([importer.ts:75](src/core/services/csv/importer.ts:75)) verhindert das. Snapshot-Schreiben passiert innerhalb desselben Locks.
- **Sync mid-write race:** wenn Client A das Manifest gerade liest, während Client B (Kurator) ein neues Manifest atomic-rewrite schreibt: Client A liest entweder die alte oder die neue Version, nie eine halbe. JSONL-Files werden von Client B vor dem Manifest geschrieben, das Manifest ist der Atomarmarker. Wenn Client A zwischen Manifest-Read und Store-Read das Manifest ändert sieht: Hash-Mismatch beim Lesen → retry-on-fail oder skip-this-boot (akzeptabel, beim nächsten Start zieht der neue Snapshot).
- **Snapshot fehlt initial:** beim allerersten Re-Import existiert noch kein Snapshot — Sync skipped sauber. Kurator macht den ersten Re-Import lokal wie bisher.

### Out of Scope

- Inkrementelle Delta-Snapshots (Volumen-Optimierung; bei <100 MB/Tag unnötig).
- Periodischer Background-Sync (App-Start reicht).
- Force-Resync-UI.
- Sync von `filter_definitionen` (User-lokal).
- Migrations-Pfad für bestehende User-Geräte mit veraltetem Stand: erste Sync-Operation überschreibt einfach lokale Stores mit Snapshot-Inhalt.
- Mid-Sync-UI-Glitch-Suppression im Antraege-Plugin (Spinner während eines aktiven Sync-Laufs). Per IDB-Transaction-Read-Semantik und der kurzen Bulk-Insert-Dauer akzeptabel.

## Akzeptanz-Kriterien

1. Re-Import schreibt nach erfolgreichem Lauf eine vollständige Verzeichnisstruktur unter `programm/antraege/snapshot/<programmId>/` ins Share. Manifest und alle JSONL-Files atomar geschrieben.
2. Beim App-Start auf einem zweiten User-Gerät (das den Re-Import nicht durchgeführt hat) ist die App sofort benutzbar; der Sync läuft im Hintergrund. Innerhalb weniger Sekunden zeigt das Antraege-Plugin die neuen Daten.
3. Toast nach erfolgreichem Hintergrund-Sync: `<Programm>: Antragsdaten aktualisiert (Stand: 29.04.2026 14:32)`. Auto-dismiss nach 6 s, schließbar via X.
4. Wiederholter App-Start ohne neuen Re-Import: kein sichtbarer Sync-Schritt (idempotenter skip via `snapshot-version`).
5. App-Start ohne SMB-Handle (Demo): kein Sync-Versuch, keine Fehlermeldung.
6. App-Start mit Handle aber ohne Snapshot (frisches Programm): kein Fehler, App startet normal.
7. Per-Store-Hash-Skip: wenn nur `antraege` sich ändert, lädt der Sync nur diesen Store neu (per `console.log`-Trace in DEV-Mode beobachtbar).

## Verifikation

1. Build:dev, HTML in zwei separaten Chrome-Profilen öffnen (User A und User B).
2. User A: Re-Import einer großen CSV. Audit-Log zeigt `csv_import` plus `snapshot_written`. Datei-Browser zeigt das neue Verzeichnis.
3. User B: App-Tab schließen, neu öffnen. Loader zeigt Sync-Status. Antraege-Plugin zeigt dieselben Anträge wie User A.
4. User B macht eine Filter-Auswahl, schließt Tab, öffnet neu: Filter-Stand bleibt (kein Sync für `filter_definitionen`), Antrag-Daten unverändert (idempotenter skip).
5. User A: nochmal Re-Import (kleinere Änderung). User B: neuer Tab → nur die geänderten Stores werden gesynct (im DEV-Tools-Log sichtbar), nicht alle 9.
6. Type-Check: `npx tsc -b` clean.

## Touchpoints (Implementation Plan füllt diese)

- **neu** `src/core/services/csv/snapshot.ts` (Schreiber)
- **neu** `src/core/services/csv/snapshot-sync.ts` (Leser/Sync)
- **modify** `src/core/services/csv/importer.ts` (Snapshot-Aufruf am Ende des Imports)
- **modify** `src/core/App.tsx` (Sync-Hook + Toast)
- **modify** `src/core/services/storage/idb-store.ts` falls neue IDB-Keys formalisiert werden (vermutlich nicht — `idb.set/get` reicht für die Sync-Versions-Marker)
