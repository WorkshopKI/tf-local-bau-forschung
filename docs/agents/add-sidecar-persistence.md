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

---

## CLAUDE.md-Pitfalls (Detail)

### Pitfall #10 — Infrastructure-Writes über `atomicWrite()` / `appendToFile()`

Direkter `FileSystemWritableFileStream` umgeht die `.tmp`+Rename+`.backup`-Rotation und kann bei Crash korrumpieren. Alle Infrastructure-Writes (Phase 1a) müssen `atomicWrite()` / `appendToFile()` verwenden — Detail im Abschnitt „Schreiben via `atomicWrite()`" oben. **Dokumentierte Ausnahme**: [src/phase2/triage/run-log.ts](../../src/phase2/triage/run-log.ts) schreibt bewusst per `createWritable({ keepExistingData: true })` direkt (O(n)-Append wäre bei 13k+ Anträgen prohibitiv; Risk-Profil per Run-spezifischer JSONL akzeptabel, siehe Datei-Kommentar).

### Pitfall #23 — Sidecar-Schreib-Profil bewusst wählen

Vier Profile (kombiniert mit #10), je nach Datei-Charakter:
- **Idempotent-overwrite** (Standard, Single-Source-of-Truth): `atomicWrite()` mit Backup-Rotation. Beispiel: `_intern/auslastung.json`, `_intern/feedback/feedback.json`.
- **Append-only** (immutable History, Order matters): `appendToFile()` ohne Rotation, mit `version`-Feld im Schema. Beispiel: `_intern/audit-log.jsonl`, `_intern/auslastung-kuerzel-map.json` (Pitfall #18 erzwingt diese Append-Semantik).
- **Atomic ohne Backup** (große Binär-Files, Recovery via Re-Build): `atomicWrite(..., { skipBackup: true })`. Beispiel: `_intern/auslastung-embedding-corpus.bin` (~40 MB; Backup-Rotation würde die Share-Quota fluten).
- **Rotierend mit Archiv** (wachsende Historie, die beim Start vollständig gelesen wird): die jüngsten *n* Einträge bleiben in der Hauptdatei, ältere wandern in eine Nachbardatei. Beispiel: `_intern/status-katalog.json` + `-archiv.json` (v2.414, `katalog-rotation.ts`). Drei Regeln, sonst wird daraus eine Löschfunktion:
  1. **Rotieren beim SCHREIBEN**, nie beim Lesen — der Schreiber serialisiert den vollen lokalen Stand, ein Filter anderswo würde vom nächsten Client überschrieben.
  2. **Archiv zuerst, Hauptdatei danach.** Es gibt keine Transaktion über zwei Dateien: lässt sich das Archiv nicht schreiben, wird **gar nicht** rotiert. Lieber eine große Datei als ein verlorener Eintrag.
  3. **Ein Lesepfad ins Archiv muss bleiben.** Ein frisch aufgesetzter Rechner kennt nur die Hauptdatei; ohne diesen Weg wäre der ausgelagerte Teil unerreichbar — und genau dafür gab es die Historie.

Entscheidung beim Anlegen einer neuen Sidecar als Header-Kommentar in der Datei festhalten.

### Wer nach dem Lesen SCHREIBT, nimmt `readTextLage` (v4.12)

Die Profile oben sagen, WIE geschrieben wird. Diese Regel sagt, **wann gar nicht**.

`readText` bildet jeden Fehler auf `null` ab — „Datei gibt es nicht" und „Datei ist da,
ließ sich aber nicht lesen" sind danach nicht mehr zu unterscheiden. Fast jede Sidecar
wird read-modify-write fortgeschrieben: lesen, ergänzen, **die ganze Datei** neu
schreiben. Wer `null` als „also leer" nimmt, schreibt genau das zurück — und löscht,
was er nie gesehen hat. Vier Stellen taten das (v4.12): Team-Feedback, die append-only
Kürzel-Map (Pitfall #18), die MA-Zugänge und das Katalog-Archiv.

```ts
// Schreibender Pfad: Lage lesen, bei `unlesbar` abbrechen.
const lage = await readTextLage(handle, PFAD);          // atomic-write.ts
if (lage.status === 'unlesbar') return;                 // NICHT schreiben
const bestand = lage.status === 'ok' ? parse(lage.text) : leererAnfangsstand();
```

- `leer` = legitimer Anfangszustand (Datei/Ordner fehlt) → darauf darf man aufbauen.
- `unlesbar` = jeder andere Fehler, **plus** kaputtes JSON und verfehlte Strukturprüfung.
  Die Datei ist da, ihr Inhalt taugt nur gerade nicht — daraus einen Neuanfang
  abzuleiten ist derselbe Verlust.
- Rein LESENDE Aufrufer, die mit „nichts" leben können, nehmen weiter `readText`.

Fertige Lage-Leser: `readTextLage` ([atomic-write.ts](../../src/core/services/infrastructure/atomic-write.ts)),
`leseSidecarLage` ([sidecar-datei.ts](../../src/core/status/sidecar-datei.ts), Status-Sidecars),
`readSharedFileLage` ([feedbackSharedFile.ts](../../src/core/services/feedback/feedbackSharedFile.ts), Feedback),
`loadKuerzelMapLage`, `loadZugangLage`.

**Schwester-Regel: nichts löschen, was man nicht gesichert hat.** Ein Aufräumer im
Fehlerpfad muss belegen, dass er etwas verhindert. Der Snapshot-Publish löschte die
bereits geschriebenen Dateien „damit kein halb-konsistenter Stand stehen bleibt" —
verhindert hat das nichts (das Manifest ist der einzige Marker und wird zuletzt
geschrieben), gekostet hat es `antraege.jsonl`, die einzige Datei ohne `.backup`.

**Und die Reihenfolge davon: den Ersatz fertig haben, bevor man das Alte wegnimmt.**
`atomicWrite` selbst verstieß bis v6.27.1 dagegen — es benannte das Ziel zur `.backup`
um und schrieb erst danach das `.tmp`. Dazwischen existierte die Datei nicht, bei
`atomicWriteStream` für die Dauer des ganzen `produce`-Laufs; jeder Abbruch darin
ließ nur die `.backup` zurück (belegt an `_intern/skills/registry.json`). Seit v6.27.1
wird zuerst geschrieben, dann rotiert, und ein gescheiterter Einwechsel wird
zurückgedreht. Wer eine eigene Schreib-Sequenz baut, ordnet sie genauso: **erst
erzeugen, dann tauschen.**
