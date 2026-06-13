# Neuer IndexedDB-Store

Wenn neue strukturierte Daten persistiert werden müssen (kein Key-Value im `kv`-Default-Store).

## Touch-Points (Pflicht)

1. **`src/core/services/storage/idb-store.ts`** — drei Stellen:
   - Konstanten-Eintrag in `CSV_STORES` / `PHASE2_STORES` (oder neuer Konstanten-Block) — Store-Name als String
   - `CsvStoreName`-Union ggf. erweitern
   - `version`-Bump (private `version = N`) und neuer Migration-Block:
     ```ts
     if (oldVersion < N) {
       if (!db.objectStoreNames.contains(MY_STORES.MY_STORE)) {
         const s = db.createObjectStore(MY_STORES.MY_STORE, { keyPath: '<id-feld>' });
         s.createIndex('<index-feld>', '<index-feld>', { unique: false });
       }
     }
     ```
2. **CRUD-Helper**: einen schmalen Wrapper im passenden Service-Verzeichnis anlegen (z.B. `src/phase2/scanner/manifest-store.ts` als Vorbild). Direkten IDB-Transaktions-Code **nicht** in UI-Komponenten streuen.
3. **`onblocked`-Handler beim Version-Bump**: Der `version`-Bump triggert ein DB-Upgrade. Liegt parallel ein zweiter Tab/eine zweite Variante auf demselben Origin (unter `file://` teilen sich ALLE Builds eine IndexedDB — siehe [recurring-bug-classes.md](../architecture/recurring-bug-classes.md) §3), blockiert das Upgrade. Der `onblocked`-Pfad im IDB-Open MUSS einen sichtbaren Hinweis liefern statt still zu hängen (nicht nur die Connection halten).

## Optional (je nach Anwendung)

4. **Sync-Whitelist**: Wenn der Store auf den Daten-Share gespiegelt werden soll, in `src/core/services/sync/sync-service.ts` oder einer separaten Mirror-Datei (vgl. `src/phase2/scanner/manifest-mirror.ts`) einbinden. **Wichtig**: Writes über `atomicWrite()` aus `src/core/services/infrastructure/atomic-write.ts`, nicht direkter `FileSystemWritableFileStream`.
5. **Backup-Inklusion**: `src/core/services/infrastructure/backup.ts` baut Snapshots aus IDB. Wenn der neue Store backupable ist, Whitelist-Eintrag dort prüfen/ergänzen.
6. **Migration-Helper**: Wenn der neue Store strukturell aus altem Store hervorgeht, `src/core/services/infrastructure/migration.ts` erweitern und einen `kurator_structure_migrated`-Audit-Event schreiben.
7. **Classifier-Version-Reset**: Wenn der Store eine Form von Klassifikator-Output hält (vgl. `phase2_skip_list`), `classifier_version`-Feld + Reset-Hook nach dem Vorbild aus `triage/triage.ts` einbauen.
8. **Welcome-Flow**: Wenn der Store für die App-Funktion zwingend ist und beim Erstaufruf leer wäre, in `App.tsx` Gate-Logik ergänzen analog zu `WelcomeScreen.tsx`.

## Anti-Patterns

- **Keine** direkten IDB-Transaktionen in UI-Komponenten — immer über einen Service-Wrapper.
- **Keine** Composite-Keys mit `null`-Komponenten — IDB erlaubt das nicht. Wenn nötig, Sentinel-String oder separater Index.
- **Keine** Schema-Änderung an bestehendem Store ohne `version`-Bump (auch nur ein neuer Index).

## Verifikation

- `npx tsc --noEmit`
- Im Browser: Bestehende DB löschen (DevTools → Application → IndexedDB → die Variant-DB löschen — im Dev-Build `teamflow-dev`, allgemein `teamflow-<outputFilename>`) → App neu laden → Schema-Migration läuft komplett durch
- Falls Multi-Tab-Risiko: zweiten Tab öffnen während Upgrade → `onblocked`-Pfad zeigt Fehler-Toast statt zu hängen
