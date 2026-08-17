# Wiederkehrende Bug-Klassen

Fehler-Muster, die in diesem Projekt **mehrfach** aufgetreten sind und an denen Coding-Agents real scheitern. Vor dem Bauen neuer Lade-/Persist-/Permission-/Modal-/Transport-/Filter-Pfade die zur Aufgabe passende Klasse überfliegen — das verhindert die häufigsten Regressions.

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
- **Detailseite, die ihre Entität EINMALIG im Mount-Effekt auflöst?** Die Store-Datenversion gehört in die Effekt-Deps. [useVerbundDetailData.ts](../../src/plugins/antraege/useVerbundDetailData.ts) las Verbund/TVs mit Deps `[verbundId, idb, isPseudo]` — lief der Leseversuch ins Leere (Start-Sync noch nicht durch, oder das Fenster, in dem `replaceStore` zwischen `clear()` und `put()` steht), blieb `verbund: null` bis zum manuellen Reload. Sichtbar wurde das **nicht** als Fehlermeldung, sondern als **still gewordener CTA**: die Antrag-Aufbereitung rendert ihr volles Gerüst, aber „Neu aufbereiten" und „Mit KI aufbereiten" brechen ohne Kontext wortlos ab (`if (!ctx) return`). Fix (v2.302.1): `useAntraegeStore(s => s.lastLoadedAt)` + eine Retry-Nonce in den Deps, dazu ein `laedt`-Flag, das „wird geladen" von „gibt es nicht" trennt. **Regel: ein Knopf, der nichts tut, ist das Symptom — gesucht ist der Lesepfad, der nur einmal läuft.**
- **Konsument hält eigenen `useState`/Ref-Cache statt Zustand-Store?** Dann braucht er ein explizites Re-Read-Signal: einen [Signal-Store](../../src/core/lib/createSignalStore.ts) (`createSignalStore()`), den der Writer bumpt. Beispiel: `bumpAuslastungCorpusSignal()` nach Korpus-IDB-Mutation ([corpus-signal.ts](../../src/plugins/auslastung/services/corpus-signal.ts)). **Nur EXTERNE Mutationen bumpen** — wer den Write selbst auslöst und das Ergebnis direkt erhält, bumpt nicht (sonst Self-Trigger-Loop).

**Maschinell erzwungen** durch die Convention-Tests `import-requires-store-refresh` (jede `importCsvSource(`-Datei referenziert `refreshAntraegeStoreAfterSync`) und `antraege-write-requires-listview-rebuild` (jede `replaceStore(`-Datei referenziert `rebuildAntraegeListView`) in [conventions-daten.test.ts](../../src/__tests__/conventions-daten.test.ts) (Ausnahme: `// allow-import-no-refresh:` bzw. `// allow-antraege-write-no-listview: <grund>`).

**⚠️ Gefährliche Variante (echter Datenverlust, nicht nur leere Anzeige):** Ein transienter Leer-Read (Datei gerade im `atomicWrite`-`.tmp`-Rename-Fenster eines parallel offenen Tabs) setzt `loaded=true` mit 0 Datensätzen → ein Auto-Persist-Effekt **schreibt die leere Basis zurück** und überschreibt die volle Datei. → Auto-Persist-Effekte (Auto-Collect, Reconcile) **gegen `setupAbgeschlossen` / nicht-leere Basis gaten** — nie auf eine un-eingerichtete Basis schreiben. Verwandt: Klasse 3.

**⚠️ Fünfter Mechanismus — der Pre-Grant-Read SCHRIEB einen Ersatzwert fest (v4.85.1).** Bisher stand hier nur „Flag nicht schärfen". Der Status-Katalog zeigte die schärfere Form: `ladeAktiveVersion` legte beim Lesen den Auslieferungs-Seed als **Fassung 1** ab und aktivierte ihn. Aufgerufen wird sie unter anderem von `initStatusKatalog` und `ensureListViewProjection` — beide laufen in [App.tsx](../../src/core/App.tsx) **vor** dem Ordner-Picker. Auf einer frischen Installation und nach jedem echten Browser-Neustart (Klasse 2: Permission zurück auf `prompt`) galt damit der Build-Stand als kuratierte Fassung, für die ganze Sitzung — samt ZAH-Phasen, Code→Phase-Schnitt und AB-Regeln, denn das ist alles **eine** `MappingVersion`. Ein Speichern im Cockpit konnte den Seed sogar über die Team-Fassung veröffentlichen. → **Zwei Regeln.** (a) *Lesen schreibt nicht*: ein Rückfallwert wird zurückgegeben, nicht abgelegt; das Ablegen bekommt eine eigene Funktion mit einem benannten Aufrufer (`sorgeFuerGespeicherteFassung`, nur das Cockpit). (b) *Wer vor dem Grant liest, braucht einen Nachlauf*: `synchronisiereKatalogNachGrant` setzt nach, sobald das Handle steht — und **vor** dem Verbraucher (hier `runDataUpdate`, das die `kat_status`-Spalten aus der aktiven Fassung auflöst). Vorbild ist `nachStartDatenupdateVorwaermen` ([auslastung/index.tsx](../../src/plugins/auslastung/index.tsx)). Billig halten: erst den Dateikopf lesen (4 KB), die Megabyte nur bei abweichender Nummer.

**Beim Debuggen „IDB hat Daten, Store leer":** IMMER prüfen — liest die UI denselben Store, der geschrieben wurde, oder eine Projektion/Index/lokalen Cache? Und: kann ein leerer/transienter Load jemals persistiert werden?

**Kanonische Dateien:** [snapshot-refresh.ts](../../src/plugins/antraege/snapshot-refresh.ts), [store.ts](../../src/plugins/antraege/store.ts), [useSnapshotWatcher.ts](../../src/core/hooks/useSnapshotWatcher.ts), [corpus-signal.ts](../../src/plugins/auslastung/services/corpus-signal.ts), [createSignalStore.ts](../../src/core/lib/createSignalStore.ts), [katalog-store.ts](../../src/core/status/katalog-store.ts) + [status/index.ts](../../src/core/status/index.ts).

---

## 2. FSAPI: ein Permission-Prompt pro User-Gesture (`file://`)

**Symptom:** Nach Browser-Neustart fehlen nachgelagerte File-Handles (CSV-Quellen, persönlicher Ordner) — die App startet aber normal, weil der Daten-Share klappt. Wirkt wie „Verknüpfung nach Neustart weg".

**Root-Cause:** Unter `file://` verlieren ALLE FSAPI-Permissions bei jedem Neustart ihre Berechtigung (zurück auf `prompt`). Chromium verbraucht die transiente User-Activation **pro `requestPermission`-Prompt** → im selben Gesture wird nur der **erste** Prompt angezeigt, weitere schlagen still fehl. `refreshAllPermissions` prompted sequenziell (Daten-Share zuerst) → der Daten-Share frisst den einzigen Slot des StartupScreen-Gestures.

**⚠️ Browser-abhängig (Korrektur v2.59.2):** Das obige „ein Prompt pro Gesture / nicht kombinierbar" ist das **Worst-Case**-Modell und gilt NICHT überall. Manche Chromium-Browser haben **persistente FSAPI-Permissions** + einen **konsolidierten „Wiederherstellen"-Prompt**: ruft die App `requestPermission()` auf einen früher gewährten Handle, bündelt der Browser ALLE gespeicherten Handles des Origins in EINE Box, und „Bei jedem Besuch zulassen" macht die Freigabe persistent (kein Re-Prompt nach Neustart). **Empirisch (Juni 2026):** in **Edge** beobachtet; in **Chrome unter `file://` NICHT** (bis v149, auch am Folgetag ohne clear-site-data kein Sammel-Dialog) — das Feature ist offenbar kontext-/secure-context-/engagement-gated, und `file://` ist ein Sonderfall, in dem die Browser divergieren. **Nachtrag August 2026:** Chrome zeigt inzwischen zwar keine Sammel-Box, aber **mehrere Einzel-Dialoge hintereinander** aus einem Klick (die Kette kommt durch) — das „nur der erste Prompt erscheint" ist also nicht mehr allgemein, sondern **zeitabhängig**: das Fenster der transienten Activation ist begrenzt, jede Arbeit zwischen zwei `requestPermission`-Aufrufen frisst es auf. Die App kann nichts davon **erzwingen**. Konsequenz für den Code: nichts annehmen — der Guided-Stepper bleibt der **robuste Fallback** (Schritt-für-Schritt, ein Prompt je Ordner) und **kollabiert** dort, wo der Browser mehrere auf einmal gewährt.

