# Wiederkehrende Bug-Klassen

Sieben Fehler-Muster, die in diesem Projekt **mehrfach** aufgetreten sind und an denen Coding-Agents real scheitern. Vor dem Bauen neuer Lade-/Persist-/Permission-/Modal-Pfade die zur Aufgabe passende Klasse überfliegen — das verhindert die häufigsten Regressions.

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
- **⚠️ Auto-Skip-Pfade MÜSSEN den ConnectionState trotzdem setzen (v2.56.1-Regression).** Der „alle granted → ohne Klick weiter"-Zweig darf NICHT bloß `onReady()` rufen — er muss `applyRefreshResult(await queryAllPermissions(...))` fahren. Sonst bleibt `useConnectionState.mode` auf INITIAL `'offline'` ([connection-status.ts](../../src/core/services/connection-status.ts)) und der OfflineBanner erscheint beim Reload, obwohl der Daten-Share erreichbar ist (der Visibility-Probe feuert nur bei `visibilitychange`, nicht beim geraden Reload). Gemeinsamer `finishStartup`-Helfer für Warm-Start UND Stepper-Ende.
- **Perf:** Eine Datei in einem Dir-Handle per Inhalt finden (alle Dateien lesen+parsen) ist auf SMB teuer. schemaId→Dateiname **lokal persistieren** (eigener, nicht-synchronisierter IDB-Key — kein Schema-Feld, das der Snapshot überschreibt), danach nur `getFileHandle(name)`.

**Rest-Bug `SMB_HANDLE_PERSOENLICH` — behoben in v2.55:** Der persönliche Ordner verhungerte bis v2.54 im StartupScreen-Gesture (Daten-Share fraß den Slot) und promptete deshalb zu einem zufälligen späteren Zeitpunkt. Seit dem Guided-Grant-Stepper ist er ein eigener Klick-Schritt → eigener Gesture → zuverlässiger Prompt in fester Reihenfolge (Daten-Share → persönlich → CSV-Quelle). Die kurator-**Post-Login-Eskalation** (`refreshAllPermissions({isKurator:true})` im AppPasswordGate) hat dieselbe Multi-Prompt-Starvation für User-Folders-Root + DMS-Sources noch ungelöst (vorbestehend, nicht pl-relevant) — bei Bedarf denselben Stepper-Ansatz anwenden.

**⚠️ Auto-Load/Timer-Pfade nie ohne `queryPermission`-Vorabcheck (v2.59.4):** Ein Hintergrund-Loader (Mount-Effekt, `setInterval`) darf ein gespeichertes Dir-Handle NICHT blind iterieren/lesen — ohne User-Gesture kann er die verfallene Permission nicht via `requestPermission` erneuern, und schon `dirHandle.values()` wirft dann `NotAllowedError` („The request is not allowed by the user agent or the platform in the current context"). Muster: erst `queryPermission` (non-invasiv); ist sie ≠ `granted` → einen **Re-Grant-Button** (Gesture) anbieten statt zu crashen. Konkreter Fall: der Online-Tab auf dem User-Folders-Root ([OnlineTab.tsx](../../src/plugins/einstellungen/OnlineTab.tsx), Helfer `queryUserFoldersRootPermission`/`refreshUserFoldersRootPermission`). Beachte: ein gespeichertes Handle, das in IDB existiert, sagt NICHTS über die aktuelle Permission — „existiert" (→ kein Picker) und „granted" (→ lesbar) sind getrennt zu prüfen.

**⚠️ Dev reproduziert das oft NICHT** — Dev seedet CSV-Quellen aus Fixture-Blobs (kein echtes Handle in IDB → Stepper-Scan = leer → Auto-Skip). Handle-Bugs nur auf einem echten `file://`-Build mit real verknüpften Handles testen.

**Kanonische Datei:** [smb-handle.ts](../../src/core/services/infrastructure/smb-handle.ts) (`refreshAllPermissions`, `listPendingGrants`, `queryAllPermissions`, `grantPending`), [GuidedGrantSteps.tsx](../../src/core/components/GuidedGrantSteps.tsx), [StartupScreen.tsx](../../src/core/StartupScreen.tsx), [AppPasswordGate.tsx](../../src/core/AppPasswordGate.tsx).

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
