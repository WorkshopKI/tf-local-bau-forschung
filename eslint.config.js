// Bewusst MINIMALE Flat-Config: der einzige Zweck ist der statische Guard gegen
// Rules-of-Hooks-Verstöße (Hook nach Early-Return / bedingter Hook / Hook im
// Loop) — genau die Bug-Klasse, die React #310 auslöst und die `tsc` NICHT
// erkennt. KEIN Style-/Type-Linting, damit der Bestand nicht von Alt-Warnungen
// überflutet wird. `exhaustive-deps` bleibt bewusst aus; kann später separat
// aktiviert werden.
//
// Kein type-aware Linting (kein `parserOptions.project`) → entkoppelt von der
// TypeScript-Version, schnell. Lauf: `npm run lint`.
//
// Der `@typescript-eslint`-Plugin wird nur REGISTRIERT (keine Regel aktiv),
// damit die im Bestand verstreuten `// eslint-disable @typescript-eslint/*`-
// Direktiven eine Regel-Definition finden (sonst „rule not found"-Error). Aus
// demselben Grund ist `reportUnusedDisableDirectives` aus — die vielen
// dormanten `exhaustive-deps`/`no-console`-Direktiven sind gewollt inaktiv,
// keine Fehler.
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'dist/**',
      'dist-single/**',
      'dist*/**',
      'node_modules/**',
      '_archive/**',
      '_reference/**',
      '.vite/**',
      'scripts/**',
      'eval/**',
      'eval-out/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/*.config.mjs',
      '**/*.config.mts',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    plugins: {
      'react-hooks': reactHooks,
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
];
