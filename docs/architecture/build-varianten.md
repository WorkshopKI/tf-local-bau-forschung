# Build-Varianten

TeamFlow wird pro Einsatz-Kontext als eigene Variante gebaut. Configs liegen unter `configs/`:

- `configs/dev.config.json` — Developer-Build, alle Features + OpenRouter aktiv
- `configs/prod.config.json` — Produktion (End-User), nur Home + Förderanträge + Einstellungen, kein Kurator-Login
- `configs/kurator.config.json` — Produktion (Kurator-Rolle), Standard-Sidebar wie prod + Kuration-Menüs nach Login
- `configs/pl.config.json` — Produktion (Projektleitung), der volle Fach-Stack ohne Kurator-Login: Förderanträge + Auslastung + Erprobungs-Bereiche (Anfragen, Meilensteine, Förderfähigkeit, Vorgangs-Board, Status-Katalog) + Suche + Skill-Verwaltung
- `configs/as.config.json` (v2.115) — Produktion (AS-Rolle), **feature-identisch zu pl, ohne Auslastungs-Modul** (`features.auslastung` + `auslastungSelbstEintragung` + `deAnonymisierung` + `maVerwaltungPasswort` auf false); eigenes Zugangspasswort
- `configs/local.config.json` (v2.371) — **wird nie gebaut**: reine Dev-Server-Variante (`npm run dev:local`, Port 5175), die statt des Ordner-Pickers feste lokale Ordner verdrahtet. Für Sicht-Checks und automatisiertes Bedienen. `validateConfig` verbietet den `local`-Block in `variant: "production"`, das Gate `__TEAMFLOW_LOCAL_FS__` hängt an `command === 'serve'`. Siehe [local-variante.md](local-variante.md)
- `configs/_template.config.jsonc` — kommentierte Referenz (nicht direkt bauen)
- `configs/_shared.json` (v2.0.2) — **Org-weite invariante Defaults** (aktuell: `data.fixedDataSharePath` + `data.expectedFolderName`). `build-with-config.mjs` + `vite.config.ts` mergen diese Datei mit der Variant-Config via `deepMerge` aus [scripts/config-schema.mjs](../../scripts/config-schema.mjs).

Sichtbarkeits-Matrix (was steht in der Sidebar):

| Plugin (Sidebar-Name) | Flag | dev | prod | kurator (vor Login) | kurator (nach Login) | pl | as |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Förderanträge | `antraege` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auslastung | `auslastung` | ✓ | – | ○ | ○ | ✓ | – |
| E-Mail Anfragen | `anfragen` | ✓ | – | ✓ | ✓ | ✓ | ✓ |
| Fristen & Meilensteine | `meilensteinMonitoring` | ✓ | – | ✓ | ✓ | ✓ | ✓ |
| Förderfähigkeit | `mapFoerderfaehig` | ✓ | – | – | – | ✓ | ✓ |
| Vorgangs-Board | `vorgangssystem` | ✓ | – | – | – | ✓ | ✓ |
| Status-Katalog | `statusCockpit` | ✓ | – | ✓ | ✓ | ✓ | ✓ |
| Dokumente | `dokumente` | ✓ | – | – | – | – | – |
| Suche (inkl. angedocktem Chat) | `suche` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Skill-Verwaltung | `skillVerwaltung` | ✓ | – | ✓ | ✓ | ✓ | ✓ |
| Feedback | `feedback` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Einstellungen (Sidebar-Fuß) | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kurator-Toggle in Einstellungen | `kuratorMenus` | ✓ | – | ✓ | ✓ | – | – |
| Kuration-Menüs (Suchindex, Programme, CSV, DMS, Filter, Feedback, Review) | `kuratorMenus` | ✓ | – | – | ✓ | – | – |

Anfragen, Meilensteine, Förderfähigkeit, Vorgangs-Board und Status-Katalog stehen in der Sidebar-Gruppe **„In Erprobung"** (`category: 'erprobung'`, siehe [groupNavPlugins.ts](../../src/core/nav/groupNavPlugins.ts)).

