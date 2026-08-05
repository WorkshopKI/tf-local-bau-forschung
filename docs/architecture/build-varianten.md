# Build-Varianten

TeamFlow wird pro Einsatz-Kontext als eigene Variante gebaut. Configs liegen unter `configs/`:

- `configs/dev.config.json` — Developer-Build, alle Features + OpenRouter aktiv
- `configs/prod.config.json` — Produktion (End-User), nur Home + Förderanträge + Einstellungen, kein Zugangspasswort. Ausgabe: **`zim-dashboard.html`**
- `configs/pl.config.json` — Produktion (Team), der volle Fach-Stack. **Auslastung und Kuration liegen hier hinter je einem Zusatzpasswort** (siehe [modul-freischaltung.md](modul-freischaltung.md)); wer keins hat, sieht Förderanträge + Erprobungs-Bereiche + Suche + Skill-Verwaltung
- `configs/local.config.json` (v2.371) — **wird nie gebaut**: reine Dev-Server-Variante (`npm run dev:local`, Port 5175), die statt des Ordner-Pickers feste lokale Ordner verdrahtet. Für Sicht-Checks und automatisiertes Bedienen. `validateConfig` verbietet den `local`-Block in `variant: "production"`, das Gate `__TEAMFLOW_LOCAL_FS__` hängt an `command === 'serve'`. Siehe [local-variante.md](local-variante.md)
- `configs/_template.config.jsonc` — kommentierte Referenz (nicht direkt bauen)
- `configs/_shared.json` (v2.0.2) — **Org-weite invariante Defaults** (aktuell: `data.fixedDataSharePath` + `data.expectedFolderName`)

## Warum nur noch drei

Bis v2.x gab es fünf Varianten. `as` war „`pl` minus Auslastung", `kurator` war „schlank plus
Kuration-Menüs nach Passwort" — beide unterschieden sich von `pl` ausschließlich in Flags, der
ausgelieferte **Code war byte-gleich**. Die Trennung sparte kein Byte und kostete Pflege: `as`
fiel über zwölf Flags hinter `pl` zurück, ohne dass es jemand merkte (v2.403).

Mit v3.0 entscheidet deshalb ein **Zusatzpasswort zur Laufzeit**, was vorher ein eigener Build
entschied. Unter drei Varianten geht es nicht: `dev` braucht OpenRouter + `devFixtures` +
Demo-Daten, und `validateConfig` verbietet genau die in einer `variant: "production"`-Config;
`prod` braucht `maLogin` statt `auth` und `datenShareSchreibrecht: false`.

## Sichtbarkeits-Matrix

„pl" ist ein Build mit drei möglichen Zuständen — die Spalten sind keine Varianten mehr,
sondern Freischaltungen.

| Plugin (Sidebar-Name) | Flag | dev | prod | pl (gesperrt) | pl +Auslastung | pl +Kuration |
| --- | --- | --- | --- | --- | --- | --- |
| Home | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Förderanträge | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auslastung | `auslastung` | ✓ | – | – | ✓ | – |
| E-Mail Anfragen | `anfragen` | ✓ | – | ✓ | ✓ | ✓ |
| Fristen & Meilensteine | `meilensteinMonitoring` | ✓ | – | ✓ | ✓ | ✓ |
| Förderfähigkeit | `mapFoerderfaehig` | ✓ | – | ✓ | ✓ | ✓ |
| Vorgangs-Board | `vorgangssystem` | ✓ | – | ✓ | ✓ | ✓ |
| Vorgangs-Regeln | `statusCockpit` | ✓ | – | ✓ | ✓ | ✓ |
| Dokumente | `dokumente` | ✓ | – | – | – | – |
| Suche (inkl. angedocktem Chat) | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Skill-Verwaltung | `skillVerwaltung` | ✓ | – | ✓ | ✓ | ✓ |
| Feedback | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Einstellungen (Sidebar-Fuß) | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kuration-Menüs (Suchindex, Programme, CSV, DMS, Filter, Review) | `kuratorMenus` | ✓ | – | – | – | ✓ |

Anfragen, Meilensteine, Förderfähigkeit, Vorgangs-Board und Vorgangs-Regeln stehen in der
Sidebar-Gruppe **„In Erprobung"** (`category: 'erprobung'`, siehe
[groupNavPlugins.ts](../../src/core/nav/groupNavPlugins.ts)).

Nicht in der Tabelle, weil ohne eigenen Sidebar-Eintrag: `nfNachforderungen` +
`artefaktWerkbank` (Artefakt-Leiste auf der Verbund-Detailseite), `antragAufbereitung`
(Vollbild-Route unter dem Verbund), `workflowEntwuerfe`, `feedbackDelete`,
`gutachtenKurzfassung` / `gutachtenWorkflow`. Alle in dev **und pl** aktiv.

