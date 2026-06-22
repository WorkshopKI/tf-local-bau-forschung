import { describe, it, expect } from 'vitest';
import {
  emptyRun,
  firstNonFreigegeben,
  fruehereInArbeit,
  leereSchritte,
  applyGeneration,
  applyPruefen,
  applyQsHinweise,
  freigeben,
  erneutOeffnen,
  weiterschalten,
  verwerfen,
  uebernehmen,
  type GenerationInput,
} from '../runner';
import { ZIM_EP_DEF } from '@/core/services/skills';
import type { QsBefund, WorkflowRun } from '../types';

const NOW = '2026-06-11T10:00:00.000Z';
const LATER = '2026-06-12T10:00:00.000Z';

function gen(finalerText: string, over: Partial<GenerationInput> = {}): GenerationInput {
  return {
    quellenanalyse: 'qa', entwurf: '', finalerText, checks: [],
    modell: 'llama.cpp', skillId: 's', skillVersion: 1, ...over,
  };
}

/** Run mit A+B+C freigegeben, D entwurf, E–G leer (Mockup-Übersicht-Stand). */
function runMitABCfreigegeben(): WorkflowRun {
  let run = emptyRun('16EP051840', NOW);
  for (const id of ['A', 'B', 'C'] as const) {
    run = applyGeneration(run, id, gen(`Text ${id}`), NOW);
    run = freigeben(run, id, NOW);
  }
  run = applyGeneration(run, 'D', gen('Text D'), NOW);
  return run;
}

describe('emptyRun', () => {
  it('startet bei A mit leeren Schritten', () => {
    const run = emptyRun('AZ', NOW);
    expect(run.aktiverSchritt).toBe('A');
    expect(run.schritte).toEqual({});
    expect(run.schemaVersion).toBe(1);
  });
});

describe('applyGeneration', () => {
  it('setzt einen Entwurf ein, ohne aktiverSchritt zu ändern', () => {
    const run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Hallo'), NOW);
    expect(run.schritte.A?.status).toBe('entwurf');
    expect(run.schritte.A?.finalerText).toBe('Hallo');
    expect(run.aktiverSchritt).toBe('A');
    expect(run.schritte.A?.verlauf).toEqual([]);
  });

  it('hängt die bisher aktive Fassung in den Verlauf', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Erst'), NOW);
    run = applyGeneration(run, 'A', gen('Zweit', { modifier: 'laenger' }), LATER);
    expect(run.schritte.A?.finalerText).toBe('Zweit');
    expect(run.schritte.A?.verlauf).toHaveLength(1);
    expect(run.schritte.A?.verlauf?.[0]?.finalerText).toBe('Erst');
  });
});

describe('applyPruefen', () => {
  it('ersetzt die Checks eines Schritts', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('x'), NOW);
    run = applyPruefen(run, 'A', [{ id: 'r', level: 'fehler', label: 'L' }], NOW);
    expect(run.schritte.A?.checks).toHaveLength(1);
    expect(run.schritte.A?.checks[0]?.level).toBe('fehler');
  });
  it('no-op bei leerem Schritt', () => {
    const run = applyPruefen(emptyRun('AZ', NOW), 'B', [{ id: 'r', level: 'ok', label: 'L' }], NOW);
    expect(run.schritte.B).toBeUndefined();
  });
});

describe('applyQsHinweise', () => {
  const befund = (dimension: string, bewertung: QsBefund['bewertung']): QsBefund => ({ dimension, bewertung, text: 't' });

  it('setzt beratende Befunde am Schritt, ohne Status/Text zu ändern', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Text A', { checks: [{ id: 'r', level: 'ok', label: 'L' }] }), NOW);
    run = applyQsHinweise(run, 'A', [befund('Erdung in der VB', 'hinweis')], LATER);
    expect(run.schritte.A?.qsHinweise).toHaveLength(1);
    expect(run.schritte.A?.qsHinweise?.[0]?.bewertung).toBe('hinweis');
    expect(run.schritte.A?.status).toBe('entwurf');   // kein Status-Wechsel
    expect(run.schritte.A?.finalerText).toBe('Text A'); // kein Overwrite
    expect(run.schritte.A?.checks).toHaveLength(1);      // checks unberührt
  });

  it('überschreibt vorhandene Befunde', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Text A'), NOW);
    run = applyQsHinweise(run, 'A', [befund('Ton', 'hinweis')], NOW);
    run = applyQsHinweise(run, 'A', [befund('Ton', 'ok'), befund('Kohärenz', 'ok')], LATER);
    expect(run.schritte.A?.qsHinweise).toHaveLength(2);
    expect(run.schritte.A?.qsHinweise?.[0]?.bewertung).toBe('ok');
  });

  it('no-op bei leerem Schritt (man bewertet nur Generiertes)', () => {
    const run0 = emptyRun('AZ', NOW);
    expect(applyQsHinweise(run0, 'B', [befund('Ton', 'ok')], NOW)).toBe(run0);
  });

  it('lässt das Eingabe-Objekt unangetastet (Immutabilität)', () => {
    const run0 = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Text A'), NOW);
    const run1 = applyQsHinweise(run0, 'A', [befund('Ton', 'ok')], LATER);
    expect(run1).not.toBe(run0);
    expect(run0.schritte.A?.qsHinweise).toBeUndefined();
  });
});

