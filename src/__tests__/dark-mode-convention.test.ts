/**
 * Guard `no-raw-set-dark-mode` (v2.371.1).
 *
 * `setDarkMode` setzt NUR das `data-theme`-Attribut. Wer es direkt ruft, ohne
 * `profile.theme.dark` mitzuschreiben, baut einen Umschalter, dessen Ergebnis
 * beim nächsten Start weg ist — App.tsx wendet beim Boot das Profil an. Genau
 * so war es bis v2.371: Einstellungen → Darstellung persistierte, das
 * Tastenkürzel Strg+Umschalt+D und der Command-Palette-Eintrag nicht.
 *
 * Bewusst NICHT in codebase-conventions.test.ts (die steht an ihrem
 * MAX_FILE_LOC-Limit) — gleiche Begründung wie bei doc-links.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { sep } from 'node:path';
import { ALL_TS_FILES, findInFile, fmt, type Finding } from './conventions-lib';

const PATTERN = /\bsetDarkMode\s*\(/;

/** Wo `setDarkMode` legitim steht. */
const ERLAUBT = [
  `${sep}components${sep}ui${sep}theme.ts`,      // Definition
  `${sep}core${sep}hooks${sep}useDarkMode.ts`,   // einziger Umschaltweg
  `${sep}core${sep}App.tsx`,                     // Boot: wendet das Profil an
];

describe('no-raw-set-dark-mode', () => {
  it('kein direkter setDarkMode-Aufruf ausserhalb von theme.ts / useDarkMode.ts / App.tsx', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (ERLAUBT.some(heimat => file.endsWith(heimat))) continue;
      if (file.includes(`${sep}__tests__${sep}`) || file.endsWith('.test.ts')) continue;
      findings.push(...findInFile(file, l => PATTERN.test(l), 'allow-raw-set-dark-mode'));
    }

    if (findings.length > 0) {
      const msg =
        `Dark-Mode-Umschalten nur ueber den geteilten Hook (v2.371.1).\n` +
        `Stattdessen:\n` +
        `  import { useDarkMode } from '@/core/hooks/useDarkMode';\n` +
        `  const { dark, umschalten } = useDarkMode();   // setzt DOM UND Profil\n` +
        `Nur-Anwenden ohne Umschalten (Boot, Onboarding-Abschluss) gehoert nach App.tsx.\n` +
        `Sonderfall? Zeile mit '// allow-raw-set-dark-mode: <grund>' markieren.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});
