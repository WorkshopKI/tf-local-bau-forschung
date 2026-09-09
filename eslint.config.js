// Bewusst MINIMALE Flat-Config: der einzige Zweck ist der statische Guard gegen
// Rules-of-Hooks-Verstöße (Hook nach Early-Return / bedingter Hook / Hook im
// Loop) — genau die Bug-Klasse, die React #310 auslöst und die `tsc` NICHT
// erkennt. KEIN Style-/Type-Linting, damit der Bestand nicht von Alt-Warnungen
// überflutet wird. `exhaustive-deps` bleibt bewusst aus; kann später separat
// aktiviert werden.
//
// WAS DAS KOSTEN WÜRDE — gemessen am 09.09.2026 (v6.45), damit die Entscheidung
// nicht länger gegen eine unbekannte Zahl läuft:
//
//   49 Verstöße in 38 Dateien  — wenn die Regel HEUTE auf `warn` ginge
//                                (die vorhandenen Direktiven bleiben wirksam)
//   91 Verstöße in 67 Dateien  — ohne jede Inline-Direktive (`--no-inline-config`)
//   ⇒ 42 davon verdecken die 50 vorhandenen `exhaustive-deps`-Direktiven.
//
// Nachzustellen mit: Regel unten auf 'warn', dann
// `npx eslint . --no-cache -f json` (einmal mit, einmal ohne `--no-inline-config`).
//
// Die Zahl ist also endlich, nicht „eine Flut" — aber sie ist auch nicht null,
// und die 42 verdeckten sind der eigentliche Bestand: Direktiven, die eine
// AUSGESCHALTETE Regel stummschalten, verbergen echte Befunde für den Tag, an
// dem jemand sie einschaltet. Wer die Regel aktiviert, hebt beide Hälften.
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
