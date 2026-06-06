# Wiederkehrende Bug-Klassen

Vier Fehler-Muster, die in diesem Projekt **mehrfach** aufgetreten sind und an denen Coding-Agents real scheitern. Vor dem Bauen neuer Lade-/Persist-/Permission-Pfade die zur Aufgabe passende Klasse überfliegen — das verhindert die häufigsten Regressions.

> Diese Datei ist die **Single Source of Truth** für diese Muster. CLAUDE.md → Decision-Tree und einige Pitfalls verweisen hierher.

---

## 1. Cold-Start-Store-Refresh (häufigste Klasse)

**Symptom:** Nach „clear site data" / auf einem neuen Read-Side-Rechner (prod/kurator/pl) zeigt die UI **leer**, obwohl die Daten auf dem Share liegen — **erst ein manueller Browser-Reload** füllt die Anzeige. Täuscht „Share leer / keine Daten" vor.

**Root-Cause:** Der Share-Sync / Import schreibt korrekt in die **IndexedDB**, aber der **In-Memory-Zustand** wird nicht aktualisiert. Vier Mechanismen (alle real aufgetreten):

1. **Post-Sync-Refresh verfehlt den Race** — die „Store nach Sync neu laden"-Funktion bricht ab, wenn `programmId` noch `null` ist (Default-Programm wird erst lazy beim ersten `loadAll` gesetzt). → Auch bei leerem/`null`-Store reloaden.
2. **`loaded`/TTL-Flag bei leerem Erst-Load „geschärft"** → blockiert den Re-Read, obwohl die IDB inzwischen voll ist. → Flag/`lastLoadedAt` nur setzen, wenn wirklich Daten geladen wurden bzw. der Share lesbar war (`isDatenShareReadable`, [smb-handle.ts](../../src/core/services/infrastructure/smb-handle.ts)).
3. **Watcher-„Jetzt laden" wird stiller No-Op** — `syncProgrammSnapshot` liefert `synced:false`, weil ein Startup-Sync `SYNC_VERSION_KEY` schon konsumiert hat. → Bei `synced:false` + leerem Store trotzdem aus der IDB nachladen.
4. **Sekundär-Projektion nicht mitgeschrieben (heimtückischste Variante)** — Home/Listen lesen NICHT den vollen `ANTRAEGE`-Store, sondern die Slim-Projektion `ANTRAEGE_LIST_VIEW` ([list-view.ts](../../src/core/services/csv/list-view.ts)). `replaceStore` im Snapshot-Sync schrieb nur `ANTRAEGE` → die Projektion blieb leer. Hier hilft KEIN Store-Reload (er liest die leere Projektion). → `rebuildAntraegeListView` nach dem Store-Write.

**Fix-Pattern / Regeln:**
- **Jeder `importCsvSource`-Aufrufer** ruft danach `refreshAntraegeStoreAfterSync(idb, programmId, ['antraege','verbuende'])` ([snapshot-refresh.ts](../../src/plugins/antraege/snapshot-refresh.ts)). Beim Anlegen eines neuen Import-Pfads mitnehmen.
- **Wer `ANTRAEGE` schreibt, MUSS `ANTRAEGE_LIST_VIEW` mitziehen** (der CSV-Merger tut das; `replaceStore` im Snapshot-Sync musste explizit `rebuildAntraegeListView` ergänzen).
- **Konsument hält eigenen `useState`/Ref-Cache statt Zustand-Store?** Dann braucht er ein explizites Re-Read-Signal: einen [Signal-Store](../../src/core/lib/createSignalStore.ts) (`createSignalStore()`), den der Writer bumpt. Beispiel: `bumpAuslastungCorpusSignal()` nach Korpus-IDB-Mutation ([corpus-signal.ts](../../src/plugins/auslastung/services/corpus-signal.ts)). **Nur EXTERNE Mutationen bumpen** — wer den Write selbst auslöst und das Ergebnis direkt erhält, bumpt nicht (sonst Self-Trigger-Loop).

**⚠️ Gefährliche Variante (echter Datenverlust, nicht nur leere Anzeige):** Ein transienter Leer-Read (Datei gerade im `atomicWrite`-`.tmp`-Rename-Fenster eines parallel offenen Tabs) setzt `loaded=true` mit 0 Datensätzen → ein Auto-Persist-Effekt **schreibt die leere Basis zurück** und überschreibt die volle Datei. → Auto-Persist-Effekte (Auto-Collect, Reconcile) **gegen `setupAbgeschlossen` / nicht-leere Basis gaten** — nie auf eine un-eingerichtete Basis schreiben. Verwandt: Klasse 3.

**Beim Debuggen „IDB hat Daten, Store leer":** IMMER prüfen — liest die UI denselben Store, der geschrieben wurde, oder eine Projektion/Index/lokalen Cache? Und: kann ein leerer/transienter Load jemals persistiert werden?

