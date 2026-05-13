# TeamFlow Local App — Architektur & Konzept v3.1 (React)

## 1. Vision & Constraints

### Was wir bauen
Eine lokale, serverlose Web-App für kollaboratives Aufgabenmanagement mit AI-Integration. Deployment ausschließlich über File Server — User öffnet `index.html` per Doppelklick, kein .bat, keine Flags, kein IT-Support. Zwei Fachabteilungen (Bauanträge, Forschungsanträge) arbeiten mit Workflows, generieren Artefakte und nutzen AI-gestützte Suche.

### Harte Constraints
| Constraint | Implikation |
|---|---|
| **Kein HTTP-Server** | App läuft als `file://`, kein Backend |
| **Kein .bat / keine Flags** | Rein `index.html` öffnen — keine Chrome-Argumente |
| **Kein IT-Support** | Zero-Config, Self-Service-Onboarding |
| **File Server = einzige Shared-Infra** | Persistenz, Sync, Deployment über Netzlaufwerk |
| **Schwache Clients** | HP Business Laptops, 8/16GB RAM, Intel 11th Gen iGPU |
| **Ein GPU-Laptop** | 6GB VRAM, übernimmt Batch-Indexierung (~1x/Woche) |
| **Compliance-Umgebung** | Daten bleiben lokal, kein Cloud-Upload ohne Freigabe |

### Verfügbar
- **Chrome/Edge** — Standard, ohne spezielle Flags
- **File System Access API**, IndexedDB, Web Workers (inline), postMessage
- **Streamlit Chat-App** (2. Tab, kein Source-Zugriff → Bookmarklet-Bridge, **Default AI-Pfad**)
- **llama.cpp** (lokal) + externe Cloud APIs (OpenAI-kompatibel)
- **Dev-Umgebung**: Node.js, npm, git, Claude Code

---

