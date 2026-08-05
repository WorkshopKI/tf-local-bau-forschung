import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CONFIG, deepMerge } from './scripts/config-schema.mjs';
import { faviconLinkTag, FAVICON_DEFAULT_COLOR } from './scripts/favicon.mjs';
import { localFsPlugin, type LocalBlock } from './scripts/local-fs/plugin';

// Dev-Server-Fallback: wenn TEAMFLOW_CONFIG nicht gesetzt ist (= `vite` direkt
// statt `build-with-config.mjs`), lesen wir configs/_shared.json und mergen
// auf DEFAULT_CONFIG. So sieht der Dev-Server denselben SMB-Pfad wie die
// gebauten Varianten.
const sharedConfigPath = fileURLToPath(new URL('./configs/_shared.json', import.meta.url));
const sharedConfig: unknown = (() => {
  if (!existsSync(sharedConfigPath)) return null;
  try { return JSON.parse(readFileSync(sharedConfigPath, 'utf-8')); } catch { return null; }
})();
const devFallbackConfig: unknown = sharedConfig
  ? deepMerge(DEFAULT_CONFIG, sharedConfig)
  : DEFAULT_CONFIG;

/**
 * Sammelt alle konfigurierten Ordner-Wurzeln der Variante „local" (Einzel-Slots
 * + die `{id: pfad}`-Maps) als absolute Pfade — für den Watcher-Ausschluss unten.
 */
function sammleLocalRoots(local: Record<string, unknown> | null | undefined): string[] {
  if (!local) return [];
  const out: string[] = [];
  for (const wert of Object.values(local)) {
    if (typeof wert === 'string' && wert.trim()) {
      out.push(wert);
    } else if (wert && typeof wert === 'object' && !Array.isArray(wert)) {
      for (const inner of Object.values(wert as Record<string, unknown>)) {
        if (typeof inner === 'string' && inner.trim()) out.push(inner);
      }
    }
  }
  return out;
}

/** Vergleichsform für Pfad-Präfixe: Forward-Slashes, auf win32 zusätzlich lowercase. */
function pfadSchluessel(p: string): string {
  const norm = path.resolve(p).replace(/\\/g, '/');
  return process.platform === 'win32' ? norm.toLowerCase() : norm;
}