**⚠️ Reload ≠ Neustart (Repro-Falle).** Chromium hält die FSAPI-Freigaben, solange **irgendein Tab** des Origins offen ist. Ein `F5` läuft deshalb als Warm-Start ganz **ohne** Stepper — wer den Grant-Flow testen will, muss den Browser komplett schliessen (bzw. alle `file://`-Tabs). Wechselnde Symptome („mal fragt er, mal nicht") sind fast immer das, nicht Nichtdeterminismus im Code.

**Fix-Pattern:**
- Mehrere Dateien am selben Ort → **EIN `FileSystemDirectoryHandle`**; Directory-Permission **kaskadiert** auf `dirHandle.getFileHandle(name)` → ein Prompt deckt alle ab (Kaskade ist nicht rekursiv: Dateien müssen direkt im Ordner liegen).
- Den Re-Grant in einen **zweiten, sauberen Gesture** legen, in dem der Daten-Share schon granted ist — auf der pl der AppPasswordGate-Login. Dort NUR das gewünschte Handle re-granten (dedizierte Funktion, z.B. `refreshCsvSourceDirPermission`), NICHT `refreshAllPermissions` (sonst stiehlt der persönlich-Handle den Slot). *(v2.61.2 überholt für pl: die AppPasswordGate läuft jetzt VOR dem Stepper und macht für pl keine Permission-Arbeit mehr — der Guided-Stepper gibt nach dem Login alle Handles frei. Das Muster bleibt gültig für jeden anderen „zweiter sauberer Gesture"-Fall.)*
- **Generalisierung (v2.55): Guided-Grant-Stepper.** Wenn N verschiedene Roots (verschiedene Pfade, keine gemeinsame Kaskade) re-granted werden müssen, ist „eine Freigabe pro Klick" der robuste Weg: beim Mount non-invasiv `queryPermission` (kein Gesture) → `listPendingGrants` liefert die ungranted Handles → der StartupScreen rendert pro Handle EINEN Klick-Schritt ([GuidedGrantSteps.tsx](../../src/core/components/GuidedGrantSteps.tsx)). Jeder Klick = ein `requestPermission` = ein zuverlässiger Prompt. Sind alle granted → ohne Klick weiter (Warm-Start). Reihenfolge/Modi exakt wie `refreshAllPermissions` (Pitfall #25: Mode nur über `canWriteDatenShare`). **v2.59.2:** nach jedem Grant per `rescan` (= `listPendingGrants`) neu prüfen — gewährt ein konsolidierter Browser-Prompt mehrere Handles auf einmal, markiert `resolveAfterGrant` ([guided-grant-progress.ts](../../src/core/components/guided-grant-progress.ts)) alle nun gewährten Slots als erledigt und der Stepper schließt sofort ab (kein überflüssiger Folge-Schritt).
- **Ergonomie des Steppers (v2.275) — zwei Zusätze, die die Gesture-Regel NICHT aufweichen.** (a) **Position:** das Permission-Popup erscheint OBEN am Viewport, eine zentrierte Karte erzwingt pro Ordner den halben Bildschirm Mausweg. Der Stepper-Zweig des [StartupScreen.tsx](../../src/core/StartupScreen.tsx) rendert deshalb `items-start pt-[210px]` (fixer px-Wert — die Bubble ist ~200px hoch und skaliert nicht mit dem Fenster) statt `items-center`; `overflow-y-auto` ist Pflicht, sonst ist die Karte auf niedrigen Viewports unerreichbar. (b) **Auto-Fokus ab Schritt 2:** der Freigabe-Button bekommt nach jedem Grant den Fokus → der User klickt „Zulassen" und drückt danach Enter (vollwertige Geste, prompted zuverlässig), ohne die Maus zurückzuführen. Bewusst erst ab Schritt 2, damit ein noch gedrückter Enter aus dem vorgelagerten Login-Gate den ersten Schritt nicht auslöst.
- **Enge Auto-Kette mit Live-Buchung — bucht ausschliesslich Erfolge (v2.276.0, eng seit v4.40.1).** Nach einem `granted` probiert der Stepper den nächsten Slot sofort, statt auf den Klick zu warten. Die Kette läuft dabei **ohne eigene User-Geste** — ob der Browser überhaupt einen Dialog gezeigt hat, ist von aussen **nicht feststellbar**. Deshalb bucht sie über `buchErgebnis(..., echteGeste=false)` nur gewährte Slots, **nie** eine Ablehnung; bleibt ein Ordner ungewährt, ist er der nächste reguläre Klick-Schritt. Nur der **erste** Grant pro Klick (echte Geste) darf `denied` buchen.
  **Zwischen zwei Prompts läuft NICHTS** — kein `rescan`, kein IDB-Zugriff. Der Sweep (`listPendingGrants` = `queryPermission` über alle Handles, auf SMB) verbrauchte das Zeitfenster der transienten Activation, das der nächste `requestPermission` braucht; die Kette brach mal nach zwei, mal nach drei Ordnern ab. Für die Sammel-Box ist er dazwischen auch nicht nötig: ein bereits gewährtes Handle beantwortet `requestPermission` sofort mit `'granted'`, ganz **ohne** Dialog. Ein Rescan läuft nur noch **einmal am Ende** (`abschlussStand`).
  **⚠️ Ein gescheiterter Rescan darf NIE einen Grant buchen (v4.40.1).** Bis dahin lieferte der `catch` ein **leeres Set**, und ein leeres Set heisst in `resolveAfterGrant` „kein Slot mehr offen" = **alles gewährt** → `complete` → die App startete, ohne den Ordner je gefragt zu haben. Der Fehlerpfad liefert jetzt `null`, `abschlussStand` bucht dann nichts und rechnet `complete` allein aus den direkt beobachteten Ergebnissen. Merksatz: **„ich weiß es nicht" ist nicht „alles gewährt"**.
  **⚠️ Fortschritt sofort rendern (v4.40.1).** `setResolved` stand hinter der Schleife — zwischen den Browser-Dialogen rendete die Karte kein einziges Mal neu. Sie zeigte während aller drei Prompts „Schritt 1 von 3 / Wird freigegeben…" und sprang dann in die App; Nutzer meldeten „der Wizard rückt nicht weiter". Jeder Grant wird jetzt einzeln gebucht **und** gerendert, die laufende Zeile sagt „wartet auf Ihre Bestätigung", und bleibt nach dem Lauf etwas offen, benennt die Karte es („Noch ein Ordner offen…") statt still zu starten.
  **⚠️ Anti-Pattern, in v2.275.0 verbaut und in v2.276.0 entfernt:** „kein Dialog" vs. „abgelehnt" über eine **Dauer-Schwelle** (< 300 ms = kein Dialog) zu trennen. Wall-Clock taugt dafür nicht — in virtualisierten Umgebungen (Citrix) wird der Renderer unter Last hunderte Millisekunden weggeplant, die Messung läuft über ein `await` und bläht sich auf. Kippt die Schwelle, wird ein nie gezeigter Dialog als Ablehnung gebucht und der **Persönliche Ordner still übersprungen**. Entscheidungslogik pure + unit-getestet in [guided-grant-progress.ts](../../src/core/components/guided-grant-progress.ts).
- **⚠️ Auto-Skip-Pfade MÜSSEN den ConnectionState trotzdem setzen (v2.56.1-Regression).** Der „alle granted → ohne Klick weiter"-Zweig darf NICHT bloß `onReady()` rufen — er muss `applyRefreshResult(await queryAllPermissions(...))` fahren. Sonst bleibt `useConnectionState.mode` auf INITIAL `'offline'` ([connection-status.ts](../../src/core/services/connection-status.ts)) und der OfflineBanner erscheint beim Reload, obwohl der Daten-Share erreichbar ist (der Visibility-Probe feuert nur bei `visibilitychange`, nicht beim geraden Reload). Gemeinsamer `finishStartup`-Helfer für Warm-Start UND Stepper-Ende.
- **Perf:** Eine Datei in einem Dir-Handle per Inhalt finden (alle Dateien lesen+parsen) ist auf SMB teuer. schemaId→Dateiname **lokal persistieren** (eigener, nicht-synchronisierter IDB-Key — kein Schema-Feld, das der Snapshot überschreibt), danach nur `getFileHandle(name)`.

**Rest-Bug `SMB_HANDLE_PERSOENLICH` — behoben in v2.55:** Der persönliche Ordner verhungerte bis v2.54 im StartupScreen-Gesture (Daten-Share fraß den Slot) und promptete deshalb zu einem zufälligen späteren Zeitpunkt. Seit dem Guided-Grant-Stepper ist er ein eigener Klick-Schritt → eigener Gesture → zuverlässiger Prompt in fester Reihenfolge (Daten-Share → persönlich → CSV-Quelle). Die kurator-**Post-Login-Eskalation** (`refreshAllPermissions({isKurator:true})` im AppPasswordGate) hat dieselbe Multi-Prompt-Starvation für User-Folders-Root + DMS-Sources noch ungelöst (vorbestehend, nicht pl-relevant) — bei Bedarf denselben Stepper-Ansatz anwenden.

**⚠️ Auto-Load/Timer-Pfade nie ohne `queryPermission`-Vorabcheck (v2.59.4):** Ein Hintergrund-Loader (Mount-Effekt, `setInterval`) darf ein gespeichertes Dir-Handle NICHT blind iterieren/lesen — ohne User-Gesture kann er die verfallene Permission nicht via `requestPermission` erneuern, und schon `dirHandle.values()` wirft dann `NotAllowedError` („The request is not allowed by the user agent or the platform in the current context"). Muster: erst `queryPermission` (non-invasiv); ist sie ≠ `granted` → einen **Re-Grant-Button** (Gesture) anbieten statt zu crashen. Konkreter Fall: die Team-Status-Gruppe auf den Wurzeln der persönlichen Ordner ([TeamStatusGruppe.tsx](../../src/plugins/einstellungen/daten/TeamStatusGruppe.tsx), Helfer `queryUserFoldersRootPermissions` non-invasiv / `refreshUserFoldersRootPermission` im Klick). Beachte: ein gespeichertes Handle, das in IDB existiert, sagt NICHTS über die aktuelle Permission — „existiert" (→ kein Picker) und „granted" (→ lesbar) sind getrennt zu prüfen.

**⚠️ N Wurzeln = N Klicks, nie eine Schleife (v4.1):** Seit die persönlichen Ordner unter mehreren Wurzeln liegen, ist die Versuchung groß, beim „einsammeln"-Klick über alle Wurzeln zu picken bzw. zu re-granten. Das verhungert ab der zweiten. Deshalb: `refreshUserFoldersRootPermission(idb, rootId)` ist bewusst SINGULAR, das Verbinden läuft über eine Zeile mit eigenem Knopf je Gruppe ([WurzelnVerbinden.tsx](../../src/core/components/WurzelnVerbinden.tsx)), und der Sammel-Klick hat keinen Auto-Pick mehr. Non-invasiv (und damit für Mount-/Timer-Pfade erlaubt) sind nur `getUserFoldersRoots` + `queryUserFoldersRootPermissions`.

**⚠️ Dev reproduziert das oft NICHT** — Dev seedet CSV-Quellen aus Fixture-Blobs (kein echtes Handle in IDB → Stepper-Scan = leer → Auto-Skip). Handle-Bugs nur auf einem echten `file://`-Build mit real verknüpften Handles testen.

**Kanonische Datei:** [smb-handle.ts](../../src/core/services/infrastructure/smb-handle.ts) (`refreshAllPermissions`, `listPendingGrants`, `queryAllPermissions`, `grantPending`), [GuidedGrantSteps.tsx](../../src/core/components/GuidedGrantSteps.tsx), [StartupScreen.tsx](../../src/core/StartupScreen.tsx), [AppPasswordGate.tsx](../../src/core/AppPasswordGate.tsx).

---

## 3. Parallele `file://`-Varianten teilen Storage

**Symptom (historisch):** Datenverlust/Interferenz, wenn mehrere Builds (`zah-pl.html`, `zim-dashboard.html`, dev) gleichzeitig als Tabs offen waren. Konkret (Juni 2026): pl+prod+kurator parallel, Shift+Reload auf pl → `auslastung.json` von 263 KB auf 7 KB überschrieben.

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

**Maschinell erzwungen** durch den Convention-Test `no-hardcoded-canonical-field` in [conventions-daten.test.ts](../../src/__tests__/conventions-daten.test.ts): direkter `.d_xtec`/`.d_adv`-Lesezugriff ausserhalb des Resolver-Moduls ([vollstaendigkeit-felder.ts](../../src/plugins/auslastung/services/vollstaendigkeit-felder.ts)) ist verboten (Ausnahme: `// allow-canonical-field: <grund>`).

**Zweiter Fall, v4.42.0 — der Suchkorpus.** Dieselbe Wurzel, andere Stelle und deutlich groessere Reichweite: [search-corpus.ts](../../src/plugins/antraege/services/search-corpus.ts) las seine Quell-Spalten unter *geratenen* Alias-Listen (`vb_inhalt`, `org_ast`, …). Am echten Bestand gemessen lag `VB_INHALT` unter `inhalt_kurzzusammenfassung` — die alten Aliase trafen **0 von 14 225** Records, die **gesamte Projektbeschreibung** fehlte im Suchindex. Sichtbar war das nur als duenner Bestand: „Netzwerkpartner" fand im Bereich „nur Titel & Kurzbeschreibung" **0** statt 696 Antraege, und dieser Bereich suchte faktisch nur im Titel. `ORG_AST` lag je Quelle unter **drei** verschiedenen Schluesseln, einer davon in Kollision mit dem kanonischen `ORG_AFS`.

Zwei Lehren ueber Klasse 5 hinaus:

1. **Ein Alias-Kommentar ist kein Vertrag.** Der Korpus behauptete, seine Listen seien „identisch zu den `findFieldValue`-Aliasen in `TvDetailBlock.tsx`". Das Detail-View hatte `inhalt_kurzzusammenfassung` laengst nachgezogen, der Korpus nie — die Behauptung stand noch da und las sich wie eine Zusicherung.
2. **Die Reihenfolge der Aufloesung ist Teil der Regel.** Weil eine Quelle `ORG_AST` auf den Schluessel von `ORG_AFS` mappt, muss die Vergabe eine Prioritaet haben; ohne sie zeigten beide Slots auf denselben Wert und die 2,5 % der Saetze mit abweichender Rechtsperson verloeren ihre zweite Organisation — eine *Verschlechterung* durch den Fix.

Aufloesung jetzt in [korpusFeldAufloesung.ts](../../src/plugins/antraege/services/korpusFeldAufloesung.ts) (Spalten-CODE → `resolveFieldKey`, alte Listen als Fallback). Reissleine: `korpus-felder-ueber-schema` in [conventions-daten.test.ts](../../src/__tests__/conventions-daten.test.ts).

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
1. **Bevorzugt KEINE eigene Hülle bauen.** Neue Modals über den shared [`@/ui/Dialog`](../../src/ui/Dialog.tsx) (`size`-Prop `md`/`lg`) ODER den shadcn [`@/components/ui/dialog`](../../src/components/ui/dialog.tsx) (`size` `sm`/`md`/`lg`/`xl`, `align` `center`/`top`) rendern — beide bringen `max-h` + scrollenden Body + fixen Kopf/Fuß bereits mit. **Maschinell erzwungen** seit v2.81 durch den Convention-Test `no-raw-modal` ([conventions-ui.test.ts](../../src/__tests__/conventions-ui.test.ts)): `fixed inset-0` außerhalb der beiden Dialog-Dateien ist verboten — Vollbild-Zustände und Drawer per Inline-Ausnahme `// allow-raw-modal: <grund>` whitelisten.
2. **Wenn doch custom** (eigene Breite/mehrphasige Struktur nötig): Karte = `… flex flex-col max-h-[85vh] overflow-hidden`; **ein** Kind = der Body mit `flex-1 min-h-0 overflow-y-auto`; Kopf und Fuß als `shrink-0`-Geschwister bleiben fix. **vh-basiert** (nicht `%`/`vh` am Overlay) → robust, auch wenn ein Vorfahren `position:fixed` bricht. Referenz-Pattern: [KonvertierungReviewDialog.tsx:33,55](../../src/core/components/KonvertierungReviewDialog.tsx).

**Warnsignal beim Entwickeln:** Sobald Code `fixed inset-0` + eine Karten-`<div>` **ohne** `max-h`/`max-height` schreibt (oder den Scroll nur am Overlay-Backdrop hat), fehlt der Cap — der äußere Scroll ist KEIN verlässlicher Ersatz für eine interne, vh-gedeckelte Scroll-Region.

**Kanonische Dateien:** [Dialog.tsx](../../src/ui/Dialog.tsx) (shared, `size`-Prop), [dialog.tsx](../../src/components/ui/dialog.tsx) (shadcn), [KonvertierungReviewDialog.tsx](../../src/core/components/KonvertierungReviewDialog.tsx) (custom-Referenz), [AufnahmeOverlay.tsx](../../src/plugins/antraege/aufnahme-einfach/AufnahmeOverlay.tsx).

## 8. Verfügbarkeits-Ping darf die Streamlit-Bridge nicht öffnen

**Symptom:** Beim bloßen **Öffnen** einer Seite (z.B. Verbund-Detailseite mit generierten Abschnitten) poppt ungefragt ein zweiter Browser-Tab auf die interne KI-URL (`https://gpt.vdivde-it.de/`) auf. Der User hat nichts „generieren" geklickt. (v2.103.2)

**Root-Cause:** Ein rein **lesender** Verfügbarkeits-Check (`bridge.getActiveTransport().ping()` / `pingActive()`) hat einen **Fenster-Seiteneffekt**: `StreamlitBridgeTransport.ping()` ruft `ensureConnection()`, und das macht `window.open(...)`, wenn kein Bridge-Fenster-Handle existiert. Auf llama.cpp/DirectLLM fällt das nicht auf (Ping = `/v1/models`-Fetch, kein Fenster) — aber der **Default-Transport ist die Streamlit-Bridge**. Eine Mount-/Init-Probe, die „nur mal schauen, ob die KI da ist" will, öffnet so einen Tab.

**Fix-Pattern:** `ping(opts?: PingOptions)` mit `openIfNeeded` (Vorgabe `true` = altes Verhalten). **Jeder** Verfügbarkeits-Check pingt passiv (`{ openIfNeeded: false }`): er pingt nur ein bereits offenes Fenster, öffnet selbst keins und liefert ohne lebendes Handle sofort `false`. Wer die KI danach wirklich braucht, ruft **vorher** den Guard `kiVerbindungGeprueft(bridge)` ([ki-guard.ts](../../src/core/services/ai/ki-guard.ts)) — der prüft ebenfalls passiv und öffnet bei getrennter KI den **app-weiten Verbinden-Dialog** statt eines Tabs (Muster: [workflow-generierung.ts](../../src/plugins/antraege/gutachten/workflow-generierung.ts) — erst Guard, dann Ping).

Bis v4.19.0 stand hier, eine ausdrückliche Nutzer-Geste (Generieren, Testlauf) dürfe den Tab öffnen. Das ist überholt: der per `window.open` geöffnete Tab trägt **kein Bookmarklet** und beantwortet die Anfrage darum ohnehin nie — er ist nie die Hilfe, für die man ihn hielt. Faustregel jetzt: **Ein „ist die KI erreichbar?"-Check öffnet nie ein Fenster** — weder beim Rendern noch nach einem Klick. Einzige Ausnahme sind die ausdrücklichen „Verbindung testen"-Knöpfe in den Einstellungen, wo das Öffnen die gewünschte Wirkung ist.

**Warnsignal beim Entwickeln:** Jedes `ping()` ohne Argument. Prüfen: Was, wenn der aktive Transport die Streamlit-Bridge ist und noch kein Fenster offen? → passiv pingen, und den Weg zum Verbinden über den Guard anbieten.

**Maschinell erzwungen:** Guard **`kein-oeffnender-ping`** in [conventions-daten.test.ts](../../src/__tests__/conventions-daten.test.ts) — flaggt `.ping()` und `ping({ openIfNeeded: true })` in jeder Datei, die keinen `kiVerbindung*`-Guard führt (Inline-Ausnahme `// allow-oeffnender-ping: <grund>`). Dazu [streamlit-ping.test.ts](../../src/core/services/ai/__tests__/streamlit-ping.test.ts) (passiver Ping ohne Fenster → `false` UND kein `window.open`) und [turn.test.ts](../../src/plugins/chat/assistent/__tests__/turn.test.ts) (der Assistenten-Turn pingt passiv).

**Reichweite (v4.19.0):** Die Klasse stand seit v2.103.2 in diesem Doc und war trotzdem an **sechs** Stellen offen — Suchseite („Warum?"/„Alle begründen"), Assistent-Panel, Skill-Testlauf, Auslastungs-Klassifizierung, NF-Generierung und Skill-Eval-GUI. Erst der Guard hat sie eingesammelt; ein Absatz allein hat es sechsmal nicht getan.

**Kanonische Dateien:** [streamlit.ts](../../src/core/services/ai/transports/streamlit.ts) (`PingOptions`, `ping`, `ensureConnection`), [ki-guard.ts](../../src/core/services/ai/ki-guard.ts) (`kiVerbindungBereit`/`kiVerbindungGeprueft` + Verbinden-Dialog), [bridge.ts](../../src/core/services/ai/bridge.ts) (`pingActive`).

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

**Maschinell erzwungen (v2.277.1):** `no-blanket-idb-wipe` in [conventions-daten.test.ts](../../src/__tests__/conventions-daten.test.ts). Eine Datei, die unpräfixiert `idb.keys()` holt **und** `idb.delete(...)` aufruft, muss aus [setup-keys.ts](../../src/core/services/storage/setup-keys.ts) importieren (`istSetupKey`) — sonst schlägt der Test fehl. Rein lesende `keys()`-Nutzung (State-Dumps, Inspector) und bewusste Voll-Resets: Zeile mit `// allow-blanket-idb-wipe: <grund>` markieren. Präfix-gebundenes `idb.keys('doc:')` ist unkritisch und wird nicht erfasst — es kann die Setup-Keys gar nicht treffen.

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
Positivbeispielen: [prompt-audit-2026-07.md](../_archiv/prompt-audit-2026-07.md).

**Maschinell erzwungen (v2.284.1):** `keine-elidierte-wortlaut-vorgabe` in [conventions-daten.test.ts](../../src/__tests__/conventions-daten.test.ts). Unter `src/core/services/skills/` darf keine Zeile ein Literalitäts-Wort (`exakt`/`wörtlich`/`wortgetreu`) mit einem elidierten Zitat (`…` direkt vor einem schließenden Anführungszeichen) kombinieren. Eingefrorene Alt-Stände für die Migrations-Erkennung: Zeile mit `// allow-elidierte-wortlaut-vorgabe: <grund>` markieren. Rein veranschaulichende „…"-Zitate ohne Literalitäts-Forderung (z.B. `grundsatz.ts`) sind nicht erfasst.

**Kanonische Dateien:** [seed.ts](../../src/core/services/skills/registry/seed.ts) (`abschnittTemplate.pflichtAnfang`, `G_ABSCHNITT_OPTS`), [check-engine.ts](../../src/core/services/skills/registry/check-engine.ts) (`pflicht_anfang.hint`), [migrations.ts](../../src/core/services/skills/registry/migrations.ts) (`GA_PFLICHT_ANFANG_KLAR_MIGRATION`).

## 14. Fremddaten-Schlüssel ohne alle Dimensionen — Dedup frisst den Rest

**Symptom:** Ein Import „läuft durch", der Bestand ist aber ein Bruchteil der Datei. Die Warnungen lesen sich harmlos („X steht mehrfach — erster Eintrag gilt") und häufen sich auf ein paar Kürzel, die nach einem Zeichensatz-Problem aussehen (ÄQ/ÄT/ÄW). Danach zeigt die App zu jedem Datensatz *irgendetwas* — nur eben das Falsche, ohne dass irgendwo etwas rot wird.

**Root-Cause:** Der Vergleichsschlüssel lässt eine fachliche Dimension weg, die die Quelle sehr wohl führt. Gemessen (v2.380): die Trigger-Zuarbeit führt ~2450 Zeilen über **neun Richtlinien**, der Importer schlüsselte nach `(Kürzel, Folge)` — **362 Zeilen** blieben übrig, alles jenseits der ersten Richtlinie fiel als Dublette weg. Die Umlaut-Warnungen waren keine NFC-Frage, sondern programmübergreifende Kollisionen: dieselben Kürzel mit verschiedener Wirkung.

**Fix-Pattern:**
- **Die Dimension gehört in den Schlüssel, nicht daneben.** Ein optionales Feld „Richtlinie" am Datensatz, das der Schlüssel ignoriert, ist genau die Falle — der Wert ist da und wirkt trotzdem nicht.
- **Fehlt die Spalte ganz, abbrechen statt teilzuimportieren.** Ein Bestand ohne die Dimension lässt sich später keinem Datensatz zuordnen, sieht aber vollständig aus.
- **Beim Lesen kein Ersatz über die Dimensionsgrenze.** Lieber nichts zeigen und sagen, warum (`programmUnbekannt` vs. `programmOhneTrigger`), als den Nachbarn nehmen.
- **Diff-Vorschau je Dimension.** „5 neu · 2 geändert" verbirgt einen Kollaps von 2450 auf 362; „Programm 76: 528 Zeilen · Programm 139: 107" zeigt ihn sofort.
- **Bestandsdaten aus der Zeit vor der Dimension heilen, nicht raten** — leeren Wert stempeln, zählen und zum Neu-Import auffordern.
- **Warnungs-Häufung ist ein Befund, kein Rauschen.** Wenn eine Dedup-Warnung auf wenigen Schlüsseln clustert, ist meist der Schlüssel falsch — nicht die Daten.
- **Wo die Quelle eine Angabe FÜHRT, wird sie nicht aus dem Inhalt geraten.** Dieselbe Klasse eine Ebene tiefer (v2.381): das Blatt „Erklärung Parameter" nennt die Zeilenart in einer eigenen Spalte, der Import schloss sie aber aus dem Wert („ganze Zahl = Statuscode") — die Bezugsdatei-Nummern 210/211 wären als Statuscodes im Katalog gelandet, neben 30 echten. Eine Heuristik ist nur zulässig, wo die Quelle schweigt.

