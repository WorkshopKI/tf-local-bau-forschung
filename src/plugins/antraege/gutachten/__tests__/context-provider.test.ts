import { describe, it, expect } from 'vitest';
import { buildVorherigeAbschnitte } from '../context-provider';
import { ZIM_EP_WORKFLOW } from '../workflow-definition';
import { emptyRun, applyGeneration, freigeben } from '../runner';
import type { WorkflowRun } from '../types';

const NOW = '2026-06-11T10:00:00.000Z';

function gen(finalerText: string) {
  return {
    quellenanalyse: 'qa', entwurf: '', finalerText, checks: [],
    modell: 'm', skillId: 's', skillVersion: 1,
  };
}

function runABfreigegebenCentwurf(): WorkflowRun {
  let run = emptyRun('AZ', NOW);
  run = applyGeneration(run, 'A', gen('Kurzfassungstext.'), NOW);
  run = freigeben(run, 'A', NOW);
  run = applyGeneration(run, 'B', gen('Hintergrundtext.'), NOW);
  run = freigeben(run, 'B', NOW);
  run = applyGeneration(run, 'C', gen('Risiken-Entwurf (noch nicht frei).'), NOW);
  return run;
}

describe('buildVorherigeAbschnitte', () => {
  it('ist leer für Schritt A (keiner davor) — A bleibt byte-identisch', () => {
    const run = runABfreigegebenCentwurf();
    expect(buildVorherigeAbschnitte(run, 'A', ZIM_EP_WORKFLOW)).toBe('');
  });

  it('enthält nur FREIGEGEBENE frühere Abschnitte (Entwurf/leer ausgelassen)', () => {
    const run = runABfreigegebenCentwurf();
    // Für D: A+B freigegeben (rein), C ist nur Entwurf (raus), E–G leer (raus).
    const block = buildVorherigeAbschnitte(run, 'D', ZIM_EP_WORKFLOW);
    expect(block).toContain('### Abschnitt A — Kurzfassung');
    expect(block).toContain('Kurzfassungstext.');
    expect(block).toContain('### Abschnitt B — Hintergrund, Stand der Technik, Lösungsweg');
    expect(block).toContain('Hintergrundtext.');
    expect(block).not.toContain('Risiken-Entwurf'); // C nicht freigegeben
  });

  it('behält die A–G-Reihenfolge bei', () => {
    const run = runABfreigegebenCentwurf();
    const block = buildVorherigeAbschnitte(run, 'C', ZIM_EP_WORKFLOW);
    expect(block.indexOf('Abschnitt A')).toBeLessThan(block.indexOf('Abschnitt B'));
  });

  it('kürzt lange Abschnitte am Absatzende mit …', () => {
    let run = emptyRun('AZ', NOW);
    const lang = `${'wort '.repeat(300)}\n\n${'rest '.repeat(300)}`;
    run = applyGeneration(run, 'A', gen(lang), NOW);
    run = freigeben(run, 'A', NOW);
    const block = buildVorherigeAbschnitte(run, 'B', ZIM_EP_WORKFLOW, 200);
    expect(block.length).toBeLessThan(lang.length);
    expect(block.endsWith('…')).toBe(true);
  });
});
