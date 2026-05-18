# Sidecar-Datei auf dem Daten-Share spiegeln

Wenn ein Plugin Output erzeugt, der zwischen Geräten geteilt werden soll, statt jedes Gerät neu rechnen zu lassen (z.B. Embedding-Korpus, Kürzel-Map, vorgerechneter Index). Sidecar = persistente Datei auf dem SMB-Daten-Share neben dem IDB-Cache.

Referenz-Implementierung: [src/plugins/auslastung/services/embedding-corpus-mirror.ts](../../src/plugins/auslastung/services/embedding-corpus-mirror.ts) (~40 MB Vektor-Korpus, der lokalen Cold-Start von 46 min auf ~20 sek reduziert).

## Touch-Points (Pflicht)

1. **Pfad-Konstante** im Plugin-Service:
   ```ts
   export const FOO_SIDECAR_PATH = '_intern/<plugin-id>-<artifact>.json';
   ```
   Konvention: `_intern/<plugin-id>-<artifact>.{manifest.json,bin}` für Manifest+Binär-Paare, sonst `_intern/<plugin-id>-<artifact>.json`. Niemals Daten unter `programm/` ablegen (das ist für Antrags-Artefakte reserviert).

2. **Schreiben via `atomicWrite()`** aus [src/core/services/infrastructure/atomic-write.ts](../../src/core/services/infrastructure/atomic-write.ts):
   ```ts
   import { atomicWrite } from '@/core/services/infrastructure/atomic-write';
   await atomicWrite(datenShareHandle, FOO_SIDECAR_PATH, JSON.stringify(payload));
   ```
   Bei Binärdaten `Uint8Array` übergeben. Bei „großen Files die nie korrumpieren dürfen aber Rotation eh nicht brauchen" (z.B. Embedding-Bin): `{ skipBackup: true }` setzen — spart eine `.backup`-Kopie der ~40 MB pro Write.

3. **Lesen via `readText()` / `readBinary()`** (gleiche Datei). Beide returnen `null` wenn die Datei fehlt — kein try/catch nötig:
   ```ts
   import { readText } from '@/core/services/infrastructure/atomic-write';
   const raw = await readText(datenShareHandle, FOO_SIDECAR_PATH);
   if (!raw) { /* erstmaliger Build */ }
   ```

4. **Daten-Share-Handle** über [getDatenShareHandle()](../../src/core/services/infrastructure/smb-handle.ts) (nicht `storage.fs` — der hängt am alten Programm-Handle). Vor Schreib-Aktionen `requireOnline()` aus [useSmbStatus](../../src/core/hooks/useSmbStatus.ts) prüfen.

5. **Manifest-Schema** (Pflicht für alles außer trivialen Key-Value-Dateien):
   ```ts
   interface MyArtifactManifest {
     version: 1;                    // Schema-Version, bump bei Breaking-Change
     updatedAt: string;             // ISO-Datum des letzten Schreibens
     builderProfile?: string;       // Nur Notiz, nicht security
     // domänenspezifisch:
     payloadHash?: string;          // SHA-256 für Drift-Detection
     // ...
   }
   ```
   SHA-256 via Web-Crypto: `crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalText))`.

6. **Build-Lock** wenn der Build teuer ist (> 30 Sek) und parallele Builds Korruption riskieren würden:
   ```ts
   import { acquireBuildLock, releaseBuildLock, heartbeat } from '@/core/services/infrastructure/build-lock';
   const lock = await acquireBuildLock({ programm_id, stufe: '<plugin-id>-<artifact>', kurator_name });
   try { /* ... */ await heartbeat(...); /* ... */ }
   finally { await releaseBuildLock(lock); }
   ```
   `stufe`-Konvention: `<plugin-id>-<artifact>` (z.B. `auslastung-corpus`).

7. **Audit-Log-Actions** für Schreib-Operationen:
   ```ts
   await logAudit({ user, action: '<plugin-id>_artifact_uploaded', details: { bytes, count } });
   await logAudit({ user, action: '<plugin-id>_artifact_downloaded', details: { ... } });
   ```
   Naming: `<plugin-id>_<artifact-name>_<verb>`, snake-case. Verben: `uploaded`, `downloaded`, `built`, `discarded`, `mismatch_detected`.

8. **Eintrag im `Datenverzeichnis (v1.9)`-Block in CLAUDE.md** — eine Zeile pro Sidecar mit Pfad + 1-Satz-Zweck + Schema-Hinweis. Stilbeispiel:
   > `_intern/auslastung-embedding-corpus.bin` — Auslastungs-Modul: konkat. float32-Vektoren …

## Kompatibilität & Drift-Detection

Sidecars werden zwischen Geräten geteilt → Versions-/Modell-Mismatch ist die kritische Failure-Mode. Drei Schichten:

- **Schema-Versionierung**: Manifest `version`-Feld. Reader prüft → wirft bei unbekannter Version, zeigt UI-Hinweis statt zu erraten.
- **Inhalts-Versionierung**: Wenn der Sidecar von einem ML-Modell abhängt (z.B. Embedding-Vektoren), Modell-ID + Dim im Manifest. Reader prüft gegen lokales Modell → Mismatch blockiert Laden ohne Sentinel-Werte zu erfinden.
- **Drift-Detection**: SHA-256 über kanonisierte Eingabe (z.B. sortierte aktenzeichen-Liste). Reader vergleicht → Mismatch ist warnender Hinweis, kein Block.

Beispiel: [`hashAktenzeichenSet()` in embedding-corpus-mirror.ts](../../src/plugins/auslastung/services/embedding-corpus-mirror.ts).

## UX

- Vor Upload: Bestätigungs-Dialog mit Bytes + Build-Dauer, damit der User weiß was passiert.
- Auto-Download nur wenn lokal leer UND Manifest-Kompat passt — sonst manuell triggern lassen.
- Modell-/Dim-Mismatch: explizit anzeigen mit „Build mit anderem Modell, kann nicht geladen werden" + Option zum lokalen Rebuild.

## Anti-Patterns

- ❌ Direkter `FileSystemWritableFileStream` — umgeht `.tmp`+Rename und kann bei Crash mid-write korrumpieren (CLAUDE.md Pitfall #10).
- ❌ Sidecar als Source of Truth ohne IDB-Cache — wenn der Share offline ist, ist das Plugin tot. Sidecar ist Mirror, nicht Master.
- ❌ JSON-Datei für > 5 MB Daten — JSON-Parse blockt den Main-Thread. Lieber `.bin` mit eigenem Format und schmales JSON-Manifest daneben.
- ❌ Pfad-Konstanten verstreuen — pro Sidecar genau ein Export, im Plugin-Service definiert.

## Verifikation

- `npm run typecheck` grün
- Manueller Smoke (DEV-Build):
  1. Sidecar lokal erzeugen → Upload-Aktion triggern → Datei landet im Share
  2. IDB-Cache löschen (Dev-Tools) → App-Reload → Sidecar wird vom Share geladen, kein neuer Build
  3. Mismatch simulieren (lokales Modell wechseln, dann laden) → blockierende UI-Meldung erscheint, kein Crash
- Audit-Log prüfen: `_intern/audit-log.jsonl` enthält `*_uploaded` / `*_downloaded` Events
