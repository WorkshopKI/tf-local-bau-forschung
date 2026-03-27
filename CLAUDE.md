# CLAUDE.md — TeamFlow Local App

## Project Overview

TeamFlow Local is a serverless browser app for collaborative task management with AI integration, deployed exclusively via file server (`file://` protocol). Two departments (building permits / research grants) manage workflows, generate artifacts, and use AI-powered search — all without IT infrastructure.

**Read `ARCHITECTURE.md` for full technical details before making any architectural decisions.**

## Critical Constraints

- **DEPLOYMENT**: App runs from `file://` protocol — NO HTTP server, NO backend, NO Node.js at runtime
- **SINGLE FILE BUILD**: Production build MUST compile to ONE `index.html` via `vite-plugin-singlefile`
- **NO CHROME FLAGS**: App must work in standard Chrome/Edge without `--allow-file-access-from-files` or any other flags
- **WEB WORKERS**: Must use Vite `?worker&inline` imports (Blob URL) — never `new Worker('./file.js')`
- **NO ES MODULE IMPORTS AT RUNTIME**: Everything must be bundled — `file://` blocks ES module imports
- **NO RELATIVE FETCH**: `fetch('./data.json')` fails under `file://` — all data via IndexedDB or File System Access API
- **NO SERVICE WORKERS**: Not available under `file://`
- **NO localStorage**: Use IndexedDB instead (works under `file://`)

## Tech Stack

- **Framework**: React 19 + ReactDOM + TypeScript
- **Build**: Vite + `vite-plugin-singlefile` + `@vitejs/plugin-react`
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite` — utility classes + CSS custom properties for theming
- **State**: Zustand (persisted to IndexedDB)
- **AI (Phase 2)**: Vercel AI SDK (`@ai-sdk/react` useChat with custom transports)
- **Icons**: lucide-react (tree-shakeable)

## Architecture Principles

### File Size Limit
**Every source file MUST stay under 300 lines.** Split larger files into focused modules. This ensures LLM context compatibility and maintainability.

### Plugin System
Every major feature is a plugin in `src/plugins/{name}/`. Each plugin exports a `TeamFlowPlugin` object:

```typescript
interface TeamFlowPlugin {
  id: string;
  name: string;           // Sidebar label
  icon: string;           // Lucide icon name
  category: 'workflow' | 'tools' | 'admin';
  order: number;          // Sidebar sort order
  component: ComponentType;
  adminOnly?: boolean;
  badge?: () => number | null;
  onInit?: (services: CoreServices) => Promise<void>;
}
```

Plugins are registered in `src/plugins.config.ts`. Build-time filtering via `VITE_PLUGINS` env var.

### Storage Dual-Layer
- **IndexedDB**: Fast cache, embedding vectors, ONNX model cache, UI state, FS handle persistence
- **File System Access API**: Permanent storage on shared file server — vorgaenge, artifacts, index, config

### Theming
All colors via CSS custom properties. Primary color is HSL-based — only `--tf-primary-h` (hue) changes:

```css
:root {
  --tf-primary-h: 221;
  --tf-primary-s: 83%;
  --tf-primary-l: 53%;
  --tf-primary: hsl(var(--tf-primary-h), var(--tf-primary-s), var(--tf-primary-l));
  /* ... see ARCHITECTURE.md Section 11 for full theme */
}
```

Dark mode via `[data-theme="dark"]` attribute on `<html>`.

## Project Structure

```
src/
├── core/
│   ├── App.tsx                  ← Entry, providers, onboarding check
│   ├── Shell.tsx                ← Sidebar + content layout
│   ├── services/
│   │   ├── storage/
│   │   │   ├── index.ts         ← StorageService facade
│   │   │   ├── idb-store.ts     ← IndexedDB wrapper
│   │   │   └── fs-store.ts      ← File System Access API wrapper
│   │   ├── ai/
│   │   │   ├── bridge.ts        ← AIBridge orchestrator
│   │   │   └── transports/      ← Streamlit, DirectLLM
│   │   ├── search/
│   │   │   ├── mini-rag.ts
│   │   │   ├── fulltext.ts
│   │   │   └── vector-store.ts
│   │   ├── converter/
│   │   │   ├── docx-to-md.ts
│   │   │   └── pdf-to-md.ts
│   │   └── plugin-registry.ts
│   ├── hooks/                   ← useStorage, useAIBridge, useSearch, etc.
│   └── types/                   ← plugin.ts, vorgang.ts, artifact.ts, config.ts
├── plugins/
│   ├── home/
│   ├── bauantraege/
│   ├── forschung/
│   ├── dokumente/
│   ├── suche/
│   ├── chat/
│   ├── einstellungen/
│   └── admin/
├── ui/                          ← Shared components: Button, Card, Dialog, Input, etc.
├── plugins.config.ts            ← Build-time plugin selection
└── main.tsx
```

## Coding Standards

### TypeScript
- Strict mode enabled
- Explicit return types on exported functions
- Interfaces over types for public APIs
- Barrel exports (`index.ts`) for each directory

### React
- Functional components only, no class components
- Custom hooks for all shared logic
- Avoid `useEffect` for data fetching — use event handlers or init patterns
- Memoize expensive computations with `useMemo`, not `useEffect`

### Styling
- Tailwind utility classes as primary styling method
- CSS custom properties for theme values: `bg-[var(--tf-bg)]`, `text-[var(--tf-primary)]`
- No CSS-in-JS libraries
- No inline `style={{}}` except for dynamic values (e.g., progress bars)

### File Naming
- Components: `PascalCase.tsx` (e.g., `BauantraegeListe.tsx`)
- Services/hooks: `camelCase.ts` (e.g., `useStorage.ts`)
- Types: `camelCase.ts` (e.g., `vorgang.ts`)
- Constants: `UPPER_SNAKE_CASE` in file, `camelCase.ts` filename

## Testing the Build

After any change, verify the single-file build works:

```bash
npm run build:single
# Open dist-single/index.html directly in Chrome (file:// protocol)
# Verify: no console errors, sidebar renders, theme switching works
```

## Common Pitfalls

1. **Don't use `import()` for lazy loading** — dynamic imports break under `file://` in single-file builds
2. **Don't use `fetch()` for local assets** — everything must be inlined or from IndexedDB/FSAPI
3. **Don't use `BroadcastChannel` for Streamlit bridge** — cross-origin between `file://` and `http://` fails. Use `postMessage` via `window.open()`
4. **Don't use `navigator.serviceWorker`** — unavailable under `file://`
5. **Web Workers must use `?worker&inline`** — standard Worker constructor fails under `file://`
6. **`crypto.subtle` works under `file://`** — it's a secure context ✓
7. **File System Access API works under `file://`** — it's a secure context ✓