`auslastung` gesperrt nimmt nicht nur Menüpunkt und Route, sondern auch die Ableger des Moduls
außerhalb davon: die MA-Kürzel-Spalte der Antragsliste samt „Inaktive einblenden"
([AntraegeMain.tsx](../../src/plugins/antraege/AntraegeMain.tsx),
[AntraegeHeader.tsx](../../src/plugins/antraege/AntraegeHeader.tsx)), den Kaltstart-Download des
Embedding-Korpus ([useAuslastungCorpusAutoload.ts](../../src/core/hooks/useAuslastungCorpusAutoload.ts))
und die Auslastungs-Einträge in der Feedback-Übersicht
([feedbackService.ts](../../src/core/services/feedback/feedbackService.ts)). Das ist gewollt —
sonst bliebe Modul-Oberfläche für ein unerreichbares Modul stehen. Die **Selbsteintragung** auf
der Startseite bleibt dagegen offen: sie ist die Endnutzer-Seite und funktioniert auch in prod.

## Configs enthalten nur Abweichungen

Seit v3.0 legt `build-with-config.mjs` eine **neutrale Basis** unter Shared- und Variant-Config
(`buildBasis()` in [config-schema.mjs](../../scripts/config-schema.mjs)): alle Features aus,
restriktive Daten-Defaults, kein Passwort. Eine Variant-Config führt deshalb nur noch auf, was
sie vom Standard unterscheidet, und `requiredFlags` beschränkt sich auf die sechs
zugriffsrelevanten (`kuratorMenus`, `devFixtures`, `auslastung`, `datenShareSchreibrecht`,
`maLogin`, `dokumentenscan`).

Bewusst **nicht** `DEFAULT_CONFIG` als Basis: das ist die Dev-Server-Config, in der vieles
absichtlich an ist — als Basis unter `prod` gelegt schaltete sie dort 14 Flags still ein,
darunter `devFixtures` und `maLogin`.

## Build-Kommandos

```bash
npm run build:dev       # → dist-single/dev/zah-dev.html
npm run build:pl        # → dist-single/zah-pl.html
npm run build:prod      # → dist-single/zim-dashboard.html
npm run build:all       # alle drei
npm run build:variant -- --config configs/<datei>.config.json   # beliebige Variante
npm run config-ui       # HTML-Konfigurator auf http://localhost:5174
```

Jeder Build kopiert zusätzlich `Dokumentenindex-aktualisieren.bat` neben die HTML. Das generische
`dist-single/index.html` wird nach dem Umbenennen gelöscht, damit im Filesystem kein
Varianten-Mix entsteht.

Testen: HTML per Doppelklick direkt in Chrome/Edge (`file://`) öffnen. Keine Console-Errors,
Sidebar rendert mit dem Variant-Label, Tab-Titel passt zum `build.browserTabTitle` der Config,
BuildInfo-Footer unten in der Sidebar zeigt Variant + Git-Hash + Datum.

**Sicherheits-Check**: Wenn OpenRouter in einer `variant: "production"`-Config mit festem
Daten-Share-Pfad aktiviert ist, bricht `validateConfig()` den Build ab — per Design, damit keine
Echt-Daten versehentlich an Cloud-APIs gehen.

**Dev-Server**: `npm run dev` lädt `DEFAULT_CONFIG` aus `scripts/config-schema.mjs` (alle
Features an). Das reicht für lokales Entwickeln; für Variant-Tests immer einen der oben
genannten Builds fahren und per `file://` testen.

**prebuild-Pipeline** (`npm run generate:test-assets`, läuft automatisch vor jedem Build):
generiert Test-CSVs, Label-XLSX, normalisiert Fixture-Encoding und **erzeugt
`src/plugins/auslastung/services/default-labels.ts`** aus `_labels/Labels PrjBsp_GPT.xlsx` via
`scripts/build-default-labels.mjs`. Das generierte TS-File ist committed (Idempotenz), kann aber
jederzeit über `npm run build:default-labels` regeneriert werden.

## Passwörter

```bash
npm run set-password -- pl "<pw>"                        # App-Wall (auth)
npm run set-password -- pl --modul auslastung "<pw>"     # Modul-Schloss
npm run set-password -- pl --modul kurator "<pw>"        # Modul-Schloss
```

Nur der Verifier wird committet, nie das Klartext-Passwort. Ein Passwortwechsel erfordert einen
Rebuild (Pitfall #28). `dev` teilt sich den `auth`-Block mit `pl`.

Config-Zugriff im Code:

```ts
import { runtimeConfig, buildTime, gitHash } from '@/config/runtime-config';
import { features, isOpenRouterEnabled, hatModulSchloss } from '@/config/feature-flags';
import { isAuslastungFreigeschaltet, isKuratorFreigeschaltet } from '@/core/modul-freischaltung';
```

Plugin-Gating: `src/plugins.config.ts` filtert die Plugin-Liste nach `features.*` (Bauzeit),
`ShellLayout` zusätzlich nach `kuratorOnly` und `modulSchloss` (Laufzeit).
