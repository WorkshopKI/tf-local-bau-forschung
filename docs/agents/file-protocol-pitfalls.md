# `file://`-Protocol-Pitfalls — Quick Reference

Die App läuft ausschließlich unter `file://` aus einer einzigen `.html`-Datei. Diese Constraints sind nicht verhandelbar und brechen bei Verstoß silent oder mit unklaren Errors. Vollständige Pitfall-Liste in `CLAUDE.md`; hier die kompakte Variante zum Quick-Lookup.

## ❌ Verboten

| Anti-Pattern | Warum kaputt | Stattdessen |
|--------------|--------------|-------------|
| `await import('./foo')` (Runtime-Lazy) | ESM-Imports unter `file://` blockiert | Bundle-Time-Import `import { foo } from './foo'` |
| `fetch('./data.json')` | Lokale Fetches scheitern unter `file://` | IndexedDB oder File System Access API |
| `new Worker('./worker.js')` | Standard-Worker-URL scheitert | `import MyWorker from './worker.js?worker&inline'` |
| `navigator.serviceWorker.register(...)` | SW unter `file://` nicht verfügbar | Komplett vermeiden |
| `localStorage.setItem('...', JSON.stringify(bigObject))` | Quota-Probleme + langsam | IndexedDB für strukturierte/große Daten |
| `BroadcastChannel` cross-origin (`file://` ↔ `http://`) | CORS scheitert | `postMessage` via `window.open()` (siehe Streamlit-Bridge) |
| `fileHandle.createWritable()` direkt mit `.write()` und Schluss | Crash-mid-write korrumpiert Datei | `atomicWrite()` aus `src/core/services/infrastructure/atomic-write.ts` |

## ✅ OK unter `file://`

- `crypto.subtle.*` (secure context)
- File System Access API (`showDirectoryPicker`, `FileSystemHandle`)
- IndexedDB
- `window.open()` + `postMessage`
- Externes `fetch()` zu `http://localhost:*` und HTTPS-Endpoints (OpenRouter, llama.cpp)

## Beim Code-Review prüfen

```bash
# Dynamische Imports (nur Bundle-Time erlaubt)
grep -rn "import\(" src --include="*.ts" --include="*.tsx" | grep -v "import.meta"

# Direkte FSW-Stream-Nutzung (nur 2 dokumentierte Ausnahmen erlaubt)
grep -rn "FileSystemWritableFileStream\|createWritable" src --include="*.ts" --include="*.tsx"

# localStorage mit komplexen Daten
grep -rn "localStorage.setItem.*JSON.stringify" src --include="*.ts" --include="*.tsx"
```

## Build-Verifikation

`npm run build:dev` produziert eine Single-File-HTML. Dev-Server (`npm run dev`) toleriert `import()` und ähnliches — Anti-Patterns fallen erst beim Single-File-Build oder beim Doppelklick-Test im Browser auf. Daher: **immer einmal `dist-single/dev/zah-dev.html` per Doppelklick öffnen** und Console prüfen.
