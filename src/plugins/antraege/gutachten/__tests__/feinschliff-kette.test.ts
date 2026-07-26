/**
 * Die Generierungs-Kette hängt den sprachlichen Feinschliff automatisch an
 * (Phase 2). Getestet wird die Degradations-Entscheidung `mitFeinschliff` — der
 * Lektor-Lauf kommt als Thunk herein, deshalb braucht es hier weder Transport
 * noch Bridge. Zusätzlich der Verlaufs-Kontrakt, auf dem der Versionsvergleich
 * „roh ↔ poliert" beruht.
 */
import { describe, it, expect } from 'vitest';
import { mitFeinschliff } from '../workflow-generierung';
import { emptyRun, applyGeneration, applyLektorat, type GenerationInput } from '../runner';
import type { CheckResult } from '@/core/services/skills';
import type { WorkflowRun } from '../types';

const NOW = '2026-07-20T10:00:00.000Z';
const LATER = '2026-07-20T10:05:00.000Z';

function gen(finalerText: string, over: Partial<GenerationInput> = {}): GenerationInput {
  return {
    quellenanalyse: 'qa', entwurf: '', finalerText, checks: [],
    modell: 'llama.cpp', skillId: 'gutachten-kurzfassung', skillVersion: 3, ...over,
  };
}

const CHECK_ROH: CheckResult = { id: 'wortanzahl', level: 'hinweis', label: 'Umfang' };
const CHECK_POLIERT: CheckResult = { id: 'wortanzahl', level: 'ok', label: 'Umfang' };

/** Frisch generierter Rohentwurf für A — der Eingang der Kette. */
function rohStand(): { next: WorkflowRun; checks: CheckResult[] } {
  const next = applyGeneration(emptyRun('16EP051840', NOW), 'A', gen('Rohentwurf.', { checks: [CHECK_ROH] }), NOW);
  return { next, checks: [CHECK_ROH] };
}

describe('mitFeinschliff — Erfolg', () => {
  it('der polierte Text wird final, der Rohentwurf landet im Verlauf', async () => {
    const roh = rohStand();
    const r = await mitFeinschliff(roh, 'A', async () => applyLektorat(roh.next, 'A', {
      finalerText: 'Polierter Entwurf.', checks: [CHECK_POLIERT], modell: 'llama.cpp',
    }, LATER));

    const step = r.next.schritte['A']!;
    expect(step.finalerText).toBe('Polierter Entwurf.');
    expect(step.lektoriert).toBe(true);
    expect(step.feinschliffUebersprungen).toBeUndefined();
    // Versionsvergleich roh ↔ poliert: der Rohentwurf MUSS als Vorfassung dastehen.
    expect(step.verlauf?.map(v => v.finalerText)).toEqual(['Rohentwurf.']);
  });

  it('die zurueckgegebenen checks stammen vom final ANGEZEIGTEN Text', async () => {
    const roh = rohStand();
    const r = await mitFeinschliff(roh, 'A', async () => applyLektorat(roh.next, 'A', {
      finalerText: 'Polierter Entwurf.', checks: [CHECK_POLIERT], modell: 'llama.cpp',
    }, LATER));
    // Sonst entschiede der Auto-Retry-Orchestrator ueber einen Text, der gar nicht mehr sichtbar ist.
    expect(r.checks).toEqual([CHECK_POLIERT]);
  });
});

describe('mitFeinschliff — Degradation zum Rohentwurf', () => {
  it('Tor gezogen (null): Rohentwurf bleibt final und wird als uebersprungen markiert', async () => {
    const roh = rohStand();
    const r = await mitFeinschliff(roh, 'A', async () => null);
    const step = r.next.schritte['A']!;
    expect(step.finalerText).toBe('Rohentwurf.');
    expect(step.feinschliffUebersprungen).toBe(true);
    expect(step.lektoriert).toBeUndefined();
    expect(r.checks).toEqual([CHECK_ROH]);
  });

  it('Wurf im Feinschliff blockiert die Generierung nicht', async () => {
    const roh = rohStand();
    const r = await mitFeinschliff(roh, 'A', async () => { throw new Error('Transport weg'); });
    expect(r.next.schritte['A']!.finalerText).toBe('Rohentwurf.');
    expect(r.next.schritte['A']!.feinschliffUebersprungen).toBe(true);
  });

  it('Abbruch im Feinschliff verwirft den bereits berechneten Rohentwurf NICHT', async () => {
    const roh = rohStand();
    const r = await mitFeinschliff(roh, 'A', async () => {
      throw new DOMException('Aborted', 'AbortError');
    });
    expect(r.next.schritte['A']!.finalerText).toBe('Rohentwurf.');
    expect(r.next.schritte['A']!.feinschliffUebersprungen).toBe(true);
    expect(r.checks).toEqual([CHECK_ROH]);
  });

  it('markiert nur den betroffenen Abschnitt', async () => {
    let basis = applyGeneration(emptyRun('AZ', NOW), 'A', gen('A-Text'), NOW);
    basis = applyGeneration(basis, 'B', gen('B-Text'), NOW);
    const r = await mitFeinschliff({ next: basis, checks: [] }, 'B', async () => null);
    expect(r.next.schritte['A']!.feinschliffUebersprungen).toBeUndefined();
    expect(r.next.schritte['B']!.feinschliffUebersprungen).toBe(true);
  });
});

describe('applyLektorat heilt einen uebersprungenen Feinschliff', () => {
  it('ein spaeterer manueller Feinschliff loescht die Markierung', async () => {
    const roh = rohStand();
    const uebersprungen = (await mitFeinschliff(roh, 'A', async () => null)).next;
    expect(uebersprungen.schritte['A']!.feinschliffUebersprungen).toBe(true);

    const nachManuell = applyLektorat(uebersprungen, 'A', {
      finalerText: 'Nachtraeglich poliert.', checks: [], modell: 'llama.cpp',
    }, LATER);
    expect(nachManuell.schritte['A']!.feinschliffUebersprungen).toBeUndefined();
    expect(nachManuell.schritte['A']!.lektoriert).toBe(true);
  });
});