**Kanonische Dateien:** [snapshot-refresh.ts](../../src/plugins/antraege/snapshot-refresh.ts), [store.ts](../../src/plugins/antraege/store.ts), [useSnapshotWatcher.ts](../../src/core/hooks/useSnapshotWatcher.ts), [corpus-signal.ts](../../src/plugins/auslastung/services/corpus-signal.ts), [createSignalStore.ts](../../src/core/lib/createSignalStore.ts).

---

## 2. FSAPI: ein Permission-Prompt pro User-Gesture (`file://`)

**Symptom:** Nach Browser-Neustart fehlen nachgelagerte File-Handles (CSV-Quellen, persönlicher Ordner) — die App startet aber normal, weil der Daten-Share klappt. Wirkt wie „Verknüpfung nach Neustart weg".

**Root-Cause:** Unter `file://` verlieren ALLE FSAPI-Permissions bei jedem Neustart ihre Berechtigung (zurück auf `prompt`). Chromium verbraucht die transiente User-Activation **pro `requestPermission`-Prompt** → im selben Gesture wird nur der **erste** Prompt angezeigt, weitere schlagen still fehl. `refreshAllPermissions` prompted sequenziell (Daten-Share zuerst) → der Daten-Share frisst den einzigen Slot des StartupScreen-Gestures.

**Fix-Pattern:**
- Mehrere Dateien am selben Ort → **EIN `FileSystemDirectoryHandle`**; Directory-Permission **kaskadiert** auf `dirHandle.getFileHandle(name)` → ein Prompt deckt alle ab (Kaskade ist nicht rekursiv: Dateien müssen direkt im Ordner liegen).
- Den Re-Grant in einen **zweiten, sauberen Gesture** legen, in dem der Daten-Share schon granted ist — auf der pl der AppPasswordGate-Login. Dort NUR das gewünschte Handle re-granten (dedizierte Funktion, z.B. `refreshCsvSourceDirPermission`), NICHT `refreshAllPermissions` (sonst stiehlt der persönlich-Handle den Slot).
- **Perf:** Eine Datei in einem Dir-Handle per Inhalt finden (alle Dateien lesen+parsen) ist auf SMB teuer. schemaId→Dateiname **lokal persistieren** (eigener, nicht-synchronisierter IDB-Key — kein Schema-Feld, das der Snapshot überschreibt), danach nur `getFileHandle(name)`.

**Bekannter Rest-Bug (offen):** `SMB_HANDLE_PERSOENLICH` hat auf der pl dieselbe Starvation (bisher ohne sichtbaren Schaden, da IDB-cached). Bei persönlich-Schreibfehlern nach Neustart: gleiche Klasse, gleiche Lösung.

**⚠️ Dev reproduziert das oft NICHT** — Dev seedet CSV-Quellen aus Fixture-Blobs (kein echtes Handle in IDB). Handle-Bugs nur auf einem echten `file://`-Build mit real verknüpften Handles testen.

**Kanonische Datei:** [smb-handle.ts](../../src/core/services/infrastructure/smb-handle.ts) (`refreshAllPermissions`), [AppPasswordGate.tsx](../../src/core/AppPasswordGate.tsx).

---

## 3. Parallele `file://`-Varianten teilen Storage

**Symptom:** Datenverlust/Interferenz, wenn mehrere Builds (`zah-pl.html`, `zah-prod.html`, `zah-kurator.html`, dev) gleichzeitig als Tabs offen sind. Konkret (Juni 2026): pl+prod+kurator parallel, Shift+Reload auf pl → `auslastung.json` von 263 KB auf 7 KB überschrieben.

