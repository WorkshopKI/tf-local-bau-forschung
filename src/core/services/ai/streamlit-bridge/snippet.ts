/**
 * Streamlit-Bridge-Bookmarklet als String (Single Source of Truth:
 * bridge-snippet.source.js — eigener Basename, damit `import '.../snippet'`
 * eindeutig diese .ts trifft, nicht die .js).
 *
 * `?raw` inlined den Quelltext zur BUILD-Zeit in das Bundle — kein Runtime-
 * `fetch`, läuft damit unter `file://` (Pitfall #1/#2). Aus `BRIDGE_SNIPPET`
 * baut die `StreamlitBridgeSection` das `javascript:`-Bookmarklet.
 */
import snippet from './bridge-snippet.source.js?raw';

export const BRIDGE_SNIPPET: string = snippet;

/** Fertiges `javascript:`-Bookmarklet (URL-encodiert) zum Ziehen/Kopieren. */
export const BRIDGE_BOOKMARKLET: string = 'javascript:' + encodeURIComponent(BRIDGE_SNIPPET);
