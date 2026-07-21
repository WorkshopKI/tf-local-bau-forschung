# Wiederkehrende Bug-Klassen

Elf Fehler-Muster, die in diesem Projekt **mehrfach** aufgetreten sind und an denen Coding-Agents real scheitern. Vor dem Bauen neuer Lade-/Persist-/Permission-/Modal-/Transport-Pfade die zur Aufgabe passende Klasse überfliegen — das verhindert die häufigsten Regressions.

> Diese Datei ist die **Single Source of Truth** für diese Muster. CLAUDE.md → Decision-Tree und einige Pitfalls verweisen hierher.

---

## 1. Cold-Start-Store-Refresh (häufigste Klasse)

**Symptom:** Nach „clear site data" / auf einem neuen Read-Side-Rechner (prod/kurator/pl) zeigt die UI **leer**, obwohl die Daten auf dem Share liegen — **erst ein manueller Browser-Reload** füllt die Anzeige. Täuscht „Share leer / keine Daten" vor.

**Root-Cause:** Der Share-Sync / Import schreibt korrekt in die **IndexedDB**, aber der **In-Memory-Zustand** wird nicht aktualisiert. Vier Mechanismen (alle real aufgetreten):

1. **Post-Sync-Refresh verfehlt den Race** — die „Store nach Sync neu laden"-Funktion bricht ab, wenn `programmId` noch `null` ist (Default-Programm wird erst lazy beim ersten `loadAll` gesetzt). → Auch bei leerem/`null`-Store reloaden.
2. **`loaded`/TTL-Flag bei leerem Erst-Load „geschärft"** → blockiert den Re-Read, obwohl die IDB inzwischen voll ist. → Flag/`lastLoadedAt` nur setzen, wenn wirklich Daten geladen wurden bzw. der Share lesbar war (`isDatenShareReadable`, [smb-handle.ts](../../src/core/services/infrastructure/smb-handle.ts)). **Jeder Share-gestützte `load()`-Store braucht dieses Gate** — der Plugin-`onInit` lädt VOR dem StartupScreen-Grant, der Loader liefert dann still Leer-Daten. Bekannte Instanzen: `useAuslastungData.load` (v2.19.2) **und** `useKuerzelMap.load` (v2.47.1, [useKuerzelMap.ts](../../src/plugins/auslastung/hooks/useKuerzelMap.ts) — leere `anonymMap` → leere `historischeDeskriptorenByAnon` → [matching-engine.ts:189](../../src/plugins/auslastung/services/matching-engine.ts) skippt jeden nicht-onboarded MA → „Anträge zuweisen" zeigt keine Match-MAs bis Reload). Beim Einführen eines neuen Share-Stores mitnehmen.
3. **Watcher-„Jetzt laden" wird stiller No-Op** — `syncProgrammSnapshot` liefert `synced:false`, weil ein Startup-Sync `SYNC_VERSION_KEY` schon konsumiert hat. → Bei `synced:false` + leerem Store trotzdem aus der IDB nachladen.
4. **Sekundär-Projektion nicht mitgeschrieben (heimtückischste Variante)** — Home/Listen lesen NICHT den vollen `ANTRAEGE`-Store, sondern die Slim-Projektion `ANTRAEGE_LIST_VIEW` ([list-view.ts](../../src/core/services/csv/list-view.ts)). `replaceStore` im Snapshot-Sync schrieb nur `ANTRAEGE` → die Projektion blieb leer. Hier hilft KEIN Store-Reload (er liest die leere Projektion). → `rebuildAntraegeListView` nach dem Store-Write.

**Fix-Pattern / Regeln:**
- **Jeder `importCsvSource`-Aufrufer** ruft danach `refreshAntraegeStoreAfterSync(idb, programmId, ['antraege','verbuende'])` ([snapshot-refresh.ts](../../src/plugins/antraege/snapshot-refresh.ts)). Beim Anlegen eines neuen Import-Pfads mitnehmen.
- **Wer `ANTRAEGE` schreibt, MUSS `ANTRAEGE_LIST_VIEW` mitziehen** (der CSV-Merger tut das; `replaceStore` im Snapshot-Sync musste explizit `rebuildAntraegeListView` ergänzen).
- **Konsument hält eigenen `useState`/Ref-Cache statt Zustand-Store?** Dann braucht er ein explizites Re-Read-Signal: einen [Signal-Store](../../src/core/lib/createSignalStore.ts) (`createSignalStore()`), den der Writer bumpt. Beispiel: `bumpAuslastungCorpusSignal()` nach Korpus-IDB-Mutation ([corpus-signal.ts](../../src/plugins/auslastung/services/corpus-signal.ts)). **Nur EXTERNE Mutationen bumpen** — wer den Write selbst auslöst und das Ergebnis direkt erhält, bumpt nicht (sonst Self-Trigger-Loop).

**Maschinell erzwungen** durch die Convention-Tests `import-requires-store-refresh` (jede `importCsvSource(`-Datei referenziert `refreshAntraegeStoreAfterSync`) und `antraege-write-requires-listview-rebuild` (jede `replaceStore(`-Datei referenziert `rebuildAntraegeListView`) in [codebase-conventions.test.ts](../../src/__tests__/codebase-conventions.test.ts) (Ausnahme: `// allow-import-no-refresh:` bzw. `// allow-antraege-write-no-listview: <grund>`).

**⚠️ Gefährliche Variante (echter Datenverlust, nicht nur leere Anzeige):** Ein transienter Leer-Read (Datei gerade im `atomicWrite`-`.tmp`-Rename-Fenster eines parallel offenen Tabs) setzt `loaded=true` mit 0 Datensätzen → ein Auto-Persist-Effekt **schreibt die leere Basis zurück** und überschreibt die volle Datei. → Auto-Persist-Effekte (Auto-Collect, Reconcile) **gegen `setupAbgeschlossen` / nicht-leere Basis gaten** — nie auf eine un-eingerichtete Basis schreiben. Verwandt: Klasse 3.

**Beim Debuggen „IDB hat Daten, Store leer":** IMMER prüfen — liest die UI denselben Store, der geschrieben wurde, oder eine Projektion/Index/lokalen Cache? Und: kann ein leerer/transienter Load jemals persistiert werden?