**Kanonische Dateien:** [trigger-import.ts](../../src/core/status/import/trigger-import.ts) (`triggerSchluessel`, `statistik`), [trigger-share.ts](../../src/core/status/trigger-share.ts) (`triggerFuerProgramm`, `heileTriggerDatei`), [parameter-blatt.ts](../../src/core/status/import/parameter-blatt.ts) (`bestimmeZeilenart`, `findeSchnitt`), [referenz-import.test.ts](../../src/core/status/__tests__/referenz-import.test.ts).

---

## 15. Zähler und Filter aus zwei Vokabularen

**Symptom:** Ein Filter-Element trägt eine Zahl, und ein Klick darauf liefert eine andere. Nicht überall — genau dort, wo die Rohwerte anders geschrieben sind als die Vergleichswerte. Gemessen im Bestand: die Status-Pille meldete „NF 2" und filterte **0** Zeilen heraus; „Abgeschl. 162" wurden 78. „Bewilligt 97" stimmte, weil der Rohwert dort zufällig kleingeschrieben ist. Nichts wird rot — die Liste sieht bloß zu kurz aus.

**Root-Cause:** Der Zähler und der Filter greifen auf **verschiedene Wertemengen** derselben Sache zu. Gezählt wurde über normalisierte Schlüssel aus einem kanonischen Helfer (`getStatusValuesByCategory` → `nf gestellt`), gefiltert über einen exakten `Set.has()`-Vergleich gegen den **CSV-Rohwert** (`NF gestellt`). Zwei korrekte Bausteine, ein falsches Bindeglied. Verschärfend: der Filter hängte zusätzlich Werte an (`sonstige`), die der Zähler nicht kannte — dieselbe Lücke in die Gegenrichtung.

