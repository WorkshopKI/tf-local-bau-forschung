# Build-Varianten

TeamFlow wird pro Einsatz-Kontext als eigene Variante gebaut. Configs liegen unter `configs/`:

- `configs/dev.config.json` — Developer-Build, alle Features + OpenRouter aktiv
- `configs/prod.config.json` — Produktion (End-User), nur Home + Förderanträge + Einstellungen, kein Kurator-Login
- `configs/kurator.config.json` — Produktion (Kurator-Rolle), Standard-Sidebar wie prod + Kuration-Menüs nach Login
- `configs/pl.config.json` — Produktion (Projektleitung), Home + Förderanträge + Auslastung + Einstellungen, kein Kurator-Login
- `configs/as.config.json` (v2.115) — Produktion (AS-Rolle), **wie pl, aber ohne Auslastungs-Modul** (`features.auslastung` + `auslastungSelbstEintragung` + `deAnonymisierung` + `maVerwaltungPasswort` auf false); eigenes Zugangspasswort
- `configs/_template.config.jsonc` — kommentierte Referenz (nicht direkt bauen)
- `configs/_shared.json` (v2.0.2) — **Org-weite invariante Defaults** (aktuell: `data.fixedDataSharePath` + `data.expectedFolderName`). `build-with-config.mjs` + `vite.config.ts` mergen diese Datei mit der Variant-Config via `deepMerge` aus [scripts/config-schema.mjs](../../scripts/config-schema.mjs).

Sichtbarkeits-Matrix (was steht in der Sidebar):

| Plugin | dev | prod | kurator (vor Login) | kurator (nach Login) | pl | as |
| --- | --- | --- | --- | --- | --- | --- |
| Home | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Förderanträge | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auslastung | ✓ | – | ○ | ○ | ✓ | – |
| Dokumente | ✓ | – | – | – | – | – |
| Suche | ✓ | – | ✓ | ✓ | ✓ | ✓ |
| Chat | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Feedback Übersicht | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Einstellungen | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kurator-Toggle in Einstellungen | ✓ | – | ✓ | ✓ | – | – |
| Kuration-Menüs (Suchindex, Programme, CSV, DMS, Filter, Feedback, Review) | ✓ | – | – | ✓ | – | – |

○ = **Auslastung in kurator nur als „Themen-Vektoren"** (v2.56, `features.auslastungNurKorpus`): schlanker Korpus-Pflege-View zum Aktuell-Halten des Embedding-Katalogs — **kein** MA-Auslastung/Zuweisung/Kompetenzen, nur „Inkrementell" (kein Vollbuild, der bleibt dev-exklusiv). Sichtbar als Workflow-Plugin (unabhängig vom Kurator-Toggle).

Die kurator-Variante ist der einzige Produktions-Build mit `features.kuratorMenus: true`. Sie kombiniert User-seitig einen schlanken Stack (Förderanträge + Einstellungen) mit allen Kuration-Plugins, die erst nach Aktivierung des Kurator-Toggles in den Einstellungen erscheinen.

Die **as**-Variante ist eine Kopie von **pl** ohne die Auslastungs-Domäne — gleicher Schreib-Build (`datenShareSchreibrecht: true`, Gutachten/Skills, CSV-Auto-Refresh, Passwort-Gate), aber `features.auslastung` + `auslastungSelbstEintragung` (Startseiten-Selbsteintragung) auf `false`; die nur im Modul wirksamen Flags `deAnonymisierung` + `maVerwaltungPasswort` ebenfalls `false`. Eigenes Zugangspasswort (`npm run set-password -- as "<pw>"`).

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