**Kanonische Dateien:** [snapshot-refresh.ts](../../src/plugins/antraege/snapshot-refresh.ts), [store.ts](../../src/plugins/antraege/store.ts), [useSnapshotWatcher.ts](../../src/core/hooks/useSnapshotWatcher.ts), [corpus-signal.ts](../../src/plugins/auslastung/services/corpus-signal.ts), [createSignalStore.ts](../../src/core/lib/createSignalStore.ts).

---

## 2. FSAPI: ein Permission-Prompt pro User-Gesture (`file://`)

**Symptom:** Nach Browser-Neustart fehlen nachgelagerte File-Handles (CSV-Quellen, persönlicher Ordner) — die App startet aber normal, weil der Daten-Share klappt. Wirkt wie „Verknüpfung nach Neustart weg".

**Root-Cause:** Unter `file://` verlieren ALLE FSAPI-Permissions bei jedem Neustart ihre Berechtigung (zurück auf `prompt`). Chromium verbraucht die transiente User-Activation **pro `requestPermission`-Prompt** → im selben Gesture wird nur der **erste** Prompt angezeigt, weitere schlagen still fehl. `refreshAllPermissions` prompted sequenziell (Daten-Share zuerst) → der Daten-Share frisst den einzigen Slot des StartupScreen-Gestures.

**⚠️ Browser-abhängig (Korrektur v2.59.2):** Das obige „ein Prompt pro Gesture / nicht kombinierbar" ist das **Worst-Case**-Modell und gilt NICHT überall. Manche Chromium-Browser haben **persistente FSAPI-Permissions** + einen **konsolidierten „Wiederherstellen"-Prompt**: ruft die App `requestPermission()` auf einen früher gewährten Handle, bündelt der Browser ALLE gespeicherten Handles des Origins in EINE Box, und „Bei jedem Besuch zulassen" macht die Freigabe persistent (kein Re-Prompt nach Neustart). **Empirisch (Juni 2026):** in **Edge** beobachtet; in **Chrome unter `file://` NICHT** (bis v149, auch am Folgetag ohne clear-site-data kein Sammel-Dialog) — das Feature ist offenbar kontext-/secure-context-/engagement-gated, und `file://` ist ein Sonderfall, in dem die Browser divergieren. Die App kann es **nicht erzwingen**. Konsequenz für den Code: nichts annehmen — der Guided-Stepper bleibt der **robuste Fallback** (Schritt-für-Schritt, ein Prompt je Ordner, z.B. Chrome/`file://`) und **kollabiert** dort, wo der Browser per Sammel-Box mehrere auf einmal gewährt (Edge).