## 2. High-Level Architektur

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Chrome/Edge Browser                           │
│                   (Standard, keine Flags nötig)                      │
│                                                                      │
│  ┌─ Tab 1: TeamFlow App (file://) ───────────────────────────────┐   │
│  │                                                               │   │
│  │  ┌──────────┐  ┌───────────────────────────────────────────┐  │   │
│  │  │ Sidebar   │  │  Plugin Content Area                      │  │   │
│  │  │          │  │                                           │  │   │
│  │  │ 🏠 Home   │  │  ┌─ Active Plugin ────────────────────┐  │  │   │
│  │  │ 📋 Bau    │  │  │                                    │  │  │   │
│  │  │ 🔬 Forsch │  │  │  Bauanträge / Forschung /          │  │  │   │
│  │  │ 📄 Docs   │  │  │  Dokumente / Suche / Chat / Admin  │  │  │   │
│  │  │ 🔍 Suche  │  │  │                                    │  │  │   │
│  │  │ 💬 Chat   │  │  └────────────────────────────────────┘  │  │   │
│  │  │ ⚙ Config  │  │                                           │  │   │
│  │  │ 🔧 Admin  │  │                                           │  │   │
│  │  └──────────┘  └───────────────────────────────────────────┘  │   │
│  │                                                               │   │
│  │  ┌─ Core Services ─────────────────────────────────────────┐  │   │
│  │  │ Storage │ AI Bridge │ MiniRAG │ DocConverter │ Plugins   │  │   │
│  │  └────────────────────┬────────────────────────────────────┘  │   │
│  └───────────────────────┼───────────────────────────────────────┘   │
│                          │                                           │
│       ┌──────────────────┼──────────────────────┐                    │
│       │                  │                      │                    │
│       ▼                  ▼                      ▼                    │
│  ┌─ postMessage ──┐  ┌─ fetch() ────────┐  ┌─ Inline Workers ────┐  │
│  │ window.open()  │  │ HTTP endpoints   │  │ Blob URL Workers    │  │
│  │ Streamlit Tab  │  │ llama.cpp/Cloud  │  │ Embedding (Query)   │  │
│  │ (DEFAULT AI)   │  │ HuggingFace CDN  │  │ Doc Conversion      │  │
│  └────────┬───────┘  └─────────────────┘  │ Search Index         │  │
│           │                                └─────────────────────┘  │
│           ▼                                                          │
│  ┌─ Tab 2: Streamlit (http://localhost) ─┐                          │
│  │  Bookmarklet: window.addEventListener │                          │
│  │  ('message', handler)                 │                          │
│  └───────────────────────────────────────┘                          │
└──────────────────────────────────────────────────────────────────────┘
           │
           │ File System Access API
           ▼
┌──────────────────────────────────────────────────┐
│              Shared File Server (SMB)             │
│                                                  │
│  \\server\TeamFlow\                              │
│    app\index.html           ← Single-File App    │
│    app\bridge.js            ← Bookmarklet Code   │
│    app\onboarding.html      ← Setup-Anleitung    │
│    data\                    ← Team-Daten         │
│    data\index\chunks.json   ← Embedding-Vektoren │
│    data\index\manifest.json ← Index-Metadaten    │
│    models\                  ← ONNX optional      │
└──────────────────────────────────────────────────┘
```

---

## 3. `file://` Kompatibilität — Kein .bat, keine Flags

### Grundprinzip
> **Jeder User öffnet `\\server\TeamFlow\app\index.html` per Doppelklick. Fertig.**

| Browser-Feature | Status unter `file://` | Unsere Lösung |
|---|---|---|
| IndexedDB | ✅ Funktioniert | Primärer lokaler Store |
| File System Access API | ✅ Funktioniert (Secure Context) | Persistenz auf File Server |
| Web Workers | ⚠ `new Worker('./x.js')` blockiert | **Vite `?worker&inline`** → Blob URL, kein Flag nötig |
| ES Module Imports | ❌ Blockiert | **Vite bundled alles** in eine Datei |
| `fetch()` zu HTTP URLs | ✅ Funktioniert | llama.cpp, HuggingFace CDN, Cloud APIs |
| `fetch()` zu relativen Pfaden | ❌ Blockiert | Nicht benötigt — alles inline gebundled |
| BroadcastChannel cross-origin | ❌ `file://` ≠ `http://` | **`postMessage` via `window.open()`** |
| Service Worker | ❌ Nicht unter `file://` | Nicht benötigt |
| localStorage | ⚠ Partitioniert | IndexedDB stattdessen |
| WebGPU | ✅ Funktioniert (wenn GPU vorhanden) | Für Batch-Embedding auf GPU-Laptop |
| WASM / ONNX Runtime | ✅ Funktioniert | Embedding, PDF-Parsing |

### Inline Web Workers (kein Flag nötig)

```typescript
// vite.config.ts — Vollständige Config
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import viteSingleFile from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    mode === 'single' && viteSingleFile(),
  ].filter(Boolean),
  build: {
    target: 'esnext',
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    assetsInlineLimit: mode === 'single' ? Infinity : 4096,
  },
  base: mode === 'single' ? '' : './',
  worker: { format: 'es' },
}));

// Verwendung im Code — Vite erzeugt Blob URL automatisch
import EmbeddingWorker from './workers/embedding.worker?worker&inline';
import ConverterWorker from './workers/converter.worker?worker&inline';

const embeddingWorker = new EmbeddingWorker();  // → Blob URL, file:// safe
const converterWorker = new ConverterWorker();  // → Blob URL, file:// safe
```

### Kein Chrome-Flag, keine Einschränkungen
Die einzige externe Abhängigkeit ist, dass llama.cpp mit `--cors "*"` gestartet wird — aber das ist serverseitige Konfiguration, kein Browser-Problem. Streamlit-Bridge funktioniert über `postMessage` cross-origin.

---

## 4. AI-Bridge: postMessage statt BroadcastChannel

### Problem
`BroadcastChannel` funktioniert nur innerhalb derselben Origin. `file://` und `http://localhost:8501` (Streamlit) sind verschiedene Origins → BroadcastChannel ist **nicht nutzbar**.

### Lösung: `window.open()` + `postMessage`

```
TeamFlow (file://)                        Streamlit (http://localhost:8501)
     │                                            │
     │  const streamlitWin = window.open(         │
     │    'http://localhost:8501',                 │
     │    'teamflow-streamlit'                     │
     │  )  ← fester Fenstername!                   │
     │                                            │
     │  // Falls Tab schon offen:                  │
     │  // window.open() fokussiert nur,           │
     │  // öffnet keinen neuen Tab                 │
     │                                            │
     │── streamlitWin.postMessage(req, '*') ─────▶│  Bookmarklet hört zu:
     │                                            │  window.addEventListener(
     │                                            │    'message', handler)
     │                                            │
     │◀── event.source.postMessage(resp, '*') ────│  event.source = TeamFlow
     │                                            │
     │  window.addEventListener('message', (e) => │
     │    if (e.origin.includes('localhost'))      │
     │      handleResponse(e.data)                │
     │  )                                         │
```

### TeamFlow-Seite: Streamlit Transport

```typescript
// src/core/services/ai/transports/streamlit.ts

export class StreamlitBridgeTransport {
  private streamlitWindow: Window | null = null;
  private pending = new Map<string, {
    resolve: (value: string) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();

  constructor(private streamlitUrl = 'http://localhost:8501') {
    // Antworten von Streamlit empfangen
    window.addEventListener('message', (event) => {
      // Sicherheits-Check: nur von erwarteter Origin
      if (!event.origin.includes('localhost')) return;
      if (event.data?.type !== 'tf-response') return;

      const p = this.pending.get(event.data.id);
      if (p) {
        clearTimeout(p.timeout);
        p.resolve(event.data.result);
        this.pending.delete(event.data.id);
      }
    });
  }

  /** Streamlit-Tab öffnen oder fokussieren */
  ensureConnection(): boolean {
    if (this.streamlitWindow && !this.streamlitWindow.closed) {
      return true;  // Tab ist noch offen
    }
    // Fester Name → öffnet nur einmal, fokussiert danach
    this.streamlitWindow = window.open(
      this.streamlitUrl,
      'teamflow-streamlit'
    );
    return this.streamlitWindow !== null;
  }

  /** Prüft ob Bridge im Streamlit-Tab aktiv ist */
  async ping(timeoutMs = 3000): Promise<boolean> {
    if (!this.ensureConnection()) return false;

    return new Promise((resolve) => {
      const id = `ping-${Date.now()}`;
      const handler = (e: MessageEvent) => {
        if (e.data?.type === 'tf-pong' && e.data?.id === id) {
          window.removeEventListener('message', handler);
          resolve(true);
        }
      };
      window.addEventListener('message', handler);
      this.streamlitWindow!.postMessage({ type: 'tf-ping', id }, '*');
      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(false);
      }, timeoutMs);
    });
  }

  /** AI-Anfrage über Streamlit senden */
  async submitMessages({ messages, abortSignal }: SubmitParams): Promise<string> {
    if (!this.ensureConnection()) {
      throw new Error('Streamlit-Tab konnte nicht geöffnet werden');
    }

    const id = crypto.randomUUID();
    const lastUserMsg = messages.filter(m => m.role === 'user').pop();

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Streamlit Bridge Timeout (60s)'));
      }, 60_000);

      this.pending.set(id, { resolve, reject, timeout });

      this.streamlitWindow!.postMessage({
        type: 'tf-request',
        id,
        prompt: lastUserMsg?.content || '',
        systemPrompt: messages.find(m => m.role === 'system')?.content,
        history: messages.slice(0, -1).map(m => ({
          role: m.role,
          content: m.content,
        })),
      }, '*');

      abortSignal?.addEventListener('abort', () => {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(new Error('Aborted'));
      });
    });
  }

  /** Status für UI */
  getStatus(): 'connected' | 'disconnected' | 'no-bridge' {
    if (!this.streamlitWindow || this.streamlitWindow.closed) return 'disconnected';
    return 'connected';  // Bridge-Check nur via ping()
  }
}
```

### Bookmarklet-Seite: bridge.js (postMessage-basiert)

```javascript
// \\server\TeamFlow\app\bridge.js
// User führt dies als Bookmarklet im Streamlit-Tab aus

(function TeamFlowBridge() {
  if (window.__tfBridgeActive) return;
  window.__tfBridgeActive = true;

  // ─── Status Badge ───
  const badge = document.createElement('div');
  badge.innerHTML = '🔗 TF Bridge';
  badge.style.cssText = `
    position:fixed; top:8px; right:8px; z-index:99999;
    background:#22c55e; color:#fff; padding:6px 14px;
    border-radius:16px; font-size:13px; font-family:system-ui;
    box-shadow:0 2px 8px rgba(0,0,0,0.15);
    transition: background 0.3s;
  `;
  document.body.appendChild(badge);

  // ─── Streamlit DOM Helpers ───
  function getInput() {
    return document.querySelector('textarea[data-testid="stChatInputTextArea"]')
        || document.querySelector('textarea');
  }

  function getSubmitBtn() {
    return document.querySelector('button[data-testid="stChatInputSubmitButton"]')
        || document.querySelector('button[kind="primary"]');
  }

  function setReactValue(el, value) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype, 'value'
    ).set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function waitForResponse(timeout = 60000) {
    return new Promise((resolve, reject) => {
      const startMsgCount = document.querySelectorAll(
        '[data-testid="stChatMessage"]'
      ).length;

      let settled = false;
      let lastText = '';
      let stableCount = 0;

      const interval = setInterval(() => {
        const msgs = document.querySelectorAll('[data-testid="stChatMessage"]');
        if (msgs.length > startMsgCount) {
          const lastMsg = msgs[msgs.length - 1];
          const currentText = lastMsg.textContent || '';

          // Text stabil seit 500ms? → fertig
          if (currentText === lastText && currentText.length > 0) {
            stableCount++;
            if (stableCount >= 3) {  // 3x check = ~750ms stabil
              clearInterval(interval);
              clearTimeout(timer);
              settled = true;
              resolve(currentText.trim());
            }
          } else {
            lastText = currentText;
            stableCount = 0;
          }
        }
      }, 250);

      const timer = setTimeout(() => {
        if (!settled) {
          clearInterval(interval);
          reject(new Error('Timeout'));
        }
      }, timeout);
    });
  }

  // ─── Message Handler (postMessage, NICHT BroadcastChannel) ───
  window.addEventListener('message', async (event) => {
    const { data } = event;

    // Ping/Pong für Verbindungstest
    if (data?.type === 'tf-ping') {
      event.source.postMessage(
        { type: 'tf-pong', id: data.id },
        event.origin === 'null' ? '*' : event.origin
        // file:// origin ist 'null' als String!
      );
      return;
    }

    if (data?.type !== 'tf-request') return;

    const { id, prompt } = data;
    badge.textContent = '🔗 Processing...';
    badge.style.background = '#eab308';

    try {
      const textarea = getInput();
      if (!textarea) throw new Error('Streamlit input not found');

      setReactValue(textarea, prompt);
      await new Promise(r => setTimeout(r, 150));

      const submitBtn = getSubmitBtn();
      if (submitBtn) {
        submitBtn.click();
      } else {
        // Fallback: Enter-Key
        textarea.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', bubbles: true
        }));
      }

      const result = await waitForResponse();

      // Antwort zurück an TeamFlow — event.source ist der Opener!
      event.source.postMessage({
        type: 'tf-response',
        id,
        result,
        status: 'success',
      }, event.origin === 'null' ? '*' : event.origin);

      badge.textContent = '🔗 TF Bridge';
      badge.style.background = '#22c55e';

    } catch (error) {
      event.source.postMessage({
        type: 'tf-response',
        id,
        result: null,
        status: 'error',
        error: error.message,
      }, event.origin === 'null' ? '*' : event.origin);

      badge.textContent = '🔗 Error!';
      badge.style.background = '#ef4444';
      setTimeout(() => {
        badge.textContent = '🔗 TF Bridge';
        badge.style.background = '#22c55e';
      }, 3000);
    }
  });

  console.log('[TeamFlow Bridge] Active — listening via postMessage');
})();
```

### Bookmarklet (Loader oder Inline)

```javascript
// Option A: Loader (lädt bridge.js vom File Server)
// Funktioniert NUR wenn Streamlit-Tab file:// Scripts erlaubt — unwahrscheinlich!

// Option B (EMPFOHLEN): Inline-Bookmarklet
// bridge.js wird minifiziert und direkt ins Bookmarklet gepackt
// Build-Schritt: npm run build:bookmarklet → erzeugt kopierbaren Link
// Onboarding-Seite zeigt draggable Link

javascript:void((function(){if(window.__tfBridgeActive)return;/* ...minified bridge.js... */})())
```

### AI Bridge Orchestrator mit Vercel AI SDK 5+ Transport

```typescript
// src/core/services/ai/bridge.ts
import { StreamlitBridgeTransport } from './transports/streamlit';
import { DirectLLMTransport } from './transports/direct-llm';

export type AIProviderType = 'streamlit' | 'llama-local' | 'cloud';

interface AIProviderConfig {
  streamlit?: { url: string };
  llamaCpp?: { endpoint: string; model: string };
  cloud?: { endpoint: string; model: string; apiKey: string };
}

export class AIBridge {
  private transports = new Map<string, any>();
  private _activeProvider: AIProviderType;

  constructor(config: AIProviderConfig) {
    // Default: Streamlit Bridge (immer verfügbar)
    this.transports.set('streamlit', new StreamlitBridgeTransport(
      config.streamlit?.url || 'http://localhost:8501'
    ));

    if (config.llamaCpp) {
      this.transports.set('llama-local', new DirectLLMTransport(
        config.llamaCpp.endpoint,
        config.llamaCpp.model,
      ));
    }

    if (config.cloud) {
      this.transports.set('cloud', new DirectLLMTransport(
        config.cloud.endpoint,
        config.cloud.model,
        config.cloud.apiKey,
      ));
    }

    this._activeProvider = 'streamlit';
  }

  get activeProvider(): AIProviderType { return this._activeProvider; }

  switchProvider(id: AIProviderType) {
    if (this.transports.has(id)) this._activeProvider = id;
  }

  getTransport() {
    return this.transports.get(this._activeProvider)!;
  }

  getAvailableProviders(): AIProviderType[] {
    return [...this.transports.keys()] as AIProviderType[];
  }

  /** Für useChat Hook */
  getChatConfig() {
    return { transport: this.getTransport() };
  }
}
```

### Direct LLM Transport (llama.cpp / Cloud)

```typescript
// src/core/services/ai/transports/direct-llm.ts

export class DirectLLMTransport {
  constructor(
    private endpoint: string,  // z.B. http://localhost:8080/v1
    private model: string,
    private apiKey?: string,
  ) {}

  async submitMessages({ messages, abortSignal }: SubmitParams): Promise<ReadableStream> {
    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`LLM Error: ${response.status} ${response.statusText}`);
    }

    return response.body!;  // SSE Stream
  }
}
```

---

## 5. Tech-Stack — Client-seitige Libraries

### Kernprinzip
> Alles läuft im Browser — JS oder WASM. Kein Server, kein Node.js zur Laufzeit.

| Bereich | Library | Größe (gzip) | Rolle |
|---|---|---|---|
| **Framework** | React 19 + ReactDOM | ~42KB | Größtes Ökosystem, native AI SDK Unterstützung, beste Coding-Agent-Kompatibilität |
| **Build** | Vite + vite-plugin-singlefile | Dev only | Single-HTML Output |
| **Styling** | Tailwind CSS (build-time) | 0KB runtime | Utility-first + CSS Variables |
| **State** | Zustand | ~1KB | Persistierbar, Middleware-fähig |
| **AI Chat UI** | @ai-sdk/react (useChat) | ~15KB | Custom Transport, Streaming, Tools |
| **AI Provider** | @ai-sdk/openai | ~8KB | OpenAI-compat → llama.cpp, Cloud |
| **DOCX→HTML** | mammoth.js | ~70KB | Browser-nativ, arrayBuffer |
| **HTML→Markdown** | Turndown.js | ~15KB | Saubere MD aus mammoth-HTML |
| **PDF→Text** | pdfjs-dist | ~400KB | Mozilla, Text-Layer Extraktion |
| **Embeddings** | @huggingface/transformers v3+ | ~50KB + Modell | ONNX, WebGPU/WASM |
| **Volltext-Suche** | MiniSearch | ~6KB | Invertierter Index, Keyword-Fallback |
| **Markdown Render** | marked | ~30KB | MD→HTML in Previews |
| **DOCX Export** | docx (npm) | ~100KB | Programmatische .docx Erstellung |
| **Icons** | lucide-react | tree-shake | Nur genutzte Icons |

### Zusätzliche Libraries für komplexe UI (Phase 3+)

Die folgenden Screenshots zeigen Funktionalitäten, die architektonisch eingeplant aber erst später implementiert werden:

> **Screenshot 1**: Prompt Version History — Side-by-Side Diff, Timeline, Performance-Metriken
> **Screenshot 2**: Prompt Workbench — Block-Editor, Syntax-Highlighting, Live Preview, Variablen
> **Screenshot 3**: Collaborative Template Builder — Farbcodierte Blöcke, Drag & Drop, Peer Review, Kommentare

| Bereich | Library | Größe | Für welches Feature |
|---|---|---|---|
| **Drag & Drop** | @dnd-kit/core + sortable | ~15KB | Block-Editor, Template Builder (Screenshot 2+3) |
| **Resizable Panels** | react-resizable-panels | ~8KB | Multi-Panel Layout: Editor + Preview + Test (Screenshot 2) |
| **Diff-View** | react-diff-viewer-continued | ~20KB | Side-by-Side Versionsvergleich (Screenshot 1) |
| **Code/Text Editor** | CodeMirror 6 + @codemirror/lang-markdown | ~150KB | Prompt-Editor mit Syntax-Highlighting, Variablen-Highlighting `{{var}}` (Screenshot 2) |
| **Syntax Highlighting** | @lezer/highlight (via CodeMirror) | incl. | Template-Variablen, Markdown, JSON Highlighting |
| **Virtualisierte Listen** | @tanstack/react-virtual | ~5KB | Große Vorgangslisten, Chunk-Listen, Version-History |
| **Toast/Notifications** | sonner | ~5KB | Status-Meldungen, Sync-Feedback |
| **Date Picker** | react-day-picker | ~10KB | Fristen-Management in Vorgängen |

### Warum React statt Preact

Für die in den Screenshots gezeigten komplexen UI-Patterns (Block-Editoren, Diff-Views, Drag & Drop, Resizable Panels) ist React-Kompatibilität entscheidend:

- **`preact/compat` hat Grenzen**: Subtile Inkompatibilitäten bei Libraries die React-Internals nutzen (Portals, Suspense, Concurrent Features). Bei dnd-kit, react-resizable-panels oder CodeMirror React-Wrapper kann das zu schwer debugbaren Fehlern führen.
- **Vercel AI SDK ist React-nativ**: `useChat`, Custom Transports, Tool-Calling, Streaming Parts — alles für React gebaut. Bei Preact geht es *wahrscheinlich*, bei Problemen gibt es keinen Support.
- **Coding Agents produzieren besseren React-Code**: Claude Code, Cursor und andere Agents haben das meiste Training mit React. Der Code funktioniert zuverlässiger auf Anhieb.
- **Bundle-Größe ist irrelevant**: 42KB React vs 4KB Preact — bei einer App die mammoth.js (70KB), pdf.js (400KB), ein 23MB Embedding-Modell und perspektivisch CodeMirror (150KB) lädt, fällt der Unterschied nicht ins Gewicht.

### Zukünftige Plugin-Konzepte (aus Screenshots abgeleitet)

```typescript
// Phase 4+: Plugins die auf den komplexen UI-Libraries aufbauen

// Prompt Workbench Plugin (Screenshot 2+3)
// → Block-basierter Template-Editor für AI-Prompts
// → Variablen-System: {{vorgang}}, {{kontext}}, {{einschraenkungen}}
// → Live-Preview mit echtem AI-Output
// → Templates speichern, teilen, versionieren
export const promptWorkbench: TeamFlowPlugin = {
  id: 'prompt-workbench',
  name: 'Prompt Workbench',
  icon: 'FlaskConical',
  category: 'tools',
  order: 60,
  component: PromptWorkbench,
};

// Version History Plugin (Screenshot 1)
// → Diff-Ansicht für Dokumente und Prompts
// → Timeline mit Änderungen pro Vorgang
// → Restore auf frühere Versionen
export const versionHistory: TeamFlowPlugin = {
  id: 'versions',
  name: 'Versionen',
  icon: 'GitBranch',
  category: 'tools',
  order: 70,
  component: VersionHistory,
};

// Peer Review Plugin (Screenshot 3)
// → Inline-Kommentare auf Artefakten
// → Freigabe-Workflows
// → Kollaboratives Editieren von Prompts/Templates
export const peerReview: TeamFlowPlugin = {
  id: 'review',
  name: 'Review',
  icon: 'MessageSquareMore',
  category: 'tools',
  order: 80,
  component: PeerReview,
};
```
| **Diff** | diff | ~15KB | Konflikt-Erkennung File Server |

---

## 6. Embedding-Architektur: Client/Admin Split

### Das Problem
| | Schwache Laptops | GPU-Laptop |
|---|---|---|
| **Hardware** | 8–16GB RAM, Intel 11th Gen, keine dGPU | 16+GB RAM, 6GB VRAM dGPU |
| **Embedding-Backend** | WASM (CPU) | WebGPU (GPU-beschleunigt) |
| **Kann** | 1 Query embedden (~100ms) | 3.000+ Chunks batchen (~1 Min) |
| **Soll** | Fertigen Index lesen, Query matchen | Wöchentlich Batch-Indexierung |

### Lösung: Read/Write Split über File Server

```
┌─ GPU-Laptop (Admin, 1x/Woche) ──────────────────────────────┐
│                                                              │
│  1. Alle Dokumente vom File Server lesen                     │
│  2. Neue/geänderte Docs erkennen (manifest.json Hash-Check)  │
│  3. Chunks erzeugen (200 Tokens, 50 Overlap)                 │
│  4. Embeddings berechnen (WebGPU, ~50-100 Chunks/Sek)        │
│  5. chunks.json + manifest.json auf File Server schreiben     │
│                                                              │
│  ┌──────────────────────────────────────────┐                │
│  │ Transformers.js + WebGPU Backend          │                │
│  │ Modell: all-MiniLM-L6-v2 (23MB)          │                │
│  │ ~3.000 Chunks in ~30-60 Sekunden          │                │
│  └──────────────────────────────────────────┘                │
└──────────────┬───────────────────────────────────────────────┘
               │ schreibt
               ▼
┌─ File Server ────────────────────────────────────────────────┐
│  data/index/                                                 │
│    manifest.json    ← Welche Docs indexiert, Hashes, Datum   │
│    chunks.json      ← Alle Chunks + Vektoren (~5-20MB)       │
│    fulltext.json    ← MiniSearch Export (~1-5MB)              │
└──────────────┬───────────────────────────────────────────────┘
               │ liest
               ▼
┌─ Schwache Laptops (alle User, täglich) ──────────────────────┐
│                                                              │
│  1. App-Start: chunks.json vom File Server → IndexedDB Cache │
│     (nur wenn neuer als lokaler Cache)                       │
│  2. User tippt Suchanfrage                                   │
│  3. Query embedden: Transformers.js WASM, ~50-150ms          │
│  4. Cosine Similarity gegen geladene Vektoren im RAM         │
│  5. Top-K Ergebnisse anzeigen                                │
│                                                              │
│  ┌──────────────────────────────────────────┐                │
│  │ Transformers.js + WASM Backend (CPU)      │                │
│  │ Modell: all-MiniLM-L6-v2 (23MB)          │                │
│  │ Query: ~50-150ms │ RAM: ~80-120MB          │                │
│  │ Cosine Sim: <10ms für 3.000 Chunks        │                │
│  └──────────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

### Index-Dateien auf File Server

**manifest.json** — Metadaten des Index

```json
{
  "version": 2,
  "model": "Xenova/all-MiniLM-L6-v2",
  "dimensions": 384,
  "chunkSize": 200,
  "chunkOverlap": 50,
  "lastFullIndex": "2026-03-21T14:30:00Z",
  "indexedBy": "mueller",
  "stats": {
    "documents": 847,
    "chunks": 3204,
    "totalTokens": 512000
  },
  "documents": {
    "vorgaenge/bauantraege/BA-2025-001/antrag.md": {
      "hash": "sha256:a3f2b1c9...",
      "indexed": "2026-03-21T14:30:00Z",
      "chunks": [0, 1, 2, 3, 4],
      "size": 15420
    },
    "vorgaenge/bauantraege/BA-2025-001/pruefbericht.md": {
      "hash": "sha256:b7c1d2e3...",
      "indexed": "2026-03-21T14:30:00Z",
      "chunks": [5, 6, 7],
      "size": 8200
    }
  }
}
```

**chunks.json** — Kompakte Vektor-Datenbank

```json
{
  "version": 2,
  "created": "2026-03-21T14:30:00Z",
  "model": "Xenova/all-MiniLM-L6-v2",
  "chunks": [
    {
      "id": 0,
      "text": "Der Bauantrag für das Einfamilienhaus an der Musterstraße 12...",
      "source": "vorgaenge/bauantraege/BA-2025-001/antrag.md",
      "tags": ["neubau", "einfamilienhaus", "wohngebiet-B"],
      "type": "bauantrag",
      "vector": [0.0234, -0.0156, 0.0891, ...]
    }
  ]
}
```

> **Größen-Schätzung**: 3.000 Chunks × (384 Floats × 4 Bytes + ~200 Bytes Text) ≈ 5-10MB JSON.
> Komprimiert (gzip) ~2-4MB. Schnell genug zum Laden über SMB.

### Lazy Loading der Vektoren

```typescript
// src/core/services/search/vector-store.ts

class VectorStore {
  private chunks: EmbeddedChunk[] = [];
  private manifest: IndexManifest | null = null;
  private loaded = false;

  /** Beim App-Start: Index laden (Background) */
  async init(storage: StorageService) {
    // 1. Lokalen Cache prüfen
    const cachedManifest = await storage.idb.get('index-manifest');
    const cachedChunks = await storage.idb.get('index-chunks');

    // 2. Server-Manifest lesen
    const serverManifest = await storage.fs?.readJSON('index/manifest.json');

    // 3. Vergleichen: Nur neu laden wenn Server-Version neuer
    if (serverManifest &&
        (!cachedManifest || serverManifest.lastFullIndex > cachedManifest.lastFullIndex)) {
      // Neuer Index auf Server → laden
      const serverChunks = await storage.fs?.readJSON('index/chunks.json');
      this.chunks = serverChunks.chunks;
      this.manifest = serverManifest;

      // In IndexedDB cachen
      await storage.idb.set('index-manifest', serverManifest);
      await storage.idb.set('index-chunks', serverChunks);
    } else if (cachedChunks) {
      // Cache ist aktuell
      this.chunks = cachedChunks.chunks;
      this.manifest = cachedManifest;
    }

    this.loaded = this.chunks.length > 0;
  }

  /** Cosine Similarity Search — rein im RAM, sehr schnell */
  search(queryVector: number[], topK = 5, filters?: SearchFilters): SearchResult[] {
    if (!this.loaded) return [];

    let candidates = this.chunks;

    // Filter
    if (filters?.tags?.length) {
      candidates = candidates.filter(c =>
        filters.tags!.some(t => c.tags.includes(t))
      );
    }
    if (filters?.type) {
      candidates = candidates.filter(c => c.type === filters.type);
    }
    if (filters?.source) {
      candidates = candidates.filter(c => c.source.includes(filters.source));
    }

    // Score + Sort
    const scored = candidates.map(chunk => ({
      ...chunk,
      score: cosineSimilarity(queryVector, chunk.vector),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

### Query Embedder (läuft auf jedem Laptop)

```typescript
// src/core/services/search/query-embedder.ts

class QueryEmbedder {
  private pipeline: any = null;
  private loading = false;
  private ready = false;

  /** Modell im Hintergrund laden — blockiert nicht die App */
  async init() {
    if (this.loading || this.ready) return;
    this.loading = true;

    try {
      const { pipeline } = await import('@huggingface/transformers');

      this.pipeline = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        {
          // WASM Backend — funktioniert auf ALLEN Laptops
          // WebGPU wird automatisch genutzt wenn verfügbar
          device: 'wasm',  // Explizit WASM für schwache Clients
          progress_callback: (p: any) => {
            if (p.status === 'downloading') {
              this.onProgress?.(p.loaded / p.total);
            }
          }
        }
      );

      this.ready = true;
    } catch (error) {
      console.error('Embedding model load failed:', error);
    } finally {
      this.loading = false;
    }
  }

  /** Einen einzelnen Query-Text embedden (~50-150ms auf CPU) */
  async embed(text: string): Promise<number[]> {
    if (!this.ready) throw new Error('Embedder not ready');

    const output = await this.pipeline(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data as Float32Array);
  }

  isReady(): boolean { return this.ready; }

  // Progress-Callback für UI
  onProgress?: (fraction: number) => void;
}
```

### Admin: Batch-Indexer (nur GPU-Laptop)

```typescript
// src/core/services/search/batch-indexer.ts

class BatchIndexer {
  private pipeline: any = null;

  async init() {
    const { pipeline } = await import('@huggingface/transformers');

    // WebGPU für GPU-Laptop — deutlich schneller
    this.pipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      {
        device: navigator.gpu ? 'webgpu' : 'wasm',
        progress_callback: (p: any) => this.onProgress?.(p),
      }
    );
  }

  /** Inkrementelles Indexing: nur neue/geänderte Docs */
  async indexAll(
    storage: StorageService,
    onStatus: (status: IndexingStatus) => void
  ): Promise<void> {
    // 1. Aktuelles Manifest laden
    const manifest = await storage.fs!.readJSON('index/manifest.json')
      || this.createEmptyManifest();

    // 2. Alle Dokumente scannen
    const allDocs = await storage.fs!.scanDocuments('vorgaenge/');

    // 3. Neue/geänderte identifizieren
    const toIndex: DocToIndex[] = [];
    for (const doc of allDocs) {
      const hash = await this.hashContent(doc.content);
      const existing = manifest.documents[doc.path];
      if (!existing || existing.hash !== hash) {
        toIndex.push({ ...doc, hash });
      }
    }

    onStatus({
      phase: 'indexing',
      total: toIndex.length,
      processed: 0,
      skipped: allDocs.length - toIndex.length,
    });

    if (toIndex.length === 0) {
      onStatus({ phase: 'done', message: 'Index ist aktuell.' });
      return;
    }

    // 4. Bestehende Chunks laden (für Merge)
    const existingChunks = await storage.fs!.readJSON('index/chunks.json')
      || { chunks: [] };

    // Alte Chunks der geänderten Docs entfernen
    const changedPaths = new Set(toIndex.map(d => d.path));
    const retainedChunks = existingChunks.chunks.filter(
      (c: any) => !changedPaths.has(c.source)
    );

    // 5. Neue Chunks erzeugen und embedden
    const newChunks: EmbeddedChunk[] = [];
    let nextId = Math.max(0, ...retainedChunks.map((c: any) => c.id)) + 1;

    for (let i = 0; i < toIndex.length; i++) {
      const doc = toIndex[i];
      const textChunks = this.chunkText(doc.content, 200, 50);

      for (const tc of textChunks) {
        const vector = await this.embed(tc.text);
        newChunks.push({
          id: nextId++,
          text: tc.text,
          source: doc.path,
          tags: doc.meta?.tags || [],
          type: doc.meta?.type || 'unknown',
          vector,
        });
      }

      onStatus({
        phase: 'indexing',
        total: toIndex.length,
        processed: i + 1,
        currentDoc: doc.path,
      });
    }

    // 6. Merge und speichern
    const allChunks = [...retainedChunks, ...newChunks];

    // Manifest aktualisieren
    for (const doc of toIndex) {
      manifest.documents[doc.path] = {
        hash: doc.hash,
        indexed: new Date().toISOString(),
        chunks: newChunks
          .filter(c => c.source === doc.path)
          .map(c => c.id),
        size: doc.content.length,
      };
    }
    manifest.lastFullIndex = new Date().toISOString();
    manifest.stats = {
      documents: Object.keys(manifest.documents).length,
      chunks: allChunks.length,
    };

    // Auf File Server schreiben
    await storage.fs!.writeJSON('index/chunks.json', {
      version: 2,
      created: manifest.lastFullIndex,
      model: 'Xenova/all-MiniLM-L6-v2',
      chunks: allChunks,
    });
    await storage.fs!.writeJSON('index/manifest.json', manifest);

    // 7. Auch MiniSearch Fulltext-Index aktualisieren
    await this.rebuildFulltextIndex(allChunks, storage);

    onStatus({ phase: 'done', message: `${newChunks.length} neue Chunks indexiert.` });
  }

  private async embed(text: string): Promise<number[]> {
    const output = await this.pipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  }

  private chunkText(text: string, chunkSize: number, overlap: number): TextChunk[] {
    const words = text.split(/\s+/);
    const chunks: TextChunk[] = [];
    let i = 0;

    while (i < words.length) {
      const end = Math.min(i + chunkSize, words.length);
      chunks.push({
        text: words.slice(i, end).join(' '),
        index: chunks.length,
        start: i,
        end,
      });
      i += chunkSize - overlap;
    }

    return chunks;
  }

  private async hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return 'sha256:' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  onProgress?: (p: any) => void;
}
```

---

## 7. Admin-Plugin: Index-Verwaltung

```tsx
// src/plugins/admin/IndexManager.tsx

function IndexManager() {
  const storage = useStorage();
  const [manifest, setManifest] = useState<IndexManifest | null>(null);
  const [status, setStatus] = useState<IndexingStatus | null>(null);
  const [gpuAvailable, setGpuAvailable] = useState(false);

  useEffect(() => {
    // Manifest laden
    storage.fs?.readJSON('index/manifest.json').then(setManifest);
    // GPU prüfen
    navigator.gpu?.requestAdapter().then(a => setGpuAvailable(!!a));
  }, []);

  const startIndexing = async (fullReindex = false) => {
    const indexer = new BatchIndexer();
    await indexer.init();
    indexer.onProgress = (p) => { /* loading bar */ };

    if (fullReindex) {
      // Manifest leeren → alles neu
      await storage.fs!.writeJSON('index/manifest.json', createEmptyManifest());
    }

    await indexer.indexAll(storage, setStatus);
    // Manifest neu laden
    setManifest(await storage.fs!.readJSON('index/manifest.json'));
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-xl font-semibold">Index-Verwaltung</h2>

      {/* Status-Karte */}
      <Card>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{manifest?.stats?.documents || 0}</div>
            <div className="text-sm text-[var(--tf-text-secondary)]">Dokumente</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{manifest?.stats?.chunks || 0}</div>
            <div className="text-sm text-[var(--tf-text-secondary)]">Chunks</div>
          </div>
          <div>
            <div className="text-sm font-medium">
              {manifest?.lastFullIndex
                ? `Letztes Update: ${formatDate(manifest.lastFullIndex)}`
                : 'Noch nie indexiert'}
            </div>
            <div className="text-sm text-[var(--tf-text-secondary)]">
              von {manifest?.indexedBy || '—'}
            </div>
          </div>
        </div>
      </Card>

      {/* GPU-Hinweis */}
      <div className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg ${
        gpuAvailable
          ? 'bg-green-50 text-green-700'
          : 'bg-yellow-50 text-yellow-700'
      }`}>
        {gpuAvailable
          ? '✓ WebGPU verfügbar — Batch-Indexierung wird GPU-beschleunigt'
          : '⚠ Keine GPU erkannt — Indexierung läuft auf CPU (langsamer)'
        }
      </div>

      {/* Aktionen */}
      <div className="flex gap-3">
        <Button onClick={() => startIndexing(false)}>
          ↻ Nur neue Dokumente indexieren
        </Button>
        <Button variant="secondary" onClick={() => startIndexing(true)}>
          ▶ Komplett neu indexieren
        </Button>
      </div>

      {/* Fortschritt */}
      {status?.phase === 'indexing' && (
        <Card>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{status.currentDoc}</span>
              <span>{status.processed}/{status.total}</span>
            </div>
            <div className="w-full h-2 bg-[var(--tf-border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--tf-primary)] rounded-full transition-all"
                style={{ width: `${(status.processed / status.total) * 100}%` }}
              />
            </div>
            {status.skipped > 0 && (
              <div className="text-xs text-[var(--tf-text-secondary)]">
                {status.skipped} Dokumente übersprungen (unverändert)
              </div>
            )}
          </div>
        </Card>
      )}

      {status?.phase === 'done' && (
        <div className="text-sm text-green-600 bg-green-50 px-4 py-2 rounded-lg">
          ✓ {status.message}
        </div>
      )}

      {/* Optionen */}
      <Card>
        <h3 className="font-medium mb-3">Optionen</h3>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={gpuAvailable} disabled />
            WebGPU verwenden (automatisch wenn verfügbar)
          </label>
          <div className="flex items-center gap-2">
            <span>Embedding-Modell:</span>
            <code className="bg-[var(--tf-bg-secondary)] px-2 py-0.5 rounded text-xs">
              {manifest?.model || 'Xenova/all-MiniLM-L6-v2'}
            </code>
          </div>
          <div className="flex items-center gap-2">
            <span>Chunk-Größe:</span>
            <span>{manifest?.chunkSize || 200} Tokens, {manifest?.chunkOverlap || 50} Overlap</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
```

---

## 8. Dual-Search: Keyword + Vektor mit Reciprocal Rank Fusion

```typescript
// src/core/services/search/hybrid-search.ts

class HybridSearch {
  private vectorStore: VectorStore;
  private queryEmbedder: QueryEmbedder;
  private miniSearch: MiniSearch;
  private fulltextReady = false;
  private vectorReady = false;

  async init(storage: StorageService) {
    // 1. MiniSearch sofort laden (klein, schnell, kein Modell nötig)
    const fulltextIndex = await storage.idb.get('index-fulltext');
    if (fulltextIndex) {
      this.miniSearch = MiniSearch.loadJSON(fulltextIndex, {
        fields: ['text'],
        storeFields: ['text', 'source', 'tags', 'type'],
      });
      this.fulltextReady = true;
    }

    // 2. Vektor-Index laden (aus IndexedDB Cache oder File Server)
    await this.vectorStore.init(storage);
    this.vectorReady = this.vectorStore.isLoaded();

    // 3. Embedding-Modell im Hintergrund laden
    this.queryEmbedder.init();  // async, blockiert nicht
  }

  async search(query: string, topK = 10, filters?: SearchFilters): Promise<SearchResult[]> {
    const keywordResults: SearchResult[] = [];
    const vectorResults: SearchResult[] = [];

    // Keyword-Suche (immer verfügbar, sofort)
    if (this.fulltextReady) {
      const hits = this.miniSearch.search(query, { fuzzy: 0.2, prefix: true });
      keywordResults.push(...hits.slice(0, topK).map(h => ({
        text: h.text,
        source: h.source,
        tags: h.tags,
        type: h.type,
        score: h.score,
        method: 'keyword' as const,
      })));
    }

    // Vektor-Suche (wenn Embedder bereit)
    if (this.vectorReady && this.queryEmbedder.isReady()) {
      const queryVector = await this.queryEmbedder.embed(query);
      const hits = this.vectorStore.search(queryVector, topK, filters);
      vectorResults.push(...hits.map(h => ({
        text: h.text,
        source: h.source,
        tags: h.tags,
        type: h.type,
        score: h.score,
        method: 'vector' as const,
      })));
    }

    // Fusion
    if (vectorResults.length > 0 && keywordResults.length > 0) {
      return this.reciprocalRankFusion([...keywordResults, ...vectorResults], topK);
    }

    // Fallback: was verfügbar ist
    return vectorResults.length > 0 ? vectorResults : keywordResults;
  }

  /** Reciprocal Rank Fusion — kombiniert zwei Rankings fair */
  private reciprocalRankFusion(results: SearchResult[], topK: number): SearchResult[] {
    const k = 60;
    const scoreMap = new Map<string, { result: SearchResult; score: number }>();

    const byMethod = new Map<string, SearchResult[]>();
    for (const r of results) {
      const list = byMethod.get(r.method) || [];
      list.push(r);
      byMethod.set(r.method, list);
    }

    for (const [, methodResults] of byMethod) {
      methodResults.forEach((result, rank) => {
        const key = `${result.source}::${result.text.slice(0, 80)}`;
        const existing = scoreMap.get(key) || { result, score: 0 };
        existing.score += 1 / (k + rank + 1);
        scoreMap.set(key, existing);
      });
    }

    return [...scoreMap.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(v => v.result);
  }

  /** UI-Status: Was ist verfügbar? */
  getCapabilities(): SearchCapabilities {
    return {
      keyword: this.fulltextReady,
      vector: this.vectorReady && this.queryEmbedder.isReady(),
      vectorLoading: !this.queryEmbedder.isReady(),
      indexAge: this.vectorStore.getManifest()?.lastFullIndex || null,
      chunkCount: this.vectorStore.getChunkCount(),
    };
  }
}
```

---

## 9. Storage-Architektur (Dual-Layer)

```
┌───────────────────────────┐      ┌─────────────────────────────────┐
│    IndexedDB (Browser)    │      │    File Server (FS Access API)  │
│                           │      │                                 │
│  • chunks.json Cache      │      │  • Vorgänge (meta.json + .md)   │
│  • fulltext.json Cache    │      │  • Artefakte (Emails, Gutachten)│
│  • manifest.json Cache    │      │  • chunks.json (Vektor-Index)   │
│  • ONNX Modell-Cache      │ sync │  • manifest.json                │
│  • FS-Handle Persistenz   │◀────▶│  • fulltext.json                │
│  • User-Preferences       │      │  • Team-Config                  │
│  • Session/UI-State       │      │  • Vorlagen                     │
│  • Dirty-Flag Queue       │      │  • bridge.js                    │
└───────────────────────────┘      └─────────────────────────────────┘
```

### File Server Verzeichnisstruktur

```
\\server\TeamFlow\
├── app/
│   ├── index.html              ← Single-File App (Doppelklick!)
│   ├── bridge.js               ← Bookmarklet Bridge-Code
│   └── onboarding.html         ← Anleitung + Bookmarklet-Install
│
├── data/
│   ├── .teamflow/
│   │   └── config.json         ← Team-weite Config
│   │
│   ├── users/
│   │   └── {username}/
│   │       ├── profile.json    ← Name, Farbe, Abteilung
│   │       ├── workspace.json  ← Letzter UI-State
│   │       └── drafts/         ← Persönliche Entwürfe
│   │
│   ├── vorgaenge/
│   │   ├── bauantraege/
│   │   │   └── BA-2025-001/
│   │   │       ├── meta.json
│   │   │       ├── antrag.md
│   │   │       ├── pruefbericht.md
│   │   │       ├── nachforderung_01.md
│   │   │       └── _original/
│   │   │           └── antrag.pdf
│   │   └── forschung/
│   │       └── FA-2025-001/
│   │           └── ...
│   │
│   ├── dokumente/
│   │   ├── vorlagen/           ← MD-Templates
│   │   ├── archiv/
│   │   └── import/             ← Konvertierte Uploads
│   │
│   └── index/
│       ├── manifest.json       ← Index-Metadaten & Hashes
│       ├── chunks.json         ← Embedding-Vektoren (~5-20MB)
│       └── fulltext.json       ← MiniSearch Export (~1-5MB)
│
└── templates/
    ├── nachforderung.md
    ├── gutachten.md
    ├── email_standard.md
    └── bewilligung.md
```

---

## 10. Dokument-Konvertierung

### Pipeline (läuft in Inline Web Worker)

```
  Upload / Drag & Drop          Worker: Konvertierung        Ergebnis
┌──────────────────────┐    ┌─────────────────────────┐    ┌─────────────┐
│ .docx                │───▶│ mammoth.js → HTML       │───▶│ .md Datei   │
│                      │    │ Turndown.js → Markdown   │    │ (Frontmatter│
│ .pdf                 │───▶│ pdf.js → Text-Extraktion │    │  + Content) │
│                      │    │ → Markdown               │    │             │
│ .md / .txt           │───▶│ Durchreichen             │    │ auf File    │
│                      │    │ + Frontmatter hinzufügen  │    │ Server      │
└──────────────────────┘    └─────────────────────────┘    └─────────────┘
                                                                  │
                                                                  ▼
                                                           Im Vorgang als
                                                           Dokument verlinkt
                                                           + für Indexierung
                                                           vorgemerkt
```

### DOCX → Markdown (mammoth + Turndown)

```typescript
// src/core/services/converter/docx-to-md.ts
import mammoth from 'mammoth';
import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

export async function docxToMarkdown(
  arrayBuffer: ArrayBuffer,
  meta?: Partial<DocMeta>
): Promise<ConvertedDoc> {
  // mammoth: DOCX → Clean HTML
  const htmlResult = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1",
        "p[style-name='Heading 2'] => h2",
        "p[style-name='Heading 3'] => h3",
        "p[style-name='Betreff'] => h2.betreff",
        "p[style-name='Aktenzeichen'] => p.aktenzeichen",
      ]
    }
  );

  // Turndown: HTML → Markdown
  const markdown = turndown.turndown(htmlResult.value);

  // Frontmatter hinzufügen
  const frontmatter = {
    converted: new Date().toISOString(),
    source_format: 'docx',
    ...meta,
  };

  const fullMd = `---\n${JSON.stringify(frontmatter, null, 2)}\n---\n\n${markdown}`;

  return {
    markdown: fullMd,
    html: htmlResult.value,
    warnings: htmlResult.messages,
  };
}
```

---

## 11. UI & Theming

### Design: ChatGPT-Clean, Primärfarbe wählbar

```css
:root {
  --tf-primary-h: 221;
  --tf-primary-s: 83%;
  --tf-primary-l: 53%;

  --tf-primary: hsl(var(--tf-primary-h), var(--tf-primary-s), var(--tf-primary-l));
  --tf-primary-light: hsl(var(--tf-primary-h), var(--tf-primary-s), 93%);
  --tf-primary-dark: hsl(var(--tf-primary-h), var(--tf-primary-s), 40%);

  --tf-bg: #ffffff;
  --tf-bg-secondary: #f7f7f8;
  --tf-bg-sidebar: #f9f9f9;
  --tf-text: #0d0d0d;
  --tf-text-secondary: #666;
  --tf-border: #e5e5e5;
  --tf-hover: #ececec;

  --tf-sidebar-w: 260px;
  --tf-radius: 12px;
  --tf-radius-sm: 8px;
}

[data-theme="dark"] {
  --tf-bg: #2a2a28;
  --tf-bg-secondary: #333330;
  --tf-bg-sidebar: #222220;
  --tf-text: #cccac4;
  --tf-text-secondary: #8a8884;
  --tf-text-tertiary: #605e5a;
  --tf-border: rgba(200, 195, 180, 0.08);
  --tf-hover: rgba(200, 195, 180, 0.05);
}
```

### Primärfarbe: HSL-basiert, nur Hue ändern

```typescript
const PRESET_COLORS = [
  { name: 'Blau',    h: 221 },
  { name: 'Grün',    h: 142 },
  { name: 'Violett', h: 262 },
  { name: 'Orange',  h: 25  },
  { name: 'Teal',    h: 174 },
  { name: 'Rot',     h: 0   },
  { name: 'Neutral', h: 220, s: '10%' },
];
```

---

## 12. Plugin-System

### Plugin-Interface

```typescript
// src/core/types/plugin.ts
import { ComponentType } from 'react';

export interface TeamFlowPlugin {
  id: string;
  name: string;
  icon: string;
  category: 'workflow' | 'tools' | 'admin';
  order: number;
  component: ComponentType;
  adminOnly?: boolean;           // Nur für Admin sichtbar
  badge?: () => number | null;
  onInit?: (services: CoreServices) => Promise<void>;
}
```

### Build-Time Konfiguration

```typescript
// src/plugins.config.ts
const ALL_PLUGINS = [
  home, bauantraege, forschung, dokumente, suche, chat, einstellungen, admin
];

const enabledIds = import.meta.env.VITE_PLUGINS?.split(',');
export const enabledPlugins = enabledIds
  ? ALL_PLUGINS.filter(p => enabledIds.includes(p.id))
  : ALL_PLUGINS;
```

---

## 13. Onboarding-Flow (kein .bat nötig)

```
1. User öffnet: \\server\TeamFlow\app\index.html
   → Doppelklick, Chrome/Edge öffnet sich

2. Erster Start — Willkommens-Dialog:
   ┌──────────────────────────────────────────────┐
   │  Willkommen bei TeamFlow!                    │
   │                                              │
   │  Dein Name: [________________]               │
   │  Abteilung: [Bauanträge ▾]                   │
   │  Farbe:     🔵 🟢 🟣 🟠 ⚪                    │
   │                                              │
   │  [Weiter →]                                  │
   └──────────────────────────────────────────────┘

3. Datenverzeichnis wählen:
   ┌──────────────────────────────────────────────┐
   │  Wo liegt der TeamFlow-Datenordner?          │
   │                                              │
   │  TeamFlow speichert Vorgänge, Dokumente      │
   │  und den Suchindex auf eurem File Server.    │
   │                                              │
   │  [📁 Verzeichnis wählen]                     │
   │                                              │
   │  Erwartet: \\server\TeamFlow\data\           │
   └──────────────────────────────────────────────┘

4. Bookmarklet einrichten (optional, für AI):
   ┌──────────────────────────────────────────────┐
   │  AI-Assistent einrichten                     │
   │                                              │
   │  Ziehe diesen Link in deine Lesezeichen-     │
   │  Leiste:                                     │
   │                                              │
   │      [🔗 TeamFlow Bridge]  ← Draggable!      │
   │                                              │
   │  Dann: Streamlit öffnen → Bookmarklet        │
   │  klicken → grünes Badge erscheint            │
   │                                              │
   │  [Testen] [Überspringen]                     │
   └──────────────────────────────────────────────┘

5. Fertig! Dashboard wird angezeigt.
   Embedding-Modell lädt im Hintergrund (~23MB, einmalig).
```

---

## 14. Performance-Budget (Schwache Laptops)

| Metrik | Budget | Begründung |
|---|---|---|
| **App laden** (Single-File) | <3s | ~1-2MB HTML über SMB |
| **Embedding-Modell laden** (erst-Start) | ~30-60s | 23MB von CDN, danach IndexedDB |
| **Embedding-Modell laden** (cached) | <3s | Aus IndexedDB |
| **Query embedden** | <200ms | 1 Satz, WASM, Intel 11th Gen |
| **Vektor-Suche** (3.000 Chunks) | <10ms | Cosine Sim im RAM |
| **Keyword-Suche** | <50ms | MiniSearch, invertierter Index |
| **Index vom Server laden** | <5s | chunks.json ~5-10MB über SMB |
| **DOCX konvertieren** | <2s | mammoth + Turndown, typisches Dokument |
| **PDF konvertieren** | <5s | pdf.js, ~20 Seiten |
| **RAM Baseline** | <200MB | App + Modell + Index im RAM |

---

## 15. MVP-Scope & Phasen

### Phase 1: Grundgerüst (MVP)
- [ ] Vite + React + Tailwind Setup
- [ ] Single-File Build (`file://` verifiziert)
- [ ] App-Shell: Sidebar + Plugin-Router
- [ ] CSS Variable Theming (Primärfarbe + Dark/Light)
- [ ] Storage: IndexedDB + File System Access API
- [ ] Plugin: Einstellungen (Theme, Profil, AI-Provider)
- [ ] Plugin: Bauanträge (CRUD, Liste, Detail)
- [ ] Onboarding-Flow (Name, Verzeichnis, Farbe)

### Phase 2: AI & Dokumente
- [ ] Bookmarklet Bridge (postMessage, bridge.js)
- [ ] AI Bridge mit Vercel AI SDK Custom Transport
- [ ] Plugin: Chat (freier AI-Dialog via useChat)
- [ ] Dokument-Import: DOCX → MD (Inline Worker)
- [ ] PDF → MD Konvertierung (Inline Worker)
- [ ] Direct LLM Transport (llama.cpp / Cloud)
- [ ] Artefakt-Generierung (Nachforderung, Email, Gutachten)

### Phase 3: Suche & Index
- [ ] MiniSearch: Volltext-Keyword-Suche
- [ ] Admin-Plugin: Batch-Indexer (WebGPU/WASM)
- [ ] Query-Embedder: Transformers.js auf schwachen Clients
- [ ] VectorStore: chunks.json Laden + Caching
- [ ] Plugin: Suche (Hybrid: Keyword + Vektor + RRF)
- [ ] Tag-System & Filtering

### Phase 4: Workflows & Erweiterung
- [ ] Plugin: Forschungsanträge
- [ ] Workflow-Engine (Status-Transitions, Fristen)
- [ ] Template-System (MD-Templates mit Platzhaltern)
- [ ] Vercel AI SDK Tool-Calling (Agenten)
- [ ] DOCX-Export (docx library)
- [ ] Multi-User Conflict Detection
- [ ] Inkrementelle Index-Updates

### Phase 5: Komplexe UI (aus Screenshots)
- [ ] Prompt Workbench Plugin (Block-Editor, Variablen, Live Preview)
- [ ] Version History Plugin (Diff-View, Timeline, Restore)
- [ ] Peer Review Plugin (Inline-Kommentare, Freigabe)
- [ ] Drag & Drop Block-Editor (@dnd-kit)
- [ ] Resizable Multi-Panel Layouts (react-resizable-panels)
- [ ] CodeMirror 6 Integration (Syntax-Highlighting, Variablen)
- [ ] Performance-Metriken Dashboard

### Phase 6: Polish
- [ ] Offline-First mit Sync Queue
- [ ] Tastatur-Shortcuts
- [ ] Embedding-Modell Upgrade-Path
- [ ] Performance: Lazy Loading, Virtualisierung (@tanstack/react-virtual)
- [ ] Onboarding.html auf File Server

---

## 16. Nächste Schritte (Claude Code Session)

```bash
# 1. Projekt init
mkdir teamflow-local && cd teamflow-local
git init
npm create vite@latest . -- --template react-ts

# 2. Core Dependencies
npm install react react-dom zustand
npm install mammoth turndown marked minisearch
npm install lucide-react
npm install -D tailwindcss @tailwindcss/vite vite-plugin-singlefile
npm install -D @vitejs/plugin-react
npm install -D @types/turndown @types/react @types/react-dom

# 3. Phase 2 (AI & Dokumente):
# npm install @ai-sdk/react @ai-sdk/openai
# npm install @huggingface/transformers
# npm install pdfjs-dist

# 4. Phase 5 (Komplexe UI aus Screenshots):
# npm install @dnd-kit/core @dnd-kit/sortable
# npm install react-resizable-panels
# npm install react-diff-viewer-continued
# npm install @codemirror/state @codemirror/view @codemirror/lang-markdown
# npm install @tanstack/react-virtual
# npm install sonner

# 4. Struktur anlegen
mkdir -p src/{core/{services/{storage,ai/transports,search,converter},hooks,types},plugins/{home,bauantraege,forschung,dokumente,suche,chat,einstellungen,admin},ui}

# 5. Implementierungs-Reihenfolge:
#    a) App-Shell (Sidebar + Plugin Router + Shell.tsx)
#    b) Theme System (CSS Variables + Farbwahl)
#    c) Storage Service (IDB + File System Access API)
#    d) Onboarding (Erststart-Dialog)
#    e) Plugin: Einstellungen
#    f) Plugin: Bauanträge (CRUD)
#    g) Single-File Build auf File Server testen
```
