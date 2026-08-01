# Variante „local" — App ohne Ordner-Picker

Entwickler-Variante, die die App mit **echten Daten** startet, ohne einen einzigen
Browser-Dialog. Damit kann Claude Code (oder jede andere Automation) die App
öffnen, navigieren, klicken, die Konsole lesen und Screenshots machen.

> **Kein Ersatz für den `file://`-Smoke.** Der Dev-Server ist permissiver als ein
> Single-File-Build — Verstöße gegen die `file://`-Constraints (dynamische
> Imports, rohe Worker, relative `fetch`) fallen hier **nicht** auf. Der Handtest
> nach `npm run build:dev` bleibt Pflicht.

## Abnahme-Regel: wer prüft was

Seit es diese Variante gibt, ist der Sicht-Check **Aufgabe des Agenten**, nicht
des Nutzers. Die Regel steht in [CLAUDE.md](../../CLAUDE.md#abnahme-selbst-ansehen-nicht-ansagen);
hier die Trennlinie im Detail.

**Claude Code prüft selbst** — ohne Rückfrage, als Teil der Änderung:

| Klasse | Wie |
|---|---|
| Texte, Beschriftungen, Zahlen | `read_page` / `get_page_text` gegen die konkrete Zeichenkette |
| Layout, Abstände, Abschneiden | Screenshot + `scrollWidth > clientWidth`-Messung im DOM |
| Interaktion (Klick, Filter, Navigation) | `computer`-Klick → `read_page`, Route über `location.hash` |
| Zustände nach Reload | `location.reload()` + `await window.__tf.bereit()` |
| Persistenz | Wert direkt aus `localStorage` / der Varianten-IDB lesen |
| Konsolen-Sauberkeit | `window.__tf.fehler()` **muss 0 sein** |
| Dark Mode, Responsive | `resize_window({colorScheme})` / `({preset})` |

**Beim Nutzer bleibt** — hier zeigt der Dev-Server das Problem gar nicht:

- **`file://`-Betrieb**: Single-File-Build, dynamische Importe, rohe Worker,
  relative `fetch`, Service-Worker, Bundle- und WASM-Größe. Der Dev-Server
  serviert über HTTP und lädt Module einzeln — ein Verstoß fällt erst beim
  Doppelklick auf `dist-single/dev/zah-dev.html` auf.
- **Der FSAPI-Ordner-Picker** und alle Berechtigungs-Dialoge: genau die Schicht,
  die diese Variante ersetzt. Wer sie ändert, hat sie hier nicht unter Test.
- **Echte Team-Schreibpfade** auf dem SMB-Share (Sidecars, Backups, Presence
  über mehrere Nutzer): die lokale Kopie hat nur einen Nutzer.
- **Kaltstart-Verhalten unter Citrix**, Netzlaufwerk-Latenzen, Multi-Varianten-
  Parallelbetrieb.

Fällt eine Änderung in eine dieser Klassen, wird sie **benannt** — mit dem
konkreten Grund und dem Kommando (`npm run build:dev` + Doppelklick). Ein
pauschales „bitte manuell testen" ersetzt den Sicht-Check nicht.

### Fallstricke beim automatisierten Prüfen

1. **`resize_window` feuert kein `resize`-Event.** Breakpoint-Logik greift erst
   nach `window.dispatchEvent(new Event('resize'))`. Ohne das sieht man
   Fenster-abhängiges Verhalten nie.
2. **Zwei `location.reload()` kurz hintereinander** erzeugen einen Schwall
   `IDBStore not opened` — abgebrochene In-Flight-Reads, kein Bug. Vor dem
   Fehlerzählen **einmal** sauber neu laden und `bereit()` abwarten.
3. **Aus dem Bild vermuten, per DOM belegen.** Screenshots in Pane-Auflösung
   erzeugen Phantom-Befunde (scheinbar verrutschte Legenden, doppelte Labels).
   Vor dem Melden mit `getBoundingClientRect` / `querySelectorAll` gegenrechnen.
4. **Screenshots brauchen ein sichtbares Browser-Pane**; `read_page`,
   `javascript_tool` und die Konsolen-Werkzeuge laufen unabhängig davon.
5. **Tastenkürzel des Panes kommen nicht zuverlässig an.** `computer{action:
   'key'}` schluckte `ctrl+slash` ganz und eine Wiederholung von
   `ctrl+shift+d` still. Verlässlich ist der synthetische Weg — der
   `keyboardService` hängt am `document`:
   `document.dispatchEvent(new KeyboardEvent('keydown', {key: '/', code: 'Slash', ctrlKey: true, bubbles: true, cancelable: true}))`.
   `defaultPrevented === true` in der Rückgabe beweist, dass die App den
   Griff angenommen hat.
6. **`getBoundingClientRect()` lügt am Pane-Rand.** Gemessen: `aside` meldete
   52 px, während `getAttribute('style')` `width: 220px` sagte und 21
   beschriftete Nav-Knöpfe im DOM standen (einmal auch andersherum). Für
   Breiten die Inline-Style-Zeichenkette lesen, für Zustände Elemente zählen.
7. **`appVersion` friert beim Serverstart ein.** Der Wert kommt aus einem
   Vite-`define`; nach `npm run version:bump` zeigt der Fuß der Seitenleiste
   die alte Version, bis `dev:local` neu gestartet wird. Kein Befund.

## Warum

Der Ordner-Picker der File System Access API ist per Browser-Sicherheit nicht
skriptbar. Ohne `FileSystemDirectoryHandle` bleibt die App im WelcomeScreen
([App.tsx](../../src/core/App.tsx)) stehen — jede visuelle Prüfung war deshalb
Handarbeit. Auf der Entwickler-Maschine liegt aber eine vollständige Kopie des
SMB-Shares in festen Ordnern. Die Variante verdrahtet genau diese.

## Benutzung

```bash
npm run dev:local
```

Startet Vite auf **Port 5175** (der normale `npm run dev` bleibt auf 5173, beide
laufen parallel). Die App landet ohne Zwischenschritt auf Home.

`.claude/launch.json` kennt die Konfiguration `local` — im Browser-Pane genügt
`preview_start({name: "local"})`.

### Ablauf für einen Sicht-Check

```js
await window.__tf.bereit();          // wartet auf Mount UND datenPhase === 'done'
window.__tf.navigiere('/antraege');
window.__tf.fehler();                // gesammelte console.error seit Seitenstart
```

`bereit()` ist die wichtigste Funktion: ohne den `datenPhase`-Anteil
fotografiert die Automation eine leere Tabelle, während der Startup-Datenlauf
noch läuft.

## Architektur

Ein dev-only Vite-Plugin legt eine schmale HTTP-API über die festen Ordner
(Node `fs`); ein Client-Adapter implementiert dagegen das FSAPI-Subset und wird
an **einer** Stelle eingehängt: `readAll()` in
[smb-handle.ts](../../src/core/services/infrastructure/smb-handle.ts).

Das trägt, weil der gesamte Infrastructure-Layer nur ein duck-typed FSAPI-Subset
spricht ([atomic-write.ts](../../src/core/services/infrastructure/atomic-write.ts))
und `readAll` die einzige Lesestelle der `smb-handles`-Map ist — alle fünf Getter
und damit ~240 Call-Sites laufen dort durch. Die synthetischen Handles melden
`queryPermission → 'granted'`, wodurch `listPendingGrants` leer bleibt und der
StartupScreen sich selbst weiterfährt.

```
Browser                          │ Node (nur Dev-Server)
─────────────────────────────────┼──────────────────────────────
verzeichnis-handle.ts            │ scripts/local-fs/plugin.ts
datei-handle.ts                  │   → handler.ts  (fs-Operationen)
writable-puffer.ts   (pure)      │   → pfad-guard.ts (Stufen 2+3)
transport.ts  ──── HTTP ─────────┼──→ schreib-mutex.ts
slots.ts / boot.ts               │
      pfad-segmente.ts + protokoll.ts  (pure, BEIDE Seiten)
```

### Drei Sicherheitsschichten

Der Zweig darf niemals in einer ausgelieferten Variante landen:

1. **`command === 'serve'`** — `__TEAMFLOW_LOCAL_FS__` in
   [vite.config.ts](../../vite.config.ts) hängt daran. Jedes `vite build` faltet
   die Konstante auf `false`, Rollup eliminiert den Zweig. Das Plugin selbst ist
   `apply: 'serve'`.
2. **`validateConfig`** bricht KRITISCH ab, wenn ein `local`-Block in einer
   `variant: "production"`-Config steht ([config-schema.mjs](../../scripts/config-schema.mjs)).
3. **Convention-Test** `local-fs-gate-eingegrenzt` hält das Define auf den
   Adapter und die benannten Einhängepunkte begrenzt.

Verifiziert: `npm run build:prod` enthält weder `installiereTfHook` noch
`TF_LOKAL_BRAND`, `__tf-local-fs`, `lokalerSlotHandle` oder `pruefeSegmente`.
(Die fünf `__tf`-Treffer im Bundle sind das vorbestehende `__tfLoaderCleanup`.)

### HTTP-API (Präfix `/__tf-local-fs`)

Der Client kennt **nie** einen absoluten Pfad. Er adressiert
`?root=<slot>&path=<relativ>`; die Zuordnung Slot → Ordner liegt ausschließlich
serverseitig. Traversal ist damit nicht gefiltert, sondern nicht ausdrückbar.

| Verb | Pfad | Semantik |
|---|---|---|
| `GET` | `/roots` · `/stat` · `/list` · `/read` | Slots, Metadaten, Listing, Bytes (gestreamt) |
| `POST` | `/write[&keep=1&position=N]` | ersetzen bzw. positioniert anhängen |
| `POST` | `/truncate` · `/mkdir` · `/remove[&recursive=1]` · `/move` | `move` = echtes `fs.rename` |

Binärdaten gehen roh durch Body/Response, nie base64. Der Pfad-Guard ist
dreistufig: reine Segment-Prüfung
([pfad-segmente.ts](../../src/core/services/infrastructure/local-fs/pfad-segmente.ts)),
lexikalische Wurzel-Prüfung, `realpath`-Recheck gegen Symlinks und Junctions.
Zusätzlich: nur Loopback, Origin-Check, Per-Pfad-Mutex.

**Fehler-Mapping ist load-bearing**, kein Detail: der App-Code steuert über den
*Wurf*, nicht über Rückgabewerte. 404 → `NotFoundError`, 409 → `TypeMismatchError`
bzw. `InvalidModificationError`, 400 → `TypeError`, Netzwerk → `NotReadableError`.
Ein Transportfehler darf **nie** als `NotFoundError` ankommen — sonst liest
`atomic-write.ts` einen abgestürzten Server als „die Datei gibt es halt nicht".

### Slots

| Slot | Config-Feld | Inhalt |
|---|---|---|
| `daten-share` | `datenShare` | `programm/`, `_intern/`, `backups/` |
| `persoenlich` | `persoenlich` | Home des Users; die App navigiert selbst nach `ZAH/` |
| `user-folders-root` | `userFoldersRoot` | Wurzel der Home-Laufwerke (Kinder = User) |
| `csv-source-dir` | `csvSourceDir` | CSV-Quelldateien (eigener IDB-Key) |
| `gutachten-vorlagen` | `vorlagenDir` | DOCX-Vorlagen (eigener IDB-Key) |
| `dms-source-<id>` | `dmsSources` | DMS-Quellen |

Die Slot-Namen sind bewusst identisch mit den `SMB_HANDLE_*`-Konstanten aus
[types.ts](../../src/core/services/infrastructure/types.ts) — so setzt `slots.ts`
die Handles ohne Übersetzungstabelle in die Map.

Der Legacy-Slot `dokumentenquelle` wird **nie** synthetisiert: sonst zöge
`migrateLegacyDmsSource` bei jedem Start einen Map-Rückschrieb.

## Fallstricke

1. **`writeAll` muss die Fakes strippen.** Fake-Handles tragen Methoden und sind
   nicht structured-cloneable — `idb.set('smb-handles', …)` würfe `DataCloneError`,
   auf einem Pfad der bei *jedem* Start läuft und den Fehler nur als
   `console.warn` zeigt. Deshalb `mitLokalenHandles` beim Lesen **und**
   `ohneLokaleHandles` beim Schreiben. Kontrolle: der IDB-Key `smb-handles`
   bleibt im Betrieb leer.
2. **Profil-Seed vor dem Onboarding-Gate.** `App.tsx` prüft
   `onboarding-complete`, *bevor* es das Handle-Gate auswertet — die frische
   Varianten-IDB landete sonst im Onboarding-Formular.
3. **`bearbeiter_kuerzel: 'alle'`.** Ein erfundenes Kürzel filtert die
   Anträgeliste und das Home-Dashboard auf null, obwohl 14.000 Datensätze
   geladen sind. `'alle'` ist der dafür vorgesehene Spezialwert.
4. **Drei Iterationsprotokolle.** Neben `values()` nutzt
   [snapshot.ts](../../src/core/services/csv/snapshot.ts) **`keys()`** —
   feature-detected, fehlt es, degradiert es *still* zu verwaisten
   `antraege.delta.*`-Dateien. `csv-source-handle.ts` und `scan-roots.ts` nutzen
   `entries()`. Und die Einträge müssen **volle Handles** sein: `vorlagen-quelle.ts`
   ruft `entry.getFile()` direkt darauf, `migration.ts` rekursiert.
5. **`Blob` hat eine `.type`-Property.** Ein `'type' in chunk`-Test hält jeden
   Blob für ein FSAPI-Kommando-Objekt — und `atomic-write.ts` reicht Blobs durch
   (`fallbackRename`, `writeData`). `istKommando` prüft deshalb gegen die drei
   bekannten Kommandos und schließt Blob/TypedArray explizit aus.
6. **Kalter Erststart.** Die Varianten-IDB `teamflow-zah-local` startet leer:
   `ensureListViewProjection` + voller Snapshot-Load. Rechne mit 30–60 s; danach
   ist `bereit()` in ~4 s durch. Orama-Index und Embedding-Caches sind
   maschinen-lokal und ebenfalls leer — die Suche meldet „kein Index" und der
   Aufbau bräuchte das ~200-MB-Modell. **Nicht** aus einer Automation triggern.
7. **Writes gehen in die Kopie.** Sie ist Arbeitsmaterial, kein Archiv. Vor
   einem Lauf, dessen Ergebnis zählt, eine Sicherungskopie ziehen.

## Gemessen (Juli 2026, lokale Kopie mit 14.221 Anträgen)

| Vorgang | Zeit |
|---|---|
| `/stat` | 3–8 ms |
| `/read` 13,4 MB CSV | 68 ms |
| `/read` 67 MB CSV | 188 ms (~356 MB/s) |
| `__tf.bereit()` bei warmer IDB | ~3,7 s |

Der eager-`getFile()`-Pfad ist damit unkritisch; ein Lazy-File über `/stat`
wurde erwogen und ist nicht nötig.

Die Umlaut-Frage (NFC vs. NFD) ist empirisch geklärt: der Ordner `Hübsch` liegt
als **NFC** auf der Platte, und `pruefeSegmente` normalisiert eingehende Pfade
auf NFC — eine NFD-Anfrage findet den Ordner also ebenfalls.

## Konfiguration

[configs/local.config.json](../../configs/local.config.json). Die vier
Abweichungen von `dev.config.json`, die beißen:

- `fixedDataSharePath: null` + `expectedFolderName: null` — sonst mergt
  `_shared.json` den N:\-Pfad und den Ordnernamen-Check zurück.
- **kein `auth`-Block** — `dev.config.json` hat salt+verifier; mitkopiert stünde
  eine Passwort-Wall vor dem Start.
- `maLogin: false` — die Share-Kopie enthält `_intern/auslastung-zugang.enc`,
  das sonst das MaLoginGate auslöst.
- `demoDataBundled: false` — sonst seedet `seedTestData` Fixtures in die echte Kopie.

Pfade ändern: Datei anpassen und den Dev-Server **neu starten** — die Config wird
beim Start einmal als `TEAMFLOW_CONFIG` eingefroren, HMR reicht nicht.
