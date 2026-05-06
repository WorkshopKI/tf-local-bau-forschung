# Agent-Cheatsheets

Kompakte Checklisten für häufige Erweiterungen, die jeweils mehrere synchronisierte Touch-Points haben. Ein Coding-Agent (Claude Code, Subagent) sollte vor einer solchen Erweiterung die zugehörige Datei lesen, statt die Codebase neu zu scannen.

| Aufgabe | Cheatsheet |
|---------|------------|
| Neues Plugin anlegen | [add-plugin.md](add-plugin.md) |
| Neues CSV-Standardfeld (`CanonicalField`) | [add-csv-field.md](add-csv-field.md) |
| Neuer Phase-2 doc_type | [add-doc-type.md](add-doc-type.md) |
| Neuer Feature-Flag | [add-feature-flag.md](add-feature-flag.md) |
| Neuer IndexedDB-Store | [add-idb-store.md](add-idb-store.md) |
| `file://`-Pitfalls (kompakte Quick-Reference) | [file-protocol-pitfalls.md](file-protocol-pitfalls.md) |

## Wann nicht aktualisieren

Die Cheatsheets sind **bewusst kurz** — keine Code-Beispiele, keine Erklärungen, nur Touch-Point-Listen. Wenn ein Pfad sich ändert oder ein neuer Touch-Point dazukommt, hier eintragen. Wenn nur Logik in einer bereits gelisteten Datei sich ändert, **nicht** anfassen.

## Voraussetzungen für jeden Patch

Vor jedem nicht-trivialen Patch:

```bash
npm run check          # typecheck + test + build:dev in einem Aufruf
```

Oder einzeln:

```bash
npm run typecheck      # keine neuen Type-Fehler
npm run test           # alle Tests grün (= vitest run)
npm run build:dev      # Single-File-Build erfolgreich
```

Verifikation per Doppelklick auf `dist-single/teamflow-dev.html` in Chrome/Edge — keine Console-Errors.

`build:demo` und `build:foerderprogramm` **nicht** routinemäßig mit-bauen — nur bei strukturellen Änderungen an Variant-Configs. Siehe `CLAUDE.md` → Build-Varianten.