○ = **Auslastung in kurator nur als „Themen-Vektoren"** (v2.56, `features.auslastungNurKorpus`): schlanker Korpus-Pflege-View zum Aktuell-Halten des Embedding-Katalogs — **kein** MA-Auslastung/Zuweisung/Kompetenzen, nur „Inkrementell" (kein Vollbuild, der bleibt dev-exklusiv). Sichtbar als Workflow-Plugin (unabhängig vom Kurator-Toggle).

Nicht in der Tabelle, weil ohne eigenen Sidebar-Eintrag: `nfNachforderungen` + `artefaktWerkbank` (Artefakt-Leiste auf der Verbund-Detailseite), `antragAufbereitung` (Vollbild-Route unter dem Verbund), `workflowEntwuerfe` (nicht freigegebene Workflows wählbar), `feedbackDelete` (Löschen in der Feedback-Verwaltung), `gutachtenKurzfassung` / `gutachtenWorkflow`. Alle sechs sind in dev, pl **und as** aktiv.

Die kurator-Variante ist der einzige Produktions-Build mit `features.kuratorMenus: true`. Sie kombiniert User-seitig einen schlanken Stack (Förderanträge + Einstellungen) mit allen Kuration-Plugins, die erst nach Aktivierung des Kurator-Toggles in den Einstellungen erscheinen.

Die **as**-Variante ist eine Kopie von **pl** ohne die Auslastungs-Domäne. Seit v2.403 ist das wieder wörtlich zu nehmen: die beiden `features`-Blöcke unterscheiden sich in **genau vier** Flags — `auslastung`, `auslastungSelbstEintragung`, `deAnonymisierung`, `maVerwaltungPasswort`, alle in as `false`. (Formal steht `kuerzelDropdown` nur in as explizit auf `true`; pl leitet es über `isKuerzelDropdownEnabled()` aus `auslastung` ab — effektiv sind beide gleich.) Alles andere ist identisch: gleicher Schreib-Build (`datenShareSchreibrecht: true`, CSV-Auto-Refresh), gleiche Gutachten-/Skill-/Artefakt-Kette, gleiche Erprobungs-Bereiche. Eigenes Zugangspasswort (`npm run set-password -- as "<pw>"`).

Diese Vier-Flag-Differenz ist **maschinell abgesichert**: [variant-drift.test.ts](../../src/config/__tests__/variant-drift.test.ts) mergt beide Configs wie der Build und vergleicht die *effektiven* Flag-Werte. Ein neues pl-Flag, das in as fehlt, macht den Test rot und nennt den Namen. Bis v2.403 fehlte dieser Vergleich — deshalb konnte as über acht Flags hinweg unbemerkt zurückfallen. Eine gewollte Abweichung wird in `ERWARTETE_ABWEICHUNGEN` eingetragen und hier mitgezogen.

`auslastung: false` nimmt as nicht nur Menüpunkt und Route, sondern auch die Ableger des Moduls außerhalb davon: die MA-Kürzel-Spalte der Antragsliste samt „Inaktive einblenden" ([AntraegeMain.tsx](../../src/plugins/antraege/AntraegeMain.tsx), [AntraegeHeader.tsx](../../src/plugins/antraege/AntraegeHeader.tsx)), das Home-Widget „Neue Anträge für dich" (liest `auslastung.json`, schreibt Übernahme-Wünsche), den Kaltstart-Download des Embedding-Korpus ([useAuslastungCorpusAutoload.ts](../../src/core/hooks/useAuslastungCorpusAutoload.ts)) und die Auslastungs-Einträge in der Feedback-Übersicht ([feedbackService.ts](../../src/core/services/feedback/feedbackService.ts)). Das ist gewollt — sonst bliebe Modul-Oberfläche für ein unerreichbares Modul stehen.