**Root-Cause:** Unter `file://` teilen sich in Chrome ALLE Builds **denselben Origin** → **eine** IndexedDB (DB-Name konstant `teamflow`), **einen** SMB-Handle, **ein** Downgrade-Flag.
- **Downgrade-Flag-Vergiftung:** Nur-Lese-Rollen (prod / kurator-vor-Login) setzen das geteilte `needs-handle-downgrade`-Flag; ein pl-Tab stufte sich grundlos auf `read` herunter → stille `NotAllowedError`-Writes. (Entschärft: Schreib-Rollen ignorieren das Flag und löschen ein fremd-gesetztes, siehe Pitfall #25.)
- **atomicWrite-Race:** während `rename→.backup / write .tmp / rename→Ziel` existiert die Zieldatei kurz nicht; liest ein anderer Tab genau dann → „leer" → Cold-Start-Clobber (Klasse 1, gefährliche Variante).

**Operative Regel (an Nutzer kommunizieren):** Nicht mehrere Varianten gleichzeitig aus `file://` öffnen — eine Variante pro Browser zur Zeit, oder getrennte Browser-Profile. Cross-Tab-Koordination ist nicht möglich (BroadcastChannel unter `file://` verboten, Last-Write-Wins ohne Lock). Zwei **pl**-Tabs sind nur fürs Auslastungs-Modul via localStorage-Ping abgesichert ([cross-tab.ts](../../src/plugins/auslastung/services/cross-tab.ts)).

**Beim Bauen:** Neue Stores, die auf den Share schreiben, sind bei parallel offenen Varianten ungeschützt — Cross-Variant-Sync gibt es nur fürs Auslastungs-Modul. Schreibfehler sichtbar machen statt still schlucken.

---

## 4. Embedding-Caches sind machine-lokal

**Symptom:** „Auf neuem PL-Rechner keine automatische Klassifizierung / Kompetenz nicht verknüpft."

**Root-Cause:** Die Embedding-Vektoren des Auslastungs-Moduls (`auslastung-emb:*` per-Antrag, `auslastung-emb-verbund:*` Verbund) liegen **maschine-lokal in der Browser-IndexedDB** — pro Rechner separat, NICHT auf dem zentralen Share. Ein neuer Rechner liest `auslastung.json` + Kürzel-Map vom Share, hat aber leere IDB-Caches.

**Fix-Pattern:** Neue Auslastungs-Caches IMMER „download-if-empty"/Mirror-fähig bauen (Vorbild: [corpus-share-sync.ts](../../src/plugins/auslastung/services/corpus-share-sync.ts)). Nie annehmen, dass IDB-State über Rechner „mitkommt". Bei „auf neuem Rechner geht X nicht": zuerst prüfen, ob X von maschine-lokalem IDB-State abhängt, der nicht aus dem Share rekonstruiert wird.

**Querverweis:** Ein Embedding-**Modell-Wechsel** macht alle gespiegelten Korpora team-weit inkompatibel (CLAUDE.md Pitfall #19).

## 5. Stumme Feature-Deaktivierung bei abweichendem CSV-Mapping

**Symptom:** „Feature X (z.B. der „Unvollständig"-Filter / D_XTEC-Vollständigkeits-Sperre) tut nichts — keine Fehlermeldung, einfach leer." Tritt erst beim echten Kunden-Datensatz auf, nicht in Dev/Fixtures.

**Root-Cause:** Code liest einen **fest verdrahteten kanonischen Feld-Key** (`antrag.d_xtec`) und nimmt an, dass die CSV-Spalte dorthin gemappt wurde. Der Kurator kann eine Spalte aber auch als **Eigenes Feld** mappen → der Wert landet unter einem anderen Key (z.B. `alle_antrage_in_c16_eingegeben`, aus der Spalten-Beschreibung abgeleitet). Das kanonische Feld bleibt leer → ein „ist irgendwo befüllt?"-Gate schaltet **still ab** → das Feature läuft ins Leere, ohne Fehler. (Konkreter Fall: v2.40 — D_XTEC/D_ADV als Eigene Felder gemappt → `d_xtec`/`d_adv` bei allen 13.953 Anträgen leer.)

**Fix-Pattern (zwei Ebenen):**
1. **Feld über das Schema auflösen, nicht fest verdrahten.** Den tatsächlichen Antrag-Feld-Key aus der `column_mapping` per **Spalten-CODE** ermitteln (`resolveFieldKey`: canonical → custom → lowercase), egal ob Standard- oder Eigenes Feld. Vorbild: [vollstaendigkeit-felder.ts](../../src/plugins/auslastung/services/vollstaendigkeit-felder.ts) + [useVollstaendigkeitsFelder.ts](../../src/plugins/auslastung/hooks/useVollstaendigkeitsFelder.ts). Fallback auf den kanonischen Default, wenn die Spalte fehlt.
2. **Stummen Off-Zustand sichtbar machen.** Wenn ein Gate, das Daten erwartet, „aus" ist, obwohl die Quelle es gemappt hat → einen **UI-Hinweis** zeigen statt still nichts zu tun (Vorbild: „Vollständigkeits-Prüfung inaktiv"-Banner in [KlassifizierungsReview.tsx](../../src/plugins/auslastung/views/KlassifizierungsReview.tsx)). Die Faustregel: ein datengetriebenes Feature, das bei Fehlkonfiguration **leise** nichts tut, ist gefährlicher als eines, das laut warnt.

**Warnsignal beim Entwickeln:** Sobald Code `antrag['<canonical_key>']` direkt liest UND daraus ein „ist-vorhanden"-Gate ableitet, prüfen: Was passiert, wenn der Kurator diese Spalte als Eigenes Feld (oder gar nicht) mappt? Greift dann ein sichtbarer Hinweis, oder verschwindet das Feature lautlos?