describe('leereSchritte (Bulk „Alle Abschnitte erstellen" — nur fehlende)', () => {
  it('liefert die noch fehlenden Abschnitte in Order-Reihenfolge', () => {
    // A+B+C freigegeben, D entwurf → fehlend: E, F, G.
    expect(leereSchritte(runMitABCfreigegeben())).toEqual(['E', 'F', 'G']);
  });

  it('alle leer → alle Abschnitte', () => {
    expect(leereSchritte(emptyRun('AZ', NOW))).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });

  it('nichts fehlend → leere Liste (Button bleibt aus)', () => {
    let run = emptyRun('AZ', NOW);
    for (const id of ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const) run = applyGeneration(run, id, gen(`T${id}`), NOW);
    expect(leereSchritte(run)).toEqual([]);
  });

  it('Entwürfe + Freigaben gelten als vorhanden (werden NICHT erneut erzeugt)', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Text A'), NOW); // A entwurf
    run = applyGeneration(run, 'B', gen('Text B'), NOW);
    run = freigeben(run, 'B', NOW); // B freigegeben
    expect(leereSchritte(run)).toEqual(['C', 'D', 'E', 'F', 'G']);
  });

  it('folgt einer abweichenden Order (autoritativ)', () => {
    const run = applyGeneration(emptyRun('AZ', NOW), 'B', gen('Text B'), NOW); // nur B vorhanden
    expect(leereSchritte(run, ['B', 'A', 'C'])).toEqual(['A', 'C']);
  });
});

describe('freigeben', () => {
  it('setzt freigegeben + Hash und rückt aktiverSchritt vor', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Text A'), NOW);
    run = freigeben(run, 'A', NOW);
    expect(run.schritte.A?.status).toBe('freigegeben');
    expect(run.schritte.A?.freigegeben_am).toBe(NOW);
    expect(run.schritte.A?.freigabeHash).toBeTruthy();
    expect(run.aktiverSchritt).toBe('B'); // nächster nicht-freigegebener
  });

  it('bei allen freigegeben bleibt aktiverSchritt am letzten', () => {
    let run = emptyRun('AZ', NOW);
    for (const id of ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const) {
      run = applyGeneration(run, id, gen(`T${id}`), NOW);
      run = freigeben(run, id, NOW);
    }
    expect(run.aktiverSchritt).toBe('G');
    expect(firstNonFreigegeben(run)).toBe('G');
  });

  it('no-op bei leerem Schritt', () => {
    const run = freigeben(emptyRun('AZ', NOW), 'A', NOW);
    expect(run.schritte.A).toBeUndefined();
  });
});

describe('erneutOeffnen', () => {
  it('setzt NUR diesen Schritt zurück, spätere bleiben freigegeben', () => {
    const run0 = runMitABCfreigegeben();
    const run = erneutOeffnen(run0, 'B', LATER);
    expect(run.schritte.B?.status).toBe('entwurf');
    expect(run.schritte.B?.freigegeben_am).toBeUndefined();
    expect(run.schritte.B?.freigabeHash).toBeUndefined();
    expect(run.schritte.A?.status).toBe('freigegeben'); // früher bleibt
    expect(run.schritte.C?.status).toBe('freigegeben'); // später bleibt!
    expect(run.aktiverSchritt).toBe('B');
  });

  it('macht den Konsistenz-Hinweis auf späteren freigegebenen Schritten sichtbar', () => {
    const run = erneutOeffnen(runMitABCfreigegeben(), 'B', LATER);
    expect(fruehereInArbeit(run, 'C')).toBe(true); // C ist freigegeben, B (früher) in Arbeit
    expect(fruehereInArbeit(run, 'A')).toBe(false);
  });

  it('no-op bei nicht-freigegebenem Schritt', () => {
    const run0 = runMitABCfreigegeben(); // D ist entwurf
    expect(erneutOeffnen(run0, 'D', LATER)).toBe(run0);
  });
});