**Fix-Pattern:**
- Mehrere Dateien am selben Ort → **EIN `FileSystemDirectoryHandle`**; Directory-Permission **kaskadiert** auf `dirHandle.getFileHandle(name)` → ein Prompt deckt alle ab (Kaskade ist nicht rekursiv: Dateien müssen direkt im Ordner liegen).
- Den Re-Grant in einen **zweiten, sauberen Gesture** legen, in dem der Daten-Share schon granted ist — auf der pl der AppPasswordGate-Login. Dort NUR das gewünschte Handle re-granten (dedizierte Funktion, z.B. `refreshCsvSourceDirPermission`), NICHT `refreshAllPermissions` (sonst stiehlt der persönlich-Handle den Slot). *(v2.61.2 überholt für pl: die AppPasswordGate läuft jetzt VOR dem Stepper und macht für pl keine Permission-Arbeit mehr — der Guided-Stepper gibt nach dem Login alle Handles frei. Das Muster bleibt gültig für jeden anderen „zweiter sauberer Gesture"-Fall.)*
- **Generalisierung (v2.55): Guided-Grant-Stepper.** Wenn N verschiedene Roots (verschiedene Pfade, keine gemeinsame Kaskade) re-granted werden müssen, ist „eine Freigabe pro Klick" der robuste Weg: beim Mount non-invasiv `queryPermission` (kein Gesture) → `listPendingGrants` liefert die ungranted Handles → der StartupScreen rendert pro Handle EINEN Klick-Schritt ([GuidedGrantSteps.tsx](../../src/core/components/GuidedGrantSteps.tsx)). Jeder Klick = ein `requestPermission` = ein zuverlässiger Prompt. Sind alle granted → ohne Klick weiter (Warm-Start). Reihenfolge/Modi exakt wie `refreshAllPermissions` (Pitfall #25: Mode nur über `canWriteDatenShare`). **v2.59.2:** nach jedem Grant per `rescan` (= `listPendingGrants`) neu prüfen — gewährt ein konsolidierter Browser-Prompt mehrere Handles auf einmal, markiert `resolveAfterGrant` ([guided-grant-progress.ts](../../src/core/components/guided-grant-progress.ts)) alle nun gewährten Slots als erledigt und der Stepper schließt sofort ab (kein überflüssiger Folge-Schritt).
- **Ergonomie des Steppers (v2.275) — zwei Zusätze, die die Gesture-Regel NICHT aufweichen.** (a) **Position:** das Permission-Popup erscheint OBEN am Viewport, eine zentrierte Karte erzwingt pro Ordner den halben Bildschirm Mausweg. Der Stepper-Zweig des [StartupScreen.tsx](../../src/core/StartupScreen.tsx) rendert deshalb `items-start pt-[210px]` (fixer px-Wert — die Bubble ist ~200px hoch und skaliert nicht mit dem Fenster) statt `items-center`; `overflow-y-auto` ist Pflicht, sonst ist die Karte auf niedrigen Viewports unerreichbar. (b) **Auto-Fokus ab Schritt 2:** der Freigabe-Button bekommt nach jedem Grant den Fokus → der User klickt „Zulassen" und drückt danach Enter (vollwertige Geste, prompted zuverlässig), ohne die Maus zurückzuführen. Bewusst erst ab Schritt 2, damit ein noch gedrückter Enter aus dem vorgelagerten Login-Gate den ersten Schritt nicht auslöst.
- **Optimistische Auto-Kette — bucht ausschliesslich Erfolge (v2.276.0).** Nach einem `granted` probiert der Stepper den nächsten Slot sofort, statt auf den Klick zu warten; das zahlt sich in Browsern mit gebündelten Permissions aus und ist in Chrome/`file://` folgenlos. Die Kette läuft dabei **ohne eigene User-Geste** — ob der Browser überhaupt einen Dialog gezeigt hat, ist von aussen **nicht feststellbar**. Deshalb ruft sie `resolveAfterGrant` mit `attemptedSlot = null` auf: nur gewährte Slots werden gebucht, **nie** eine Ablehnung. Bleibt ein Ordner ungewährt, ist er einfach der nächste reguläre Klick-Schritt. Nur der **erste** Grant pro Klick (echte Geste) darf `denied` buchen.
  **⚠️ Anti-Pattern, in v2.275.0 verbaut und in v2.276.0 entfernt:** „kein Dialog" vs. „abgelehnt" über eine **Dauer-Schwelle** (< 300 ms = kein Dialog) zu trennen. Wall-Clock taugt dafür nicht — in virtualisierten Umgebungen (Citrix) wird der Renderer unter Last hunderte Millisekunden weggeplant, die Messung läuft über ein `await` und bläht sich auf. Kippt die Schwelle, wird ein nie gezeigter Dialog als Ablehnung gebucht und der **Persönliche Ordner still übersprungen**. Entscheidungslogik pure + unit-getestet in [guided-grant-progress.ts](../../src/core/components/guided-grant-progress.ts).
- **⚠️ Auto-Skip-Pfade MÜSSEN den ConnectionState trotzdem setzen (v2.56.1-Regression).** Der „alle granted → ohne Klick weiter"-Zweig darf NICHT bloß `onReady()` rufen — er muss `applyRefreshResult(await queryAllPermissions(...))` fahren. Sonst bleibt `useConnectionState.mode` auf INITIAL `'offline'` ([connection-status.ts](../../src/core/services/connection-status.ts)) und der OfflineBanner erscheint beim Reload, obwohl der Daten-Share erreichbar ist (der Visibility-Probe feuert nur bei `visibilitychange`, nicht beim geraden Reload). Gemeinsamer `finishStartup`-Helfer für Warm-Start UND Stepper-Ende.
- **Perf:** Eine Datei in einem Dir-Handle per Inhalt finden (alle Dateien lesen+parsen) ist auf SMB teuer. schemaId→Dateiname **lokal persistieren** (eigener, nicht-synchronisierter IDB-Key — kein Schema-Feld, das der Snapshot überschreibt), danach nur `getFileHandle(name)`.

**Rest-Bug `SMB_HANDLE_PERSOENLICH` — behoben in v2.55:** Der persönliche Ordner verhungerte bis v2.54 im StartupScreen-Gesture (Daten-Share fraß den Slot) und promptete deshalb zu einem zufälligen späteren Zeitpunkt. Seit dem Guided-Grant-Stepper ist er ein eigener Klick-Schritt → eigener Gesture → zuverlässiger Prompt in fester Reihenfolge (Daten-Share → persönlich → CSV-Quelle). Die kurator-**Post-Login-Eskalation** (`refreshAllPermissions({isKurator:true})` im AppPasswordGate) hat dieselbe Multi-Prompt-Starvation für User-Folders-Root + DMS-Sources noch ungelöst (vorbestehend, nicht pl-relevant) — bei Bedarf denselben Stepper-Ansatz anwenden.

**⚠️ Auto-Load/Timer-Pfade nie ohne `queryPermission`-Vorabcheck (v2.59.4):** Ein Hintergrund-Loader (Mount-Effekt, `setInterval`) darf ein gespeichertes Dir-Handle NICHT blind iterieren/lesen — ohne User-Gesture kann er die verfallene Permission nicht via `requestPermission` erneuern, und schon `dirHandle.values()` wirft dann `NotAllowedError` („The request is not allowed by the user agent or the platform in the current context"). Muster: erst `queryPermission` (non-invasiv); ist sie ≠ `granted` → einen **Re-Grant-Button** (Gesture) anbieten statt zu crashen. Konkreter Fall: der Online-Tab auf dem User-Folders-Root ([OnlineTab.tsx](../../src/plugins/einstellungen/OnlineTab.tsx), Helfer `queryUserFoldersRootPermission`/`refreshUserFoldersRootPermission`). Beachte: ein gespeichertes Handle, das in IDB existiert, sagt NICHTS über die aktuelle Permission — „existiert" (→ kein Picker) und „granted" (→ lesbar) sind getrennt zu prüfen.

**⚠️ Dev reproduziert das oft NICHT** — Dev seedet CSV-Quellen aus Fixture-Blobs (kein echtes Handle in IDB → Stepper-Scan = leer → Auto-Skip). Handle-Bugs nur auf einem echten `file://`-Build mit real verknüpften Handles testen.

**Kanonische Datei:** [smb-handle.ts](../../src/core/services/infrastructure/smb-handle.ts) (`refreshAllPermissions`, `listPendingGrants`, `queryAllPermissions`, `grantPending`), [GuidedGrantSteps.tsx](../../src/core/components/GuidedGrantSteps.tsx), [StartupScreen.tsx](../../src/core/StartupScreen.tsx), [AppPasswordGate.tsx](../../src/core/AppPasswordGate.tsx).

---

## 3. Parallele `file://`-Varianten teilen Storage

**Symptom (historisch):** Datenverlust/Interferenz, wenn mehrere Builds (`zah-pl.html`, `zah-prod.html`, `zah-kurator.html`, dev) gleichzeitig als Tabs offen waren. Konkret (Juni 2026): pl+prod+kurator parallel, Shift+Reload auf pl → `auslastung.json` von 263 KB auf 7 KB überschrieben.

**Strukturelle Wurzel — die geteilte IndexedDB — ist seit v2.87 behoben.** Unter `file://` teilen alle Builds zwar weiterhin **denselben Origin**, aber der **IDB-Name ist jetzt pro Variante suffigiert** (`teamflow-<outputFilename>` via `getVariantDbName()`, siehe [data-layout.md](data-layout.md)). Damit hat jede Variante ihre **eigene** DB — der frühere „eine geteilte `teamflow`-DB für alle"-Zustand existiert nicht mehr. Konsequenzen:
- **Downgrade-Flag-Vergiftung — strukturell ausgeschlossen.** Das `needs-handle-downgrade`-Flag ist ein IDB-Key; per-Variante-DB heißt: prod kann pl/kurator nicht mehr vergiften. (Der `writeRole`-Guard in `App.tsx` bleibt als Defense-in-Depth, Pitfall #25.)
- **Shared-IDB-Clobber (antraege/kv) — weg.** Ein Varianten-**Wechsel** (sequenziell: eine schließen, andere öffnen) ist jetzt sicher; die neue Variant-DB startet leer und lädt frisch aus dem Share (= wie der tägliche Refresh).

**Residual — was NICHT pro Variante getrennt ist (gilt nur bei GLEICHZEITIG offenen Varianten):**
- **Share-Dateien + atomicWrite-Race:** Der SMB-Share + persönliche Ordner sind physisch dieselben Dateien für alle Varianten. Während `rename→.backup / write .tmp / rename→Ziel` existiert die Zieldatei kurz nicht; lesen zwei *gleichzeitig schreibende* Varianten-Tabs genau dann → „leer" → Cold-Start-Clobber (Klasse 1). Die IDB-Trennung adressiert das **nicht**.
- **localStorage** (origin-weit) bleibt geteilt — betrifft aber nur kleine UI-Flags/Prefs (kein Datenverlust-Vektor).

**Operative Regel (entschärft):** Varianten-**Wechsel** auf einem Rechner ist unkritisch. Nur **nicht zwei Varianten gleichzeitig offen lassen, die beide auf dieselben Share-Dateien schreiben** (z.B. pl + kurator parallel mit Auslastungs-Writes). Cross-Tab-Koordination über Varianten gibt es nicht (BroadcastChannel unter `file://` verboten, Last-Write-Wins ohne Lock). Zwei **pl**-Tabs sind nur fürs Auslastungs-Modul via localStorage-Ping abgesichert ([cross-tab.ts](../../src/plugins/auslastung/services/cross-tab.ts)).

**Beim Bauen:** Neue Stores, die auf den **Share** schreiben, sind bei parallel offenen Varianten weiterhin ungeschützt — Cross-Variant-Sync gibt es nur fürs Auslastungs-Modul. Schreibfehler sichtbar machen statt still schlucken.

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

**Maschinell erzwungen** durch den Convention-Test `no-hardcoded-canonical-field` in [codebase-conventions.test.ts](../../src/__tests__/codebase-conventions.test.ts): direkter `.d_xtec`/`.d_adv`-Lesezugriff ausserhalb des Resolver-Moduls ([vollstaendigkeit-felder.ts](../../src/plugins/auslastung/services/vollstaendigkeit-felder.ts)) ist verboten (Ausnahme: `// allow-canonical-field: <grund>`).

## 6. Tracking-Baseline nach dem Snapshot geschrieben (Snapshot-only-Leser sehen veralteten Stand)

**Symptom:** Auf Snapshot-only-Konsumenten (pl-Variante / nach „clear site data" / neuer Rechner) erscheint ein „hat sich geändert"-Banner (Auto-Refresh „CSV-Quelle hat neue Daten", „Neuer Datenbestand") bei **jedem** frischen Start, obwohl sich nichts geändert hat. Der schreibende Client (Kurator) sieht es **nie**. Klick auf „Aktualisieren" hilft nur bis zum nächsten clear-site-data.

**Root-Cause:** Ein Feld, das als Vergleichs-Baseline einer „hat sich was geändert?"-Erkennung dient (z.B. `source_last_modified`, oder die `snapshot-version`/`store-hash`-Sync-Keys), wird **nach** dem Schreiben des team-geteilten Artefakts (Snapshot) persistiert — nur in die **lokale IDB** des Schreibers. Das publizierte Artefakt trägt damit den **vorherigen oder leeren** Baseline. Der Schreiber vergleicht gegen seine frische lokale IDB → kein Banner; jeder, der NUR aus dem Snapshot liest, liest den veralteten Baseline → Dauer-Fehlalarm (bei `undefined` unbedingt). Zweimal aufgetreten: `b353ac2` (Sync-Tracking-Keys nach `writeProgrammSnapshot` nicht gesetzt) und v2.40.3 (`source_last_modified` post-import via `persist*` statt vor dem Snapshot in `importCsvSource` gestempelt).

**Fix-Pattern:** Die Baseline, die ein geteiltes Artefakt tragen muss, **vor** dem Schreiben des Artefakts in genau den Zustand stempeln, den das Artefakt serialisiert — nicht in einem nachgelagerten `persist*`-Schritt. Positiv-Vorbild im selben Code: `file_checksum` wird in [importer.ts](../../src/core/services/csv/importer.ts) korrekt auf `updatedSchema` **vor** `saveSchema`/`writeProgrammSnapshot` gesetzt; `source_last_modified` machte es falsch (Fix: gleiche Stelle, guarded `instanceof File`). Beim Bauen eines neuen „hat sich was geändert?"-Checks, dessen Baseline team-weit via Snapshot/Sidecar reist: sicherstellen, dass der Publish-Pfad die Baseline mit-publiziert (Test: Artefakt serialisieren, Baseline-Feld ≠ `undefined`/stale).

**Leitsatz (robuster als Re-Publish):** Reist eine „hat-sich-geändert?"-Baseline über ein geteiltes Artefakt, vergleiche per **portablem Inhalt** (Hash), nicht per maschinen-lokaler **mtime** (`File.lastModified` ist pro Datei-Kopie/Rechner verschieden, der Inhalts-Hash nicht). v2.40.5: `checkSourceForUpdate` ([csv-source-handle.ts](../../src/plugins/csv-sources-kuration/csv-source-handle.ts)) nutzt mtime nur noch als billigen Fast-Path und bestätigt sonst per `file_checksum` (im Snapshot) — damit ist gar kein Re-Publish mehr nötig, der Off-by-one-Snapshot heilt sich beim nächsten Check selbst.

**Kanonische Dateien:** [importer.ts](../../src/core/services/csv/importer.ts) (`updatedSchema`), [snapshot.ts](../../src/core/services/csv/snapshot.ts) + [snapshot-keys.ts](../../src/core/services/csv/snapshot-keys.ts) (Sync-Keys beim Publish setzen), [csv-source-handle.ts](../../src/plugins/csv-sources-kuration/csv-source-handle.ts) (`checkSourceForUpdate`).

## 7. Custom-Modal ohne Höhen-Cap (zu hoch / nicht scrollbar)

**Symptom:** Ein Modal-Fenster ist bei langem Inhalt (viele Listenzeilen, Platzhalter-/Mapping-Tabellen) zu hoch, passt nicht auf den Schirm und ist **nicht scrollbar** — oberer/unterer Rand inkl. Aktionsbuttons abgeschnitten. Tritt erst mit echten Daten auf (in Dev/Fixtures sind die Listen kurz).

**Root-Cause:** Eine **eigene** (custom) Modal-Hülle (`fixed inset-0`-Overlay + zentrierte Karte) ohne `max-height` an der **Karte**. Sie verlässt sich darauf, dass der **äußere Overlay** scrollt (`overflow-y-auto` am Backdrop). Das greift aber nicht zuverlässig: `position: fixed` kann durch einen transformierten / `overflow:hidden`-Vorfahren auf einen kleineren Containing-Block bezogen werden → der Overlay-Scroll läuft ins Leere. Zudem fehlt ein fixer Kopf/Fuß, sodass Titel + Buttons wegscrollen. Zweimal+ aufgetreten: erst beim shared Vorlage-Dialog, dann bei `AufnahmeOverlay` („Dokumente aufnehmen"), `SkillTestlauf`, `PasswortDialog`.

**Fix-Pattern:**
1. **Bevorzugt KEINE eigene Hülle bauen.** Neue Modals über den shared [`@/ui/Dialog`](../../src/ui/Dialog.tsx) (`size`-Prop `md`/`lg`) ODER den shadcn [`@/components/ui/dialog`](../../src/components/ui/dialog.tsx) (`size` `sm`/`md`/`lg`/`xl`, `align` `center`/`top`) rendern — beide bringen `max-h` + scrollenden Body + fixen Kopf/Fuß bereits mit. **Maschinell erzwungen** seit v2.81 durch den Convention-Test `no-raw-modal` ([codebase-conventions.test.ts](../../src/__tests__/codebase-conventions.test.ts)): `fixed inset-0` außerhalb der beiden Dialog-Dateien ist verboten — Vollbild-Zustände und Drawer per Inline-Ausnahme `// allow-raw-modal: <grund>` whitelisten.
2. **Wenn doch custom** (eigene Breite/mehrphasige Struktur nötig): Karte = `… flex flex-col max-h-[85vh] overflow-hidden`; **ein** Kind = der Body mit `flex-1 min-h-0 overflow-y-auto`; Kopf und Fuß als `shrink-0`-Geschwister bleiben fix. **vh-basiert** (nicht `%`/`vh` am Overlay) → robust, auch wenn ein Vorfahren `position:fixed` bricht. Referenz-Pattern: [KonvertierungReviewDialog.tsx:33,55](../../src/core/components/KonvertierungReviewDialog.tsx).

**Warnsignal beim Entwickeln:** Sobald Code `fixed inset-0` + eine Karten-`<div>` **ohne** `max-h`/`max-height` schreibt (oder den Scroll nur am Overlay-Backdrop hat), fehlt der Cap — der äußere Scroll ist KEIN verlässlicher Ersatz für eine interne, vh-gedeckelte Scroll-Region.

**Kanonische Dateien:** [Dialog.tsx](../../src/ui/Dialog.tsx) (shared, `size`-Prop), [dialog.tsx](../../src/components/ui/dialog.tsx) (shadcn), [KonvertierungReviewDialog.tsx](../../src/core/components/KonvertierungReviewDialog.tsx) (custom-Referenz), [AufnahmeOverlay.tsx](../../src/plugins/antraege/aufnahme-einfach/AufnahmeOverlay.tsx).

## 8. Verfügbarkeits-Ping darf die Streamlit-Bridge nicht öffnen

**Symptom:** Beim bloßen **Öffnen** einer Seite (z.B. Verbund-Detailseite mit generierten Abschnitten) poppt ungefragt ein zweiter Browser-Tab auf die interne KI-URL (`https://gpt.vdivde-it.de/`) auf. Der User hat nichts „generieren" geklickt. (v2.103.2)

**Root-Cause:** Ein rein **lesender** Verfügbarkeits-Check (`bridge.getActiveTransport().ping()` / `pingActive()`) hat einen **Fenster-Seiteneffekt**: `StreamlitBridgeTransport.ping()` ruft `ensureConnection()`, und das macht `window.open(...)`, wenn kein Bridge-Fenster-Handle existiert. Auf llama.cpp/DirectLLM fällt das nicht auf (Ping = `/v1/models`-Fetch, kein Fenster) — aber der **Default-Transport ist die Streamlit-Bridge**. Eine Mount-/Init-Probe, die „nur mal schauen, ob die KI da ist" will, öffnet so einen Tab.

**Fix-Pattern:** `ping(opts?: PingOptions)` mit `openIfNeeded` (Default `true` = altes Verhalten). **Mount-/Init-/Refresh-Proben** rufen `ping({ openIfNeeded: false })` → **passiv**: pingt nur ein bereits offenes Fenster, öffnet selbst keins, liefert ohne lebendes Handle sofort `false`. Nur **explizite Nutzer-Gesten, die die KI wirklich nutzen** (Generieren/QS-Pre-Flight, Verbindungstest in den Einstellungen, SkillTestlauf), dürfen den Tab öffnen (Default `true`). Faustregel: **Ein automatischer „ist X erreichbar?"-Check beim Rendern/Laden darf nie eine sichtbare Fenster-/Tab-Aktion auslösen** — diese gehört an eine Nutzer-Geste.

**Warnsignal beim Entwickeln:** Ein `useEffect`/Init-Pfad, der `ping()`/`pingActive()` ohne `{ openIfNeeded: false }` aufruft. Prüfen: Was, wenn der aktive Transport die Streamlit-Bridge ist und noch kein Fenster offen? → passiv pingen.

**Maschinell erzwungen:** [streamlit-ping.test.ts](../../src/core/services/ai/__tests__/streamlit-ping.test.ts) (passiver Ping ohne Fenster → `false` UND kein `window.open`; aktiver Ping → `window.open`).

**Kanonische Dateien:** [streamlit.ts](../../src/core/services/ai/transports/streamlit.ts) (`PingOptions`, `ping`, `ensureConnection`), [bridge.ts](../../src/core/services/ai/bridge.ts) (`pingActive`), [useKurzfassung.ts](../../src/plugins/antraege/kurzfassung/useKurzfassung.ts) + [useGutachtenWorkflow.ts](../../src/plugins/antraege/gutachten/useGutachtenWorkflow.ts) (passive Mount-/Refresh-Proben).

---

## 9. Abgeleitete Daten rebuilden nicht bei Config-Nachzug

**Symptom:** Eine einblendbare Spalte / ein Cache bleibt **leer**, obwohl (a) das Schema-Mapping die Quellspalte inzwischen mappt und (b) die Rohdaten den Wert tragen. Erst ein erzwungener Voll-Neuaufbau füllt sie. (v2.158.2: FB-/PreCheck-Status-Spalten leer nach nachträglichem Mapping.)

**Root-Cause:** Eine Projektion/ein Cache wird aus **Rohdaten × Konfiguration** berechnet (hier: `ANTRAEGE_LIST_VIEW` aus dem `ANTRAEGE`-Store × dem FB/PC-Feld-Mapping der Programm-Schemas). Der Rebuild-Trigger hing nur an **einer** Achse: einem Code-Versions-Marker (`LIST_VIEW_PROJECTION_VERSION`), der bei reinen Konfig-Änderungen gleich bleibt. Eine **Mapping-Änderung ändert keinen Record** → weder der Count-Backfill noch der inkrementelle Snapshot-Diff markieren etwas als „neu zu projizieren", und der Marker bumpt nicht → die abgeleiteten Felder bleiben für den Altbestand dauerhaft leer.

**Fix-Pattern / Regeln:**
- Abgeleitete Daten, die aus **Rohdaten × Konfiguration** entstehen, brauchen einen Rebuild-Trigger auf **beiden** Achsen. Neben dem Code-Marker eine **Signatur über die Konfiguration** in den Guard aufnehmen — ändert sie sich, Voll-Rebuild erzwingen. Beispiel: `computeStatusDatumSchemaSig` (deterministischer Hash `code>feld#label` über alle Programm-Schemas) in [list-view-migration.ts](../../src/core/services/csv/list-view-migration.ts); Guard-Bedingung `marker !== VERSION || sigChanged`.
- Eine **fehlende** Signatur (Altbestand vor Einführung) darf **keinen** Rebuild erzwingen (den übernahm der begleitende Code-Marker-Bump) — sie wird lazy nachgetragen, damit der „Marker aktuell → No-op"-Pfad (Backfill/Stale-Erhalt) unberührt bleibt.
- Beim Debuggen „Rohdaten + Mapping vorhanden, Projektion leer": prüfen, ob der Rebuild-Trigger die **Konfig-Achse** überhaupt beobachtet — nicht nur die Code-/Record-Achse.

**Beleg:** v2.158.2. Detail: [csv-auto-refresh.md](csv-auto-refresh.md) („Projektions-Rebuild bei Mapping-Nachzug").

---

## 10. DOM-Scraping fremder UIs ist positionsfragil

**Symptom:** Die Streamlit-Bridge greift die **falsche** Chat-Nachricht aus dem AitisiGPT-DOM — mal die Vor-Begrüßung, mal eine nachgeschobene Folge-Begrüßung, mal eine noch nicht fertige Teil-Antwort. Vier Patches in Folge (v2.157.1 → v2.159.1 → v2.159.3 → v2.159.4), jeder eine andere Positions-Annahme.

**Root-Cause:** Das Antwort-Fenster ist ein **fremdes**, nicht kontrolliertes DOM. Jede Annahme über die **Position** der Antwort-Nachricht ist brüchig: „die letzte Nachricht" bricht, weil AitisiGPT **nach** der Antwort eine kanned Folge-Begrüßung anhängt; eine „Zähl-Baseline vor dem Senden" bricht am Render-Race; „die letzte nach dem Echo" bricht ebenfalls. Real-DOM-Roster: `[0] Begrüßung · [1] User-Prompt(Echo) · [2] Antwort · [3] Folge-Begrüßung`.

**Fix-Pattern / Regeln:**
- Stabil ist nur die **Anker-Relation**, nicht die Position: die **erste Nicht-User-Nachricht NACH dem Prompt-Echo** (der letzten User-Nachricht). Kein Prompt-Echo gefunden → `null` zurückgeben, **nicht raten** (kein Race-Fallback auf die Begrüßung).
- Reine Auswahl-Logik als **pure Funktion** testbar halten (`selectAnswer(roster)` in [answer-selection.ts](../../src/core/services/ai/streamlit-bridge/answer-selection.ts)), gegen **belegte DOM-Roster-Fixtures**; das Bookmarklet-`.js` (`findAnswerMsg`, standalone via `?raw`) **spiegelt** dieselbe Index-Mathematik (Drift-Test).
- Bei Black-Box-DOM **nicht raten** → einen Diagnose-Roster-Dump loggen und die echte Struktur ansehen; einen `BRIDGE_REV`-Marker mitführen, damit ein veraltetes Bookmarklet erkennbar ist (Bookmarklet-Änderung = Re-Install).

**Beleg:** v2.157.1 → v2.159.1 → v2.159.3 → v2.159.4. Detail: [streamlit-bridge.md](streamlit-bridge.md) („Antwort-Auswahl (Echo-Anker)").

---

## 11. Streamlit-Bridge `submitMessage` verwirft den `systemPrompt`-Arg

**Symptom:** Ein KI-Aufruf, der (auch) über die interne Bridge läuft, „antwortet zwar, aber das Ergebnis stimmt nicht" — freie Prosa statt des geforderten JSON, ignorierte Format-/Rollen-/Kontext-Vorgaben, leere Parse. Auf DirectLLM/OpenRouter fällt es nicht auf. (v2.206: die Feedback-Verbesserung meldete „eine Antwort kam über die interne KI, aber die Verbesserung lief nicht".)

**Root-Cause:** `StreamlitBridgeTransport.submitMessage(message, _systemPrompt, options)` **ignoriert** den 2. Parameter — nur `message` wird als `tf-request` an die Bridge gepostet. Ein Aufruf `submitMessage(userPrompt, systemPrompt)` schickt der internen KI also NUR den User-Text; der ganze System-Prompt (Format-Schema, Kontext, Rollenanweisung) fällt weg. `DirectLLMTransport.submitMessage` nutzt den Arg dagegen als System-Rolle → dieselbe Zeile verhält sich je Transport anders.

**Fix-Pattern / Regel:** Wer `submitMessage` transport-agnostisch oder Streamlit-only nutzt, **inlined den System-Prompt in die Message**: `submitMessage(\`${systemPrompt}\n\n${userPrompt}\`, systemPrompt, opts)` — der 2. Arg bleibt für DirectLLM gesetzt, die Bridge liest die Message. Bewährtes Muster im Code: [run-skill.ts](../../src/core/services/skills/run/run-skill.ts), [llm-client.ts](../../src/plugins/suche/analyse/llm-client.ts) („Streamlit-Pfad: System + User in eine kombinierte Message"), [relevanz-map.ts](../../src/plugins/antraege/gutachten/relevanz-map.ts), [bausteine.ts](../../src/plugins/antraege/aufbereitung/bausteine.ts), [feedbackImprove.ts](../../src/core/services/feedback/feedbackImprove.ts) (`submitInline`). Für echte Multi-Turn-Konversation gilt dasselbe: die Bridge ist single-turn (`streamConversation` flacht auf letzte-User-Message + System-Prefix ab, `submitConversation` fehlt ganz).

**Warnsignal beim Entwickeln:** Ein `submitMessage(userPrompt, systemPrompt)`-Aufruf, der (auch) auf `transport.name === 'Streamlit'` landet, OHNE dass der System-Prompt Teil des **ersten** Arguments ist.

**Kanonische Dateien:** [streamlit.ts](../../src/core/services/ai/transports/streamlit.ts) (`submitMessage`, `_systemPrompt` ungenutzt), [feedbackImprove.ts](../../src/core/services/feedback/feedbackImprove.ts) (`submitInline`).

---

## 12. Zustand nur in der Varianten-IDB = ein Verlust, keine Wiederherstellung

**Symptom:** Nutzer müssen nach einem Update/Sessionwechsel „alles neu einrichten" — Name + Kürzel eintippen, Ordner neu verbinden. Wirkt wie ein Fehler im Update, ist aber Speicherverlust.

**Root-Cause:** Unter `file://` ist die IndexedDB (`teamflow-<outputFilename>`, [runtime-config.ts](../../src/config/runtime-config.ts) `deriveVariantDbName`) **best-effort**-Speicher — der Browser darf sie unter Platzdruck räumen, und in virtualisierten Umgebungen (Citrix/VDI) wandert das Chrome-Profil oft gar nicht mit bzw. wird zurückgesetzt. Dort liegen aber **gleichzeitig** die Identität (`profile` + der alleinige Gate-Schlüssel `onboarding-complete`, [App.tsx](../../src/core/App.tsx)) **und sämtliche FSAPI-Handles**. Fällt die DB weg, ist beides zusammen weg — der Nutzer landet im Onboarding **und** muss alle Ordner neu wählen. Die App löscht `onboarding-complete` nirgends; wer es vermisst, sucht den Fehler falsch.

**Fix-Pattern:**
- **Jeden nur-lokal gehaltenen Zustand, dessen Verlust den Nutzer Arbeit kostet, zusätzlich in den persönlichen Ordner spiegeln — UND den Rückweg tatsächlich verdrahten.** Das Profil wurde seit jeher nach `<pers>/ZAH/profile.json` geschrieben ([Onboarding.tsx](../../src/core/Onboarding.tsx)), aber `loadPersonalSettings` hatte bis v2.276.0 **keinen einzigen Aufrufer** — ein Backup, das nie gelesen wird, ist kein Backup. Seit v2.276.0 bietet Schritt 0 des Onboardings „Aus persönlichem Ordner wiederherstellen" an.
- **Wiederherstellung braucht eine User-Geste und kann nicht automatisch beim Start laufen:** mit der IDB sind auch die Handles weg, der Ordner muss neu gewählt werden (Picker = Geste, siehe Klasse 2).
- **`navigator.storage.persist()` beim Init anfragen** ([storage/index.ts](../../src/core/services/storage/index.ts), best-effort/nicht awaiten). Senkt die Eviction-Wahrscheinlichkeit, ersetzt aber **kein** Backup — gegen ein zurückgesetztes Profil hilft es nicht.
- **Bei „alles neu"-Meldungen zuerst den DB-Namen prüfen**, nicht den Code: eine andere Variante/ein anderer `outputFilename` ergibt eine eigene, leere DB — unter `file://` teilen sich alle Varianten einen Origin, nur der Name trennt sie (Klasse 3).
- **⚠️ Im dev-Build noch DAVOR fragen, ob ein Fixture-Szenario angewendet wurde.** Alle Szenarien starten mit `resetAll` ([helpers.ts](../../src/dev-fixtures/helpers.ts)), das den kv-Store leert. Bis v2.277 nahm es `profile` + `onboarding-complete` mit — **Fingerabdruck: Name/Kürzel neu tippen, aber die Ordner bleiben verbunden** (Handles waren schon immer ausgenommen; genau diese Asymmetrie verrät den Fall und unterscheidet ihn vom echten Speicherverlust, bei dem beides weg ist). Seit v2.277 sind alle drei Setup-Schlüssel ausgenommen, den Erstlauf testet man über die Aktion „Onboarding zurücksetzen". **Regel für neue Dev-Werkzeuge: was zum Setup gehört, überlebt einen Szenario-Reset — sonst zahlt der Tester die Einrichtung bei jedem Klick erneut.**

**Maschinell erzwungen (v2.277.1):** `no-blanket-idb-wipe` in [codebase-conventions.test.ts](../../src/__tests__/codebase-conventions.test.ts). Eine Datei, die unpräfixiert `idb.keys()` holt **und** `idb.delete(...)` aufruft, muss aus [setup-keys.ts](../../src/core/services/storage/setup-keys.ts) importieren (`istSetupKey`) — sonst schlägt der Test fehl. Rein lesende `keys()`-Nutzung (State-Dumps, Inspector) und bewusste Voll-Resets: Zeile mit `// allow-blanket-idb-wipe: <grund>` markieren. Präfix-gebundenes `idb.keys('doc:')` ist unkritisch und wird nicht erfasst — es kann die Setup-Keys gar nicht treffen.

**Kanonische Dateien:** [setup-keys.ts](../../src/core/services/storage/setup-keys.ts) (`SETUP_IDB_KEYS`/`istSetupKey` — einzige Quelle), [App.tsx](../../src/core/App.tsx) (`onboarding-complete`-Gate), [Onboarding.tsx](../../src/core/Onboarding.tsx) (`restoreFromPers`), [personal-storage/service.ts](../../src/core/services/personal-storage/service.ts), [storage/index.ts](../../src/core/services/storage/index.ts).

---

## 13. Prompt verlangt einen Wortlaut „exakt" und zeigt ihn zugleich abgeschnitten

**Symptom:** Ein Skill-Lauf dauert sehr lange und bricht ohne Antwort ab; im Reasoning-Trace sucht das Modell dutzendfach dieselbe Stelle („Wait, looking at the prompt again…") und degeneriert am Ende in Token-Wiederholung. Andere Abschnitte desselben Workflows laufen sauber durch.

**Root-Cause:** Die Anweisung ist nicht erfüllbar. Sie fordert eine **exakte** Wiedergabe eines Wortlauts und zeigt ihn zugleich zitiert und per Auslassungszeichen abgeschnitten — das Modell kann weder entscheiden, ob das „…" zum Wortlaut gehört, noch wo er endet. Konkret trug Abschnitt G bis v2.284.1 die Regel `Beginne den finalen Text **exakt** mit: „… Technologiekompetenz im Bereich …"`; der Pflicht-Anfang endet zusätzlich mitten im Satz, was die Vorgabe wie ein Fragment aussehen ließ. Das Modell verbrauchte das Ausgabebudget mit der Suche nach der String-Grenze.

**Fix-Pattern:**
- **Wörtliche Vorgaben stehen unzitiert in einem eigenen, zeilenbegrenzten Block** — nicht als Zitat in einer Fließtext-Regel. Die Zeilengrenze ist die eindeutige Grenze (`abschnittTemplate.pflichtAnfang`).
- **Endet der Wortlaut absichtlich mitten im Satz, muss der Prompt das ausdrücklich sagen** („endet absichtlich mitten im Satz, führe ihn fort"). Ohne diesen Satz sucht das Modell den fehlenden Rest.
- **Gilt auch für Korrektur-Hinweise** aus der Check-Engine (`pflicht_anfang.hint`) — sie landen im selben Modell.
- **Zweiter Fall dieser Klasse.** Der erste war der Beleg→Satz-Marker-Kontrakt (Journey-Paket 4), zurückgebaut in v2.241.5 — dort trieb ein zitiertes Marker-Beispiel dasselbe Verhalten. Wenn ein Prompt-Kontrakt „schlau" wirkt, aber das Modell hängen lässt: erst den Kontrakt entfernen, nicht am Modell drehen.
- **Auf dem Streamlit-Bridge-Pfad ist der Prompt der einzige Hebel** — `maxTokens`/`thinkingBudget` gehen nur an DirectLLM-Transporte ([run-skill.ts](../../src/core/services/skills/run/run-skill.ts)); die Bridge schiebt reinen Text in die Chat-Oberfläche.

**Verallgemeinerung (Prompt-Audit 2026-07):** Der Prompt entsteht aus bis zu acht Blöcken
(`composeSkillPrompt`), und die häufigste Defektform ist nicht die elidierte Vorgabe, sondern
**zwei Blöcke, die Gegenteiliges fordern, während der Vorrang nur im Code-Kommentar steht**. Der
`teilStruktur`-Block etwa ist als „autoritativer Override" dokumentiert und sagt dem Modell nichts
davon — es sieht drei Fließtext-Forderungen gegen eine JSON-Forderung. **Ein Vorrang, der nicht im
Prompt steht, existiert für das Modell nicht.** Verwandt und ebenso häufig: Anweisungen, die auf
Information verweisen, die im Prompt fehlt (`Vermeide die hinterlegten verbotenen Formulierungen.`),
Überschriften über leeren Slots, und Beispiele, die der Antwort-Parser nicht von echten Daten
unterscheiden kann. Vollständige Befundliste über alle Prompt-Pfade mit Fundstellen und
Positivbeispielen: [prompt-audit-2026-07.md](../prompt-audit-2026-07.md).

**Maschinell erzwungen (v2.284.1):** `keine-elidierte-wortlaut-vorgabe` in [codebase-conventions.test.ts](../../src/__tests__/codebase-conventions.test.ts). Unter `src/core/services/skills/` darf keine Zeile ein Literalitäts-Wort (`exakt`/`wörtlich`/`wortgetreu`) mit einem elidierten Zitat (`…` direkt vor einem schließenden Anführungszeichen) kombinieren. Eingefrorene Alt-Stände für die Migrations-Erkennung: Zeile mit `// allow-elidierte-wortlaut-vorgabe: <grund>` markieren. Rein veranschaulichende „…"-Zitate ohne Literalitäts-Forderung (z.B. `grundsatz.ts`) sind nicht erfasst.

**Kanonische Dateien:** [seed.ts](../../src/core/services/skills/registry/seed.ts) (`abschnittTemplate.pflichtAnfang`, `G_ABSCHNITT_OPTS`), [check-engine.ts](../../src/core/services/skills/registry/check-engine.ts) (`pflicht_anfang.hint`), [migrations.ts](../../src/core/services/skills/registry/migrations.ts) (`GA_PFLICHT_ANFANG_KLAR_MIGRATION`).
