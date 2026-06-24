/**
 * Invariante: die flachen `finalerText`-Konsumenten (DOCX-Füller, LLM-Judge,
 * deterministische Checks, Eval-Report) lesen NIE `teile[]` — `finalerText`
 * bleibt die alleinige Quelle der Wahrheit. Strukturierte Teile sind rein
 * additiv (UI/Render). Dieser Guard fängt späteres Drift (jemand verdrahtet
 * DOCX/Judge auf `.teile`), bevor es den Blast-Radius vergrößert.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// vitest läuft aus dem Repo-Root → cwd ist die Projektwurzel.
const ROOT = process.cwd();

const CONSUMER_FILES = [
  'src/core/services/gutachten-vorlagen/fill-template.ts',
  'src/core/services/skill-eval/eval-run.ts',
  'src/core/services/skill-eval/judge.ts',
  'src/core/services/skill-eval/report.ts',
];

describe('finalerText-Konsumenten ignorieren teile[]', () => {
  it.each(CONSUMER_FILES)('%s referenziert kein `.teile`', (rel) => {
    const src = readFileSync(join(ROOT, rel), 'utf-8');
    // Property-Zugriff `.teile` (nicht in Kommentaren) — die Konsumenten nehmen
    // ausschließlich `finalerText`-Strings entgegen.
    const offenders = src.split(/\r?\n/)
      .map((l, i) => ({ l: l.trim(), n: i + 1 }))
      .filter(({ l }) => !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*'))
      .filter(({ l }) => /\.teile\b/.test(l));
    expect(offenders, `${rel} darf teile[] nicht lesen:\n${offenders.map(o => `  :${o.n} ${o.l}`).join('\n')}`).toEqual([]);
  });
});