Build-Kommandos:

```bash
npm run build:dev       # → dist-single/dev/zah-dev.html
npm run build:prod      # → dist-single/zah-prod.html
npm run build:kurator   # → dist-single/zah-kurator.html
npm run build:pl        # → dist-single/zah-pl.html
npm run build:as        # → dist-single/zah-as.html (wie pl, ohne Auslastung)
npm run build:variant -- --config configs/<datei>.config.json   # beliebige Variante
npm run config-ui       # HTML-Konfigurator auf http://localhost:5174
```

Jeder Build kopiert zusätzlich `Dokumentenindex-aktualisieren.bat` neben die HTML. Das generische `dist-single/index.html` wird nach dem Umbenennen gelöscht, damit im Filesystem kein Varianten-Mix entsteht.

Testen: HTML per Doppelklick direkt in Chrome/Edge (`file://`) öffnen. Keine Console-Errors, Sidebar rendert mit dem Variant-Label, Tab-Titel passt zum `build.browserTabTitle` der Config, BuildInfo-Footer unten in der Sidebar zeigt Variant + Git-Hash + Datum.

**Sicherheits-Check**: Wenn OpenRouter in einer `variant: "production"`-Config mit festem Daten-Share-Pfad aktiviert ist, bricht `validateConfig()` den Build ab — per Design, damit keine Echt-Daten versehentlich an Cloud-APIs gehen.

**Dev-Server**: `npm run dev` lädt `DEFAULT_CONFIG` aus `scripts/config-schema.mjs` (alle Features an). Das reicht für lokales Entwickeln; für Variant-Tests immer einen der oben genannten Builds fahren und per `file://` testen.

**prebuild-Pipeline** (`npm run generate:test-assets`, läuft automatisch vor jedem Build): generiert Test-CSVs, Label-XLSX, normalisiert Fixture-Encoding und **erzeugt `src/plugins/auslastung/services/default-labels.ts`** aus `_labels/Labels PrjBsp_GPT.xlsx` via `scripts/build-default-labels.mjs`. Das generierte TS-File ist committed (Idempotenz), kann aber jederzeit über `npm run build:default-labels` regeneriert werden.

**Feature-Flag `features.auslastung`** (default false; dev/pl true): aktiviert das Auslastungs-Plugin (Sidebar + Routing). Routing-Pflicht + Modul-Detail: [docs/agents/add-plugin.md](../agents/add-plugin.md), [docs/architecture/auslastung.md](auslastung.md).

**Feature-Flags `features.maLogin` / `features.maVerwaltungPasswort`** (v2.11, default false): `maLogin` (prod/dev) erzwingt die MA-Login-Wall (Kürzel aus Passwort entschlüsselt → `useMeinKuerzel`, Pitfall #27); `maVerwaltungPasswort` (pl/dev, braucht `datenShareSchreibrecht`) blendet „Zugangspasswort generieren" ein. Detail: [docs/architecture/v2-handle-architektur.md](v2-handle-architektur.md).

**Feature-Flag `features.gutachtenKurzfassung`** (v2.68, optional, default false via `=== true`, NICHT in `requiredFlags`; dev true): blendet die KI-Kurzfassung-Sektion auf der Verbund-Detailseite ein (kein Plugin/Routing, nur `isGutachtenKurzfassungEnabled()`). Detail: [docs/architecture/gutachten-kurzfassung.md](gutachten-kurzfassung.md).

Config-Zugriff im Code:

```ts
import { runtimeConfig, buildTime, gitHash } from '@/config/runtime-config';
import { features, isOpenRouterEnabled, isFeedbackEnabled } from '@/config/feature-flags';
```

Plugin-Gating: `src/plugins.config.ts` filtert die Plugin-Liste nach `features.*`; Plugin-Autoren brauchen nichts weiter zu tun, wenn das Plugin `category: 'kuration'` oder eine der bekannten IDs hat. Neue Flags werden dort ergänzt.