describe('weiterschalten / verwerfen / uebernehmen', () => {
  it('weiterschalten ändert nur den Fokus', () => {
    const run0 = runMitABCfreigegeben();
    const run = weiterschalten(run0, 'D', LATER);
    expect(run.aktiverSchritt).toBe('D');
    expect(run.schritte).toEqual(run0.schritte);
  });

  it('verwerfen entfernt den Schritt und fokussiert ihn', () => {
    const run = verwerfen(runMitABCfreigegeben(), 'D', LATER);
    expect(run.schritte.D).toBeUndefined();
    expect(run.aktiverSchritt).toBe('D');
  });

  it('uebernehmen holt eine Vorfassung zurück (Status entwurf)', () => {
    let run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Erst'), NOW);
    run = applyGeneration(run, 'A', gen('Zweit', { modifier: 'laenger' }), LATER);
    run = freigeben(run, 'A', LATER);
    run = uebernehmen(run, 'A', 0, LATER); // Index 0 = „Erst"
    expect(run.schritte.A?.finalerText).toBe('Erst');
    expect(run.schritte.A?.status).toBe('entwurf');
    expect(run.schritte.A?.freigegeben_am).toBeUndefined();
    expect(run.aktiverSchritt).toBe('A');
  });
});

describe('Reihenfolge als Datenparameter (Seed-Def == STEP_ORDER, aber Order steuert)', () => {
  const epOrder = ZIM_EP_DEF.steps.map(s => s.id); // ['A'..'G']

  it('explizite zim-ep-Seed-Order ist verhaltensgleich zum STEP_ORDER-Default', () => {
    const run = runMitABCfreigegeben(); // A,B,C freigegeben; D entwurf
    expect(firstNonFreigegeben(run, epOrder)).toBe(firstNonFreigegeben(run));
    expect(firstNonFreigegeben(run, epOrder)).toBe('D');
    expect(fruehereInArbeit(erneutOeffnen(run, 'B', LATER), 'C', epOrder))
      .toBe(fruehereInArbeit(erneutOeffnen(run, 'B', LATER), 'C'));
  });

  it('freigeben rückt mit expliziter Seed-Order identisch vor', () => {
    const run = applyGeneration(emptyRun('AZ', NOW), 'A', gen('Text A'), NOW);
    expect(freigeben(run, 'A', NOW, epOrder).aktiverSchritt)
      .toBe(freigeben(run, 'A', NOW).aktiverSchritt);
    expect(freigeben(run, 'A', NOW, epOrder).aktiverSchritt).toBe('B');
  });

  it('eine ABWEICHENDE Reihenfolge ändert das Vorrücken (Order ist autoritativ)', () => {
    // Custom-Order B→A→C: nach Freigabe von B ist der erste offene Schritt A.
    const run = applyGeneration(emptyRun('AZ', NOW), 'B', gen('Text B'), NOW);
    expect(freigeben(run, 'B', NOW, ['B', 'A', 'C']).aktiverSchritt).toBe('A');
    // Und fruehereInArbeit folgt der Custom-Order: in [B,A] ist B (entwurf) VOR A.
    const r2 = applyGeneration(emptyRun('AZ', NOW), 'B', gen('Entwurf B'), NOW);
    expect(fruehereInArbeit(r2, 'A', ['B', 'A', 'C'])).toBe(true);
    expect(fruehereInArbeit(r2, 'A', ['A', 'B', 'C'])).toBe(false); // Default-Order: B liegt nach A
  });
});

describe('Wiederaufnahme aus persistiertem Stand', () => {
  it('aktiverSchritt + Schritt-Status überleben eine Round-Trip-Serialisierung', () => {
    const run0 = runMitABCfreigegeben();
    const wieder = JSON.parse(JSON.stringify(run0)) as WorkflowRun;
    expect(wieder.aktiverSchritt).toBe('D');
    expect(wieder.schritte.A?.status).toBe('freigegeben');
    expect(wieder.schritte.D?.status).toBe('entwurf');
    // Reducer arbeiten unverändert auf dem rehydrierten Stand weiter:
    const fort = freigeben(wieder, 'D', LATER);
    expect(fort.aktiverSchritt).toBe('E');
  });
});