// Single source of truth für die App-Version: package.json#version.
const pkgPath = fileURLToPath(new URL('./package.json', import.meta.url));
const appVersion: string = (() => {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

export default defineConfig(({ command, mode }) => {
  const isSingle = mode === 'single';

  // Config kommt entweder aus dem Build-Orchestrator (scripts/build-with-config.mjs)
  // via Env-Var oder als Fallback aus DEFAULT_CONFIG + _shared.json (dev server,
  // generisches `vite build`).
  const rawConfig = process.env.TEAMFLOW_CONFIG ?? JSON.stringify(devFallbackConfig);
  const buildTime = process.env.TEAMFLOW_BUILD_TIME ?? new Date().toISOString();
  const gitHash = process.env.TEAMFLOW_GIT_HASH ?? 'unknown';

  // Parse rawConfig, um einzelne Flags als Literal-Defines verfügbar zu machen.
  // Literal-Defines werden vom Minifier als Konstanten behandelt und erlauben
  // Dead-Code-Elimination (Akzeptanz-Kriterium: keine Fixture-Funktionen im Prod-Bundle).
  const parsedConfig = JSON.parse(rawConfig);
  const devFixturesEnabled = Boolean(parsedConfig.features?.devFixtures);

  // Variante „local": feste lokale Ordner statt FSAPI-Picker (nur Dev-Maschine).
  // `command === 'serve'` ist der harte Riegel — JEDER Build (auch ein
  // versehentlicher mit local-Block in der Config) faltet die Konstante auf
  // `false`, Rollup eliminiert den kompletten Zweig. Zweite Schicht:
  // validateConfig bricht bei `local` + variant="production" KRITISCH ab.
  const localFsEnabled = command === 'serve' && Boolean(parsedConfig.local);
  const localRoots: string[] = localFsEnabled ? sammleLocalRoots(parsedConfig.local) : [];

  // Tab-Title + Loader-Label + Favicon aus der Config in index.html injizieren.
  // Ohne diesen Hook flasht beim ersten Laden kurz "TeamFlow Local" (statisch
  // im HTML), bis App.tsx via document.title den Wert ueberschreibt. Das Favicon
  // hat KEIN Laufzeit-Pendant — es ist ausschliesslich hier gebacken.
  const tabTitle = (parsedConfig.build?.browserTabTitle as string | undefined) ?? 'TeamFlow';
  const buildLabel = (parsedConfig.build?.label as string | undefined) ?? tabTitle;
  const faviconColor = (parsedConfig.build?.faviconColor as string | undefined) ?? FAVICON_DEFAULT_COLOR;
  const escapeHtml = (s: string): string => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'teamflow-index-html-branding',
        transformIndexHtml: {
          order: 'pre' as const,
          handler(html: string) {
            return html
              .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(tabTitle)}</title>`)
              .replace(
                /(<div class="tf-loader-title">)[^<]*(<\/div>)/,
                `$1${escapeHtml(buildLabel)}$2`,
              )
              .replace(/<link rel="icon"[^>]*>/, faviconLinkTag(faviconColor));
          },
        },
      },
      isSingle && viteSingleFile(),
      // Variante „local": Dateisystem-Brücke über die festen Ordner. Das Plugin
      // ist `apply: 'serve'` — es existiert in keinem Build.
      localFsEnabled && localFsPlugin(parsedConfig.local as LocalBlock),
    ].filter(Boolean),
    define: {
      __TEAMFLOW_CONFIG__: rawConfig,
      __TEAMFLOW_BUILD_TIME__: JSON.stringify(buildTime),
      __TEAMFLOW_GIT_HASH__: JSON.stringify(gitHash),
      __TEAMFLOW_APP_VERSION__: JSON.stringify(appVersion),
      __TEAMFLOW_DEV_FIXTURES__: JSON.stringify(devFixturesEnabled),
      __TEAMFLOW_LOCAL_FS__: JSON.stringify(localFsEnabled),
    },
    build: {
      target: 'esnext',
      outDir: isSingle ? 'dist-single' : 'dist',
      emptyOutDir: !isSingle,
      assetsInlineLimit: isSingle ? Infinity : 4096,
    },
    base: isSingle ? '' : './',
    worker: { format: 'iife' },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      watch: {
        ignored: [
          '**/_reference/**',
          '**/_design/**',
          // Build-Ausgabe: `npm run build:*` schreibt hierhin. Ohne diesen
          // Eintrag reisst ein Build jeden parallel laufenden Dev-Server aus
          // dem Lauf (Vite meldet „page reload dist-single/index.html") — mitten
          // in einer Messung oder Abnahme. Dieselbe Klasse wie die lokalen
          // Datenordner unten, nur die andere Schreibrichtung.
          '**/dist-single/**',
          '**/dist/**',
          // Variante „local": die App schreibt waehrend des Betriebs in ihre
          // Datenordner (Snapshots, Audit-Log, Sidecars). Liegt eine Wurzel im
          // Projekt, loeste jeder dieser Writes einen HMR-Reload mitten im Lauf
          // aus. Als FUNKTION statt Glob, weil die Pfade Leerzeichen und
          // Glob-Sonderzeichen enthalten koennen (z.B. „DMS Vorlagen").
          ...(localRoots.length > 0
            ? [(p: string): boolean => {
                const kandidat = pfadSchluessel(p);
                return localRoots.some(root => {
                  const praefix = pfadSchluessel(root);
                  return kandidat === praefix || kandidat.startsWith(`${praefix}/`);
                });
              }]
            : []),
        ],
      },
    },
  };
});