**Fix-Pattern:**
- **Eine Menge, zwei Verwender.** Wer eine Zahl an eine Filter-Aktion hängt, speist beide aus derselben Funktion. Dann ist die Gleichheit strukturell, nicht getestet-und-gehofft.
- **Der Test vergleicht die Wege, nicht Erwartungszahlen.** `zähle(fixture) === filtere(fixture).length` bleibt richtig, wenn sich die Daten ändern — eine erwartete `17` nicht.
- **Filterwerte sind Rohwerte.** Kanonische Helfer liefern normalisierte Schlüssel; wer sie in einen Filter schreibt, muss den Vergleich normalisieren (siehe `normWert` in [engine.ts](../../src/core/services/csv/filter/engine.ts)) oder die amtliche Schreibweise schreiben.
- **Kein stiller Anhang.** Werte, die der Filter zusätzlich einschließt („damit nichts verschwindet"), gehören entweder in den Zähler oder gar nicht in den Filter.
- **Eine Zahl aus einem Kind-Effekt braucht einen Guard beim Elternteil.** Rendert das Kind bei null Treffern nicht, meldet es auch nichts — und die Zahl der vorigen Auswahl bleibt stehen. Die Wahrheit über „gibt es Treffer" hat das Elternteil (siehe `berechneTrefferZahl` in [trefferZahl.ts](../../src/plugins/antraege/trefferZahl.ts)).
- **Zahlen nennen ihre Einheit.** Zählt die Kopfzeile Teilvorhaben und rendert die Liste Verbund-Zeilen, ist jede Zahl für sich richtig und der Bildschirm trotzdem widersprüchlich.

**Dritte Ausprägung (v2.404): Seed gegen kuratierten Katalog.** Drei Stellen froren eine aus dem Status-Katalog abgeleitete Menge in einer Modul-Konstante ein, die beim Import lief — also **bevor** `setStatusKatalogSnapshot` den kuratierten Katalog vom Daten-Share setzt:
- Die Status-Pille (`chipStatusValues`) rechnete dauerhaft mit dem eingebauten Code-**Seed** statt dem Katalog; im echten Bestand gingen Pille und Rest der App um 15 Anträge auseinander. Fix: die Menge wird bei **jedem Aufruf** frisch aus `getStatusValuesByCategory` abgeleitet, kein Cache mehr (`[test: statusQuickChips.test.ts]`).
- `SONSTIGE_VALUES` in derselben Datei-Nachbarschaft (`phaseQuickfilter.ts`) hatte dieselbe Bauform und wurde beim Aufräumen zunächst übersehen. Sie speist die Wiedererkennung eines gespeicherten Filter-Werts; wich die kuratierte `sonstige`-Menge vom Seed ab, zeigte die Pille „Alle", während die Liste gefiltert war. Fix wie oben: bei Aufruf ableiten. **Wer eine solche Konstante findet, greppt nach den Geschwistern im selben Modul** — sie kommen selten allein.
- Der Snapshot-Bau selbst indizierte nur die Schreibweisen, die die **aktive Fassung** eines Werts führte — eine Fassung, die eine amtliche Schreibweise eines codierten Werts nicht kennt, verlor sie dauerhaft. Konkret: Code 72 stand im Bestand 15× unter der amtlichen Langform, die Fassung führte dort nur die Abkürzung → alle 15 fielen auf `sonstige` und damit aus jeder Sicht, Frist und Startseite. Fix: `mitAmtlichenSchreibweisen` ergänzt vor der Indizierung die Schreibweisen jedes codierten Eintrags um die aus dem Code-Katalog (`[test: schreibweisen-fremddaten.test.ts]`).

**Kernsatz:** Wer eine abgeleitete Menge beim Modul-Laden einfriert, friert den Stand **vor** dem Snapshot ein — der kuratierte Katalog kommt immer erst danach. Und: Schreibweisen eines codierten Werts gehören dem Code-Katalog, nicht der einzelnen Fassung (Pitfall #43) — eine Fassung darf eine Schreibweise ergänzen, aber nicht implizit verlieren.

**Kanonische Dateien:** [engine.ts](../../src/core/services/csv/filter/engine.ts) (`normWert`, `multi_select`), [phaseQuickfilter.ts](../../src/plugins/antraege/filter/phaseQuickfilter.ts) (`getPhaseItems` / `applyPhase`), [trefferZahl.ts](../../src/plugins/antraege/trefferZahl.ts), [phaseQuickfilter.test.ts](../../src/plugins/antraege/filter/__tests__/phaseQuickfilter.test.ts), [statusQuickChips.ts](../../src/plugins/antraege/filter/statusQuickChips.ts) (`chipStatusValues`), [snapshot.ts](../../src/core/status/snapshot.ts) (`mitAmtlichenSchreibweisen`), [schreibweisen-fremddaten.test.ts](../../src/core/status/__tests__/schreibweisen-fremddaten.test.ts).

---

## 16. Eine Team-Sidecar, mehrere Schreiber — der Verlust meldet sich nicht

**Symptom:** Zwei Personen pflegen dieselbe Sidecar. Beide speichern, beide sehen einen Erfolg. Später fehlt die Arbeit der einen — nicht nur überschrieben, sondern **ohne Rückweg**, weil sie auch aus der Historie der Datei verschwunden ist. Beim nächsten Start holt der Verlierer den fremden Stand und überschreibt seinen eigenen gleich mit.

**Root-Cause:** Eine Sidecar, die *den ganzen Stand* schreibt, ist für einen Schreiber gebaut. Der Schreibvorgang liest die Datei nicht, bevor er sie ersetzt; abgeleitete Größen (die nächste Versionsnummer, ein Zähler) entstehen aus dem **lokalen** Stand und kollidieren deshalb. Gemessen am Status-Katalog (v2.409): zwischen dem Startup-Abgleich und dem Schreiben lag eine **ganze Sitzung**, in der der Share nie wieder gelesen wurde.

**Fix-Pattern — drei Bauformen, je nach Datenart:**
- **Datei je Autor**, wo jeder nur eigene Zeilen beiträgt (Klärungen, Pitfall #49). `appendToFile` ist read-modify-write: auf einer gemeinsamen Datei verliert ein gleichzeitiger Schreiber seine Zeile, während der Aufruf `true` meldet.
- **Optimistische Sperre**, wo ein Lauf idempotent wiederholbar ist (Journal, Pitfall #48): Marke am Stand mitführen, unmittelbar vor dem Schreiben erneut lesen, bei Bewegung sauber benannt abbrechen (`art: 'kollision'`) statt zu werfen.
- **Read-before-write + Vereinigung der LISTE**, wo eine kuratierte Historie in einer Datei liegt (Status-Katalog, v2.409): fremde Einträge, die der lokale Cache nicht kennt, vor dem Schreiben übernehmen — **auch dann, wenn der Konflikt bewusst übergangen wird**. Das allein beseitigt den Verlust des Rückwegs.

**Und quer über alle drei:**
- **Abgeleitete Nummern nach der Vereinigung ziehen**, nie davor. Eine Nummer aus dem lokalen Maximum ist im Mehrbenutzerfall keine Nummer, sondern eine Wette.
- **Inhalte werden nie automatisch gemischt.** Vereinigt wird die Liste, nie der Eintrag — sonst entsteht ein Stand, den niemand beschlossen hat.
- **Der Konflikt gehört vor den Menschen, mit Namen und Zeitpunkt.** Stilles Blockieren ist so schlecht wie stilles Überschreiben; „später entscheiden" braucht einen sichtbaren Rest-Hinweis, sonst hält der Nutzer die Arbeit für veröffentlicht.
- **Nachsehen kostet Bytes, nicht Megabyte.** Steht die entscheidende Angabe im Kopf der Datei, reicht ein Prefix-Lesepfad (`readTextPrefix` → `leseSidecarKopf`): 4 KB statt 2,9 MB — billig genug für die späte Nachprüfung vor dem Schreiben **und** für eine Frühwarnung beim Fensterfokus. Kein Intervall: mehrere Clients, die ein SMB-Verzeichnis pollen, sind ein schlechter Nachbar.

**Kanonische Dateien:** [katalog-konflikt.ts](../../src/core/status/katalog-konflikt.ts) (`planeVereinigung`, `findeKonflikt`, `leseNummerAusKopf`), [katalog-share.ts](../../src/core/status/katalog-share.ts) (`schreibeKatalogAufShare`, `vereinigeMitShare`, `umnummeriereEigeneFassung`), [journal/lauf.ts](../../src/core/status/journal/lauf.ts) (optimistische Sperre), [klaerung-share.ts](../../src/plugins/zu-klaeren/klaerung-share.ts) (Datei je Autor), [sidecar-datei.ts](../../src/core/status/sidecar-datei.ts) (`leseSidecarKopf`).

## 17. Toleranter Leser: `null` heißt „fehlt ODER kaputt" — der Schreiber liest es als „leer"

**Symptom:** Eine Eingabe verschwindet spurlos und ohne Meldung; im Wiederholungsfall ist zusätzlich fremder Bestand weg. Gemessen am Feedback-Kommentar (v3.0.1): senden → schließen → öffnen → weg, in Datei **und** Oberfläche keine Spur.

**Root-Cause:** Die Lesehelfer dieser Codebasis sind bewusst fehlertolerant — [`readText`](../../src/core/services/infrastructure/atomic-write.ts) fängt **jeden** Fehler und liefert `null`. Für Leser ist das richtig. Ein Schreiber, der denselben Helfer nutzt, liest daraus aber „es gibt nichts Geteiltes" und baut seine Vereinigung auf einer **leeren** Basis:
1. Sein Ziel-Datensatz ist plötzlich „nicht vorhanden" → stiller Abbruch, Eingabe verworfen. Das trifft besonders Rollen, deren Datensätze NUR geteilt liegen und nie lokal (Schreibrollen legen sie nicht zusätzlich in den localStorage).
2. Schreibt er trotzdem, ersetzt sein lokaler Teilbestand den vollständigen geteilten — der Verlust ist stumm und trifft alle.

Ein transienter Lesefehler ist auf einem geteilten Laufwerk normal: ein zweiter Client mitten im `atomicWrite`, eine SMB-Aussetzer-Millisekunde. Es braucht keinen Defekt, damit `null` zurückkommt.

**Fix-Pattern:**
- **Lage statt Wert lesen.** Der schreibende Pfad braucht eine dreiwertige Auskunft — `ok` / `leer` / `unlesbar`. Seit v4.12 gibt es sie als geteiltes Primitiv: [`readTextLage`](../../src/core/services/infrastructure/atomic-write.ts) unterscheidet am Fehler-Namen (`NotFoundError` = fehlt, alles andere = unlesbar); `readText` ist nur noch seine tolerante Hülle. Darauf bauen [`leseSidecarLage`](../../src/core/status/sidecar-datei.ts), [`readSharedFileLage`](../../src/core/services/feedback/feedbackSharedFile.ts), `loadKuerzelMapLage` und `loadZugangLage` auf.
- **Kaputtes JSON zählt als `unlesbar`, nicht als `leer`.** Die Datei ist da, ihr Inhalt taugt nur gerade nicht — daraus einen Neuanfang abzuleiten ist derselbe Verlust. Dasselbe gilt für eine verfehlte Strukturprüfung.
- **Bei `unlesbar` abbrechen, nie rechnen.** Kein Merge, kein Schreiben, kein Budget-Rückbuchen. `leer` bleibt ein gültiger Startzustand.
- **Die lesende Signatur unangetastet lassen** (`readSharedFile` liefert weiter `null`) — sonst zieht der Fix eine Migration durch alle Anzeige-Pfade.
- **Fehlschlag sichtbar machen und die Eingabe stehen lassen.** Sie ist die einzige Kopie. `useAsyncAction` fängt nur *geworfene* Fehler; ein `{ok:false}`-Rückgabewert muss der Aufrufer selbst auswerten und anzeigen — Pitfall #15 deckt nur die halbe Strecke ab.

**Prüffrage beim Review:** Schreibt dieser Pfad einen Stand, den er zuvor über einen fehlertoleranten Leser geholt hat? Dann: was passiert bei `null`?

**Nachtrag v4.12 — die Klasse war beschrieben, das Werkzeug fehlte.** Diese Beschreibung stand seit v3.0.1 hier, und die Feedback-Schreiber waren sauber. Ein Cross-Cutting-Review fand die Klasse trotzdem an **vier** weiteren Stellen: Outbox-Einsammler, Kürzel-Map (Pitfall #18), MA-Zugänge, Katalog-Archiv. Ein Muster, das nur als Text existiert und in genau einem Modul implementiert ist, wird nicht übernommen — es wird übersehen. Deshalb liegt die Unterscheidung jetzt im geteilten Lese-Primitiv statt im Modul, das sie zuerst brauchte.

**Nachtrag v4.18 — auch ein LESER kann die Verwechslung nicht bezahlen.** Der Fix von v4.12 zog die
Schreiber nach; der Delta-Leser des Snapshot-Syncs blieb übrig und war der teuerste Fall von allen.
`syncAntraegeViaDelta` ([snapshot-sync.ts](../../src/core/services/csv/snapshot-sync.ts)) las die
Delta-Datei mit `readText`, machte aus `null` ein **leeres Delta**, wandte es an und schob den
Seq-Cursor weiter — die Änderungen dieses Tages waren auf dem Rechner dauerhaft weg, weil der nächste
Sync sich für aktuell hielt. Die Regel für Leser lautet also nicht „`null` ist harmlos", sondern:
**wer aus dem Gelesenen einen Fortschritt ableitet, ist ein Schreiber.** Ein Cursor, ein Wasserzeichen,
ein „erledigt"-Stempel — alles drei macht die tolerante Lesart tödlich. Bei `unlesbar` bleibt der
Cursor stehen, der Lauf meldet sich als unvollständig (`SyncResult.incomplete`), und die
Snapshot-Version wird nicht festgeschrieben.

**Schwester-Regel: nichts löschen, was man nicht gesichert hat.** Derselbe Review fand zwei Aufräumer im Fehlerpfad, die mehr zerstörten als sie verhinderten — der Snapshot-Publish löschte die bereits geschriebene `antraege.jsonl` (die einzige Datei ohne `.backup`), die Legacy-Migration die Quellordner samt der Dateien, deren Kopie gerade gescheitert war. Prüffrage: **belegt dieser Aufräumer, dass er etwas verhindert?** Wenn der Gültigkeits-Marker ohnehin zuletzt geschrieben wird, macht ein Teil-Write nichts gültig — dann ist Stehenlassen die sichere Wahl.

---

## 18. Schreiben und sofort neu laden — der Reload verwirft die offene Transaktion

**Symptom:** Eine Einstellung ist nach dem Neuladen wieder weg, **sporadisch** und nur auf langsamen Maschinen. Gemessen an der Modul-Freischaltung (v3.24.1): Zusatzpasswort eingeben → die App lädt neu → der Slot steht wieder auf „gesperrt", der Menüpunkt fehlt. Ein zweiter Versuch mit demselben Passwort klappt. Im Dev-System nie reproduzierbar.

**Root-Cause:** `IDBStore.set()` löste bis v3.24.1 bei **`req.onsuccess`** auf. Das ist der Erfolg des *Requests*, nicht der **Commit** der Transaktion — dafür gibt es nur `tx.oncomplete`. Wer direkt danach `window.location.reload()` ruft, reißt die Seite ab, während die Transaktion noch offen ist; der Browser **verwirft sie**. Kein Fehler, kein Log, kein Eintrag.

Es ist ein Wettlauf, kein Determinismus — und genau das führt bei der Diagnose in die Irre: auf der Dev-Maschine (schnell, localhost, kleine DB) gewinnt der Commit immer, unter Citrix/SMB mit großer Varianten-DB verliert er manchmal. Die Sporadik ist dabei der eigentliche Befund: **ein falsches Passwort, ein fehlender Flag oder ein Filter wären reproduzierbar.** Wenn ein zweiter Versuch hilft, ist die Ursache ein Wettlauf oder ein transienter Fehler — nicht die Konfiguration.

**Fix-Pattern:**
- **Schreiben löst erst beim Commit auf.** `tx.oncomplete` statt `req.onsuccess`, zentral in [idb-store.ts](../../src/core/services/storage/idb-store.ts) (`schreibe`) — damit sind alle Aufrufer versorgt, statt jeden Reload-Pfad einzeln zu flicken. Ablehnen muss auch `tx.onabort`: ein Abbruch feuert **kein** `onerror`, sonst tauscht der Fix stillen Datenverlust gegen stillen Hänger.
- **`await` muss echtes Warten bedeuten.** Ein Schreibvorgang im `setState`-Updater (React ruft den nicht garantiert synchron auf, in StrictMode zweimal) ist weder abwartbar noch einmalig — der Wert gehört über eine Ref aus dem Updater heraus. Fall: `updateProfile` in [useProfile.ts](../../src/core/hooks/useProfile.ts), das `is_kurator` vor dem Reload verlieren konnte.
- **Fehler nach der Erfolgsprüfung anzeigen.** In [ZusatzModuleGruppe.tsx](../../src/plugins/einstellungen/profil/ZusatzModuleGruppe.tsx) war nur „Passwort falsch." sichtbar; `freischalten.error` wurde nie gerendert. Jeder Schreibfehler sah dadurch aus wie „der Knopf tut nichts" — die Diagnose-Lücke, die den Defekt jahrelang unsichtbar hielt (Positivbeispiel im selben Repo: [AppPasswordGate.tsx](../../src/core/AppPasswordGate.tsx) rendert seinen `login.error`).

**Prüffrage beim Review:** Folgt auf einen Schreibvorgang ein `window.location.reload()` (oder ein anderer Navigations-/Unload-Pfad)? Dann: löst der Schreibvorgang beim Commit auf — und wird sein Fehler angezeigt?

**Kanonische Dateien:** [idb-store.ts](../../src/core/services/storage/idb-store.ts) (`schreibe`, `set`, `delete`), [idb-store.test.ts](../../src/core/services/storage/__tests__/idb-store.test.ts) (Regressionsgatter „Commit vor Aufloesung"), [ZusatzModuleGruppe.tsx](../../src/plugins/einstellungen/profil/ZusatzModuleGruppe.tsx), [useProfile.ts](../../src/core/hooks/useProfile.ts).


## 19. Der eigene Nachhall — ein asynchroner Schreiber überlebt sein `clearInterval`

**Symptom:** Ein Lauf über mehrere Einheiten bricht nach der ersten ab, und die Fehlermeldung nennt **den Nutzer selbst** als Blockierer. Gemessen am CSV-Auto-Refresh (v3.46.1): Banner „2 CSV-Quellen haben neue Daten" → Klick → erste Quelle importiert → statt der zweiten springt das Banner auf „1 CSV-Quelle" → erneuter Klick → „THü (PL) aktualisiert gerade (seit 0 Min). Bitte in 2-3 Min erneut versuchen." Niemand sonst war in der App. Nur auf Citrix; auf der Entwickler-Maschine lief derselbe Import durch, und auf Citrix ging es vorher tagelang gut.

**Root-Cause:** `clearInterval` verhindert nur **künftige** Durchläufe. Ein bereits gestarteter läuft weiter — sein erstes `await` war hier ein IDB-Read, der unter der Schreiblast des Imports Sekunden warten kann. Kam er nach dem `releaseLock` durch, legte er die soeben gelöschte Lock-Datei über `atomicWrite` (löscht das Ziel, benennt danach `.tmp` um) **neu an**, mit eigenem Namen und frischem Zeitstempel. Der nächste Schritt desselben Laufs lief damit gegen den eigenen Nachhall, und `acquireBuildLock` kannte kein „das bin ich selbst".

Zwei Dinge machten das jahrelang unsichtbar. Erstens war der Erfolgs-Audit-Eintrag `build_lock_release` **unabhängig davon**, ob das Löschen gegriffen hatte (der Fehler wurde zweifach geschluckt: `removeIfExists` + `.catch`) — ein liegengebliebener Lock sah im Log aus wie eine saubere Freigabe. Zweitens deckte der Code den Schaden an der einen Stelle, wo er regelmäßig auftrat, selbst zu: der Snapshot-Write nach der Schleife nahm den Lock per `forceLock`, wenn er ihn besetzt fand. Genau das steht zweimal im echten Audit-Log — **eine Sekunde nach dem eigenen Release ein `build_lock_force` gegen den eigenen Namen** (17.06. und 02.07.2026). Der Beweis lag also die ganze Zeit da; nur an der harmlosen Stelle.

Es ist ein Wettlauf: auf der Entwickler-Maschine (lokale Platte, kurze Importe) gewinnt die Freigabe fast immer, unter Citrix mit SMB-Latenz verliert sie oft genug, um die *nächste* Einheit zu treffen. „Es ging tagelang gut" ist deshalb kein Gegenbeweis, sondern das Erkennungsmerkmal.

**Fix-Pattern:**
- **Takt über einen Runner, dessen `stop()` den laufenden Durchlauf abwartet.** `startHeartbeat(idb) → { stop(): Promise<void> }` in [build-lock.ts](../../src/core/services/infrastructure/build-lock.ts); Aufräumen immer `await hb.stop()` **vor** dem Freigeben. Zusätzlich prüft der Durchlauf sein Stopp-Flag **unmittelbar** vor dem Write — beides zusammen, weil das Flag allein nur das Fenster verkleinert.
- **Löschen verifizieren statt behaupten.** Nach `removeFile` erneut lesen, einmal nachfassen, und wenn es liegen bleibt, das auch protokollieren (`build_lock_release_failed`). Ein Audit-Eintrag, den niemand geprüft hat, ist schlechter als keiner: er beendet die Suche.
- **Technische Besitz-Kennung, damit „meins" überhaupt entscheidbar ist.** `BuildLock.owner_id` je Modul-Ladung (nicht persistiert — nach einem Reload ist es absichtlich ein anderer Halter). Ein eigenes Überbleibsel wird übernommen, ein fremder Lock nicht; der Anzeigename allein reicht dafür nicht, denn derselbe Mensch in einem zweiten Fenster ist ein anderer Halter.
- **Weniger Fenster statt schnellerer Fenster.** Der Lock hängt jetzt am **Lauf**, nicht an der Einheit ([auto-refresh.ts](../../src/plugins/csv-sources-kuration/services/auto-refresh.ts)): aus N Freigabe-Fenstern wird eines. Nebenwirkung, die zählt: ein Abbruch durch einen echten Fremd-Lock passiert jetzt **vor** dem ersten Import, kann also keine gemergten-aber-unpublizierten Quellen mehr hinterlassen.

**Prüffrage beim Review:** Kann ein Durchlauf, der **vor** dem Stopp begann, **nach** dem Aufräumen noch schreiben? Und: beweist der Erfolgs-Log-Eintrag, was er behauptet?

**Kanonische Dateien:** [build-lock.ts](../../src/core/services/infrastructure/build-lock.ts), [build-lock-freigabe.test.ts](../../src/core/services/infrastructure/__tests__/build-lock-freigabe.test.ts) (Regressionsgatter inkl. Gegenprobe im alten Ablauf), [auto-refresh.ts](../../src/plugins/csv-sources-kuration/services/auto-refresh.ts), [auto-refresh-ein-lock.test.ts](../../src/plugins/csv-sources-kuration/services/__tests__/auto-refresh-ein-lock.test.ts). Verwandt: Klasse 3 (`atomicWrite`-Rennen), Klasse 16 (mehrere Schreiber auf einer Sidecar), Klasse 18 (Reload verwirft die offene Transaktion — dieselbe Familie „sporadisch = Wettlauf").


## 20. Fehlt UND ist neu — dieselbe Sache zweimal geschrieben sieht aus wie Verlust

**Symptom:** Ein Abgleich meldet gleichzeitig, dass etwas **fehlt**, und dass etwas **neu** dazugekommen ist — und zwar ungefähr gleich viel von beidem. Gemessen am CSV-Auto-Refresh (v3.47.0): alle drei Quellen der lokalen Share-Kopie blockierten mit „Spalten haben sich geändert", je 2–15 fehlende und ebenso viele neue Spalten. Die Liste liest sich als Datenverlust („`Nachrücker` ist weg"), und die naheliegende Bitte lautet dann: „gibt es einen Schalter, um das zu übergehen?"

**Root-Cause:** Es war kein Verlust. Der Export hatte sein Encoding von `windows-1252` auf UTF-8 gewechselt; unter der gespeicherten Kodierung gelesen wurde aus `Nachrücker` eben `NachrÃ¼cker`. **Fehlend und neu waren dieselbe Spalte in zwei Schreibweisen.** Das Verräterische steht in der Meldung selbst: die beiden Listen sind gleich lang und paarweise ähnlich.

Der Schalter wäre hier die falsche Antwort gewesen — und zwar gefährlich: die Kopfzeile ist nur der sichtbare Teil, mit der falschen Kodierung verstümmelt der Import **jeden Wert** im ganzen Bestand. Die Blockade tat, was sie soll; sie war nur eine Sackgasse, weil der automatische Weg die Kodierung nie neu erkannte, während der manuelle Re-Import-Dialog genau das seit je tut.

**Fix-Pattern:**
- **Vor dem Urteil die Darstellung ausschließen.** Meldet ein Abgleich Fehlen und Auftauchen zugleich, denselben Gegenstand einmal anders dekodiert/normalisiert gegenprüfen, bevor die Differenz als inhaltlich gilt.
- **Übernahme nur bei vollständiger Auflösung.** Der zweite Anlauf wird nur akzeptiert, wenn danach **nichts** mehr fehlt (`encodingHeilungTraegt`). „Etwas besser" heißt: die Ursache ist eine andere, und dann gehört der Fall vor Augen statt automatisch korrigiert.
- **Wo ein Weg schon existiert, ihn nicht nachbauen — erreichbar machen.** Die Kodierungs-Erkennung stand im Dialog, nur eben nicht im automatischen Pfad. Ein zweiter Erkenner hätte die Divergenz eingebaut.
- **Der echte Ausweg bleibt trotzdem nötig, aber benannt.** Für tatsächlich verschwundene Spalten gibt es „Trotzdem importieren" — pro Quelle, mit Spaltennamen statt Zählern, mit ausgesprochener Folge, einmalig und protokolliert. Ein persistiertes „immer ignorieren" wiederholte den Verlust ab dann unbemerkt.

**Prüffrage beim Review:** Enthält ein Diff gleichzeitig „fehlt" und „neu" in ähnlicher Menge? Dann zuerst: **ist das dasselbe Ding, anders geschrieben?**

**Kanonische Dateien:** [csv-drift-check.ts](../../src/plugins/csv-sources-kuration/services/csv-drift-check.ts) (`encodingHeilungTraegt`, `entscheideDrift`), [csv-drift-check.test.ts](../../src/plugins/csv-sources-kuration/services/__tests__/csv-drift-check.test.ts), [auto-refresh.ts](../../src/plugins/csv-sources-kuration/services/auto-refresh.ts), [parser.ts](../../src/core/services/csv/parser.ts) (`readWithEncodingFallback`). Verwandt: Klasse 15 (zwei Vokabulare für dieselbe Sache), Klasse 14 (Schlüssel ohne alle Dimensionen).

## 21. Aus einem Effekt heraus TOGGELN — im StrictMode hebt sich das auf

**Symptom:** Ein Zustand, den ein Mount-Effekt umschalten soll, bleibt genau dann unverändert, wenn die Komponente **frisch montiert**. Gemessen am Einstellungs-Redesign (v4.31): die Suche springt zu einem eingeklappten Abschnitt und soll ihn aufklappen. Innerhalb derselben Seite klappte er auf; führte der Treffer auf eine **andere** Seite, blieb er zu — obwohl Sprung, Scroll und Hervorhebung sichtbar funktionierten.

**Root-Cause:** `useEffect(() => { if (trifft) umschalten(); }, [...])` mit einem **Toggle** statt einem Setzer. React ruft Mount-Effekte im StrictMode (Development) **zweimal** auf; zwei Toggles heben sich auf. Beim Sprung innerhalb derselben Seite war die Komponente schon montiert — dort feuerte der Effekt nur einmal (Deps-Wechsel) und es sah richtig aus. **Der Unterschied zwischen „montiert schon" und „montiert neu" trennt hier funktionierend von kaputt** — und die kaputte Hälfte ist genau die, für die das Feature gedacht war.

**Fix-Pattern:**
- **Aus Effekten heraus idempotent setzen, nie toggeln.** Ein Hook, der nur `[wert, toggle]` liefert, bekommt einen dritten Rückgabewert `setzeWert(next)`; bestehende Aufrufer destrukturieren weiter zwei Werte (`useCollapsedSection`).
- **Toggle bleibt der Klick.** Umschalten ist die Semantik einer Nutzeraktion — ein Effekt kennt den gewünschten Ziel-Zustand und soll ihn benennen.
- **Nicht am Bestand messen, sondern am frischen Mount.** Wer eine Effekt-Wirkung prüft, muss den Fall herstellen, in dem die Komponente neu entsteht; sonst prüft er den einfacheren Zweig.

**Prüffrage beim Review:** Ruft ein `useEffect` eine Funktion auf, deren Name „toggle/umschalten/wechseln" heißt? Dann: Was passiert, wenn dieser Effekt zweimal läuft?

**Kanonische Dateien:** [useCollapsedSection.ts](../../src/core/hooks/useCollapsedSection.ts) (`setzeOffen`), [settings-layout.tsx](../../src/components/settings/settings-layout.tsx) (`SettingsKlappe`), [main.tsx](../../src/main.tsx) (`StrictMode`).

## 22. `filter`/`backdrop-filter`/`transform` am Wirt — `position: fixed` hört auf, das Fenster zu meinen

**Symptom:** Ein Overlay, das die ganze Seite abdecken soll (`fixed inset-0`), sitzt plötzlich im Kasten seines Vorfahren fest. Gemessen an der Feedback-Erfassung (v4.39.1): der Annotier-Modal maß **418 × 622 px** statt 1280 × 720 — exakt die Panel-Größe. Ausgelöst hat es eine Änderung, die mit Overlays nichts zu tun hatte: das Panel bekam `backdrop-filter: blur(8px)`, damit man die App durchscheinen sieht.

**Root-Cause:** `filter`, `backdrop-filter`, `transform`, `perspective`, `contain` und `will-change` machen ein Element zum **Bezugsrahmen für `position: fixed`-Nachfahren** (dieselbe Regel, die `transform` schon lange für Popover-Wirte hat). Der Nachfahre bleibt `fixed` — er meint nur nicht mehr das Fenster. Nichts wirft, nichts loggt: das Overlay ist da, nur klein. **Und der Auslöser steht in einer anderen Datei als das Symptom**, oft in einem Patch, der rein optisch gemeint war.

**Fix-Pattern:**
- **Vollflächen-Overlays per `createPortal(…, document.body)` rendern**, statt den Wirt zu entschärfen. Der Weichzeichner soll ja bleiben.
- **`Escape` in der Einfang-Phase abfangen** (`addEventListener('keydown', …, true)` + `stopImmediatePropagation`), wenn der Wirt selbst einen ESC-Handler am `window` hat — sonst schließt der Wirt mit.
- **Wer einem Container `filter`/`backdrop-filter`/`transform` gibt, sucht im Teilbaum nach `fixed`.** Ein Grep, kein Gefühl.

**Prüffrage beim Review:** Liegt zwischen dem neuen `fixed`-Overlay und `<body>` ein Element mit `transform`, `filter`, `backdrop-filter` oder `will-change`? Und umgekehrt: fügt dieser Patch eine dieser Eigenschaften **hinzu**?

**Kanonische Dateien:** [FeedbackBildLightbox.tsx](../../src/components/feedback/FeedbackBildLightbox.tsx) (Portal + ESC-Einfang), [FeedbackAnnotator.tsx](../../src/components/feedback/FeedbackAnnotator.tsx), [FeedbackPanel.tsx](../../src/components/feedback/FeedbackPanel.tsx) (`PANEL_DECKKRAFT`).

## 23. Mount-Effekt richtet einen Knoten ein, der erst später montiert

**Symptom:** Ein Element ist sichtbar da und sieht richtig aus, hat aber ein Attribut nicht, das ein Effekt ihm setzen sollte. Gemessen am Bridge-Lesezeichen (seit v4.31): der Anker stand mit `draggable="true"` in der Seite, sein `href` war `null` — Chrome zeigte beim Ziehen in die Lesezeichenleiste das Verboten-Symbol, weil ein `<a>` ohne `href` kein Link ist.

**Root-Cause:** Der Effekt lief mit `[]`-Deps beim Mount der **Eltern**-Komponente. Der Knoten selbst steckte hinter einem **bedingten Rendern** — `SettingsKlappe` montiert ihre Kinder erst beim Aufklappen (`{offen && …}`), die Klappe startete zu. Also war `ref.current` beim Effekt `null`, der Effekt tat nichts, und lief nie wieder.

Ausgelöst hat es ein **Behälter-Wechsel**: vorher lag derselbe Anker — JSX byte-identisch — in einem nativen `<details>`, und das hält seine Kinder montiert (es klappt nur optisch zu). Der Effekt fand den Knoten immer. Das Redesign tauschte `<details>` gegen die Klappe; kein einziger Effekt-Zeile änderte sich, und die stille Annahme „der Knoten steht beim Mount da" kippte.

**Warum es so lange unentdeckt blieb:** `useCollapsedSection` merkt sich den Aufgeklappt-Zustand. Wer die Klappe einmal geöffnet hat, findet sie beim nächsten Besuch offen vor — dann steht der Knoten im ersten Commit, der Effekt greift, und es funktioniert **dauerhaft**. Der Fehler trifft jeden Nutzer also genau **einmal**, beim ersten Mal, und ist danach nicht mehr reproduzierbar. Genau so wurde er gemeldet.

**Fix-Pattern:**
- **Callback-Ref statt Mount-Effekt.** Sie läuft bei jedem Montieren des Knotens und bekommt ihn als Argument — zustandsunabhängig, kein Deps-Array, das falsch sein kann.
- **Wer ein `<details>`/`hidden`/CSS-Verstecken gegen bedingtes Rendern tauscht, sucht im Teilbaum nach `ref.current`.** Ein Grep, kein Gefühl — das Symptom steht in einer anderen Datei als der Auslöser.
- **Am frischen, zugeklappten Zustand messen** (Klappen-Key aus localStorage entfernen, neu laden), nicht am eingelaufenen. Gemeinsam mit Klasse 21.

**Prüffrage beim Review:** Fasst ein `useEffect` mit `[]`-Deps ein `ref.current` an? Dann: Kann dieser Knoten hinter einem `{bedingung && …}`, einem Tab oder einem Ladezustand liegen?

**Maschinell:** Guard `dom-attribut-per-callback-ref` in [conventions-ui.test.ts](../../src/__tests__/conventions-ui.test.ts) fängt die Attribut-Variante.

**Kanonische Dateien:** [VerbindungGruppe.tsx](../../src/plugins/einstellungen/ki/VerbindungGruppe.tsx) (`setzeBookmarkletHref`), [settings-layout.tsx](../../src/components/settings/settings-layout.tsx) (`SettingsKlappe`, `{offen && …}`).
