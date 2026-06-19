import { describe, it, expect } from 'vitest';
import { normalizeRegistryFile, mergeMissingSeeds } from '../storage';
import {
  evalGate, flattenStepsTopological, computeStepNumbers,
  normalizeStepRolle, clampMaxRetries, MAX_AUTO_RETRIES, DEFAULT_MAX_RETRIES,
} from '../workflow-steps';
import { SEED_REGISTRY, SEED_WORKFLOWS } from '../seed';
import type { SkillRegistryFile, WorkflowStep } from '../types';

const step = (id: string, parentStepId?: string): WorkflowStep => ({
  id, nr: '', kurz: id, label: id, skillId: '', gateExpr: 'immer', ...(parentStepId ? { parentStepId } : {}),
});

describe('normalizeRegistryFile — workflows (tolerantes Lesen + Tiefe-Klemmung)', () => {
  it('defaultet fehlende workflows auf []', () => {
    const file = normalizeRegistryFile({ version: 1, skills: [], regeln: [] })!;
    expect(file.workflows).toEqual([]);
  });

  it('füllt fehlende Step-Felder mit Defaults, unbekanntes gateExpr → immer', () => {
    const file = normalizeRegistryFile({
      version: 1, skills: [], regeln: [],
      workflows: [{ id: 'w', steps: [{ id: 'X' }, { id: 'Y', gateExpr: 'zukunft' }] }],
    })!;
    const w = file.workflows![0]!;
    expect(w.name).toBe('w');         // default = id
    expect(w.version).toBe(1);        // default
    const x = w.steps.find(s => s.id === 'X')!;
    expect(x.nr).toBe('X');
    expect(x.label).toBe('X');
    expect(x.kurz).toBe('X');
    expect(x.skillId).toBe('');
    expect(x.gateExpr).toBe('immer');
    expect(x.parentStepId).toBeUndefined();
    expect(x.ankerKey).toBeUndefined();
    expect(w.steps.find(s => s.id === 'Y')!.gateExpr).toBe('immer'); // unbekannt → immer
  });

  it('lässt Steps/Defs ohne id fallen', () => {
    const file = normalizeRegistryFile({
      version: 1, skills: [], regeln: [],
      workflows: [{ name: 'kein id' }, { id: 'ok', steps: [{ name: 'kein id' }, { id: 's' }] }],
    })!;
    expect(file.workflows!.map(w => w.id)).toEqual(['ok']);
    expect(file.workflows![0]!.steps.map(s => s.id)).toEqual(['s']);
  });

  it('klemmt parentStepId auf genau eine Ebene (Selbst/dangling/Tiefe>1 → Top-Level)', () => {
    const file = normalizeRegistryFile({
      version: 1, skills: [], regeln: [],
      workflows: [{
        id: 'w',
        steps: [
          { id: 'A' },
          { id: 'B', parentStepId: 'A' }, // gültige Ebene 1 → behalten
          { id: 'C', parentStepId: 'B' }, // B ist selbst Kind → Tiefe 2 → klemmen
          { id: 'D', parentStepId: 'X' }, // dangling → klemmen
          { id: 'E', parentStepId: 'E' }, // Selbst-Referenz → klemmen
        ],
      }],
    })!;
    const steps = file.workflows![0]!.steps;
    const byId = (id: string) => steps.find(s => s.id === id)!;
    expect(byId('B').parentStepId).toBe('A');
    expect(byId('C').parentStepId).toBeUndefined();
    expect(byId('D').parentStepId).toBeUndefined();
    expect(byId('E').parentStepId).toBeUndefined();
  });
});

describe('clampMaxRetries — harte Decke [0..3]', () => {
  it('fehlend/ungültig → Default 2', () => {
    expect(clampMaxRetries(undefined)).toBe(DEFAULT_MAX_RETRIES);
    expect(clampMaxRetries(NaN)).toBe(DEFAULT_MAX_RETRIES);
  });
  it('klemmt nach oben/unten und rundet', () => {
    expect(clampMaxRetries(-5)).toBe(0);
    expect(clampMaxRetries(99)).toBe(MAX_AUTO_RETRIES);
    expect(clampMaxRetries(2.6)).toBe(3);
    expect(clampMaxRetries(0)).toBe(0);
  });
});

describe('normalizeStepRolle — Rolle/Retry-Invarianten (eine Quelle)', () => {
  const base = (extra: Partial<WorkflowStep>): WorkflowStep => ({
    id: 'A', nr: 'A', kurz: 'A', label: 'A', skillId: 's', gateExpr: 'immer', ...extra,
  });

  it('generierung (Default) lässt Rolle/QS/Retry weg', () => {
    const out = normalizeStepRolle(base({}));
    expect(out.rolle).toBeUndefined();
    expect(out.qsZielStepId).toBeUndefined();
    expect(out.autoRetry).toBeUndefined();
    expect(out.maxRetries).toBeUndefined();
  });

  it('generierung + autoRetry: maxRetries geklemmt, qsZielStepId entfernt', () => {
    const out = normalizeStepRolle(base({ autoRetry: true, maxRetries: 99, qsZielStepId: 'B' }));
    expect(out.autoRetry).toBe(true);
    expect(out.maxRetries).toBe(MAX_AUTO_RETRIES);
    expect(out.qsZielStepId).toBeUndefined();
  });

  it('generierung ohne autoRetry: maxRetries wird verworfen', () => {
    const out = normalizeStepRolle(base({ maxRetries: 3 }));
    expect(out.autoRetry).toBeUndefined();
    expect(out.maxRetries).toBeUndefined();
  });

  it('llm_qs: behält qsZielStepId, entfernt autoRetry/maxRetries', () => {
    const out = normalizeStepRolle(base({ rolle: 'llm_qs', qsZielStepId: 'B', autoRetry: true, maxRetries: 2 }));
    expect(out.rolle).toBe('llm_qs');
    expect(out.qsZielStepId).toBe('B');
    expect(out.autoRetry).toBeUndefined();
    expect(out.maxRetries).toBeUndefined();
  });

  it('bewahrt unveränderte Basisfelder', () => {
    const out = normalizeStepRolle(base({ ankerKey: 'A', parentStepId: 'X' }));
    expect(out.ankerKey).toBe('A');
    expect(out.parentStepId).toBe('X');
  });
});

describe('normalizeRegistryFile — Rolle/Retry tolerant lesen', () => {
  it('liest rolle/qsZielStepId und klemmt maxRetries beim Laden', () => {
    const file = normalizeRegistryFile({
      version: 1, skills: [], regeln: [],
      workflows: [{
        id: 'w',
        steps: [
          { id: 'A', autoRetry: true, maxRetries: 9 },
          { id: 'Q', rolle: 'llm_qs', qsZielStepId: 'A', autoRetry: true },
          { id: 'B', rolle: 'unbekannt' },
        ],
      }],
    })!;
    const steps = file.workflows![0]!.steps;
    const byId = (id: string) => steps.find(s => s.id === id)!;
    expect(byId('A').autoRetry).toBe(true);
    expect(byId('A').maxRetries).toBe(MAX_AUTO_RETRIES);
    expect(byId('Q').rolle).toBe('llm_qs');
    expect(byId('Q').qsZielStepId).toBe('A');
    expect(byId('Q').autoRetry).toBeUndefined();
    expect(byId('B').rolle).toBeUndefined(); // unbekannte Rolle → generierung (weggelassen)
  });
});

describe('mergeMissingSeeds — workflows additiv', () => {
  const curatedNoWf = (): SkillRegistryFile => ({
    version: 1, updated_at: 't',
    skills: [...SEED_REGISTRY.skills], regeln: [...SEED_REGISTRY.regeln],
    // bewusst KEIN workflows-Feld (Bestands-Installation vor dieser Version)
  });

  it('ergänzt fehlendes zim-ep aus dem Seed', () => {
    const merged = mergeMissingSeeds(curatedNoWf());
    expect(merged.ergaenzteWorkflows).toEqual(SEED_WORKFLOWS.map(w => w.id));
    expect(merged.file.workflows!.map(w => w.id)).toEqual(['zim-ep']);
  });

  it('ist idempotent (zweiter Lauf ergänzt keine Workflows)', () => {
    const once = mergeMissingSeeds(curatedNoWf());
    const twice = mergeMissingSeeds(once.file);
    expect(twice.ergaenzteWorkflows).toHaveLength(0);
  });

  it('No-op auf der vollständigen Seed-Registry', () => {
    expect(mergeMissingSeeds(SEED_REGISTRY).ergaenzteWorkflows).toHaveLength(0);
  });
});

describe('flattenStepsTopological — eine Ebene, Parent vor Kindern', () => {
  it('ist Identität für eine flache Liste (zim-ep-Fall)', () => {
    const flat = [step('A'), step('B'), step('C')];
    expect(flattenStepsTopological(flat).map(s => s.id)).toEqual(['A', 'B', 'C']);
  });
  it('zieht verstreute Kinder unter ihren Parent (Top-Level-Reihenfolge bleibt)', () => {
    const steps = [step('1'), step('1a', '1'), step('2'), step('1b', '1')];
    expect(flattenStepsTopological(steps).map(s => s.id)).toEqual(['1', '1a', '1b', '2']);
  });
  it('behandelt Tiefe-2-/dangling-Parents als Top-Level (keine zweite Ebene)', () => {
    const steps = [step('1'), step('1a', '1'), step('x', '1a'), step('y', 'ghost')];
    expect(flattenStepsTopological(steps).map(s => s.id)).toEqual(['1', '1a', 'x', 'y']);
  });
  it('enthält jeden Schritt genau einmal', () => {
    const steps = [step('1'), step('1a', '1'), step('2'), step('2a', '2'), step('3')];
    const out = flattenStepsTopological(steps).map(s => s.id).sort();
    expect(out).toEqual(['1', '1a', '2', '2a', '3'].sort());
  });
});

describe('computeStepNumbers — 5 / 5a / 5b aus der Hierarchie', () => {
  it('nummeriert Top-Level 1..n und Kinder Na/Nb relativ zum Parent', () => {
    const steps = [step('A'), step('B'), step('B1', 'B'), step('B2', 'B'), step('C')];
    const m = computeStepNumbers(steps);
    expect(m.get('A')).toBe('1');
    expect(m.get('B')).toBe('2');
    expect(m.get('B1')).toBe('2a');
    expect(m.get('B2')).toBe('2b');
    expect(m.get('C')).toBe('3');
  });
  it('setzt den Kinder-Buchstaben pro Parent zurück', () => {
    const steps = [step('X'), step('Xa', 'X'), step('Y'), step('Ya', 'Y')];
    const m = computeStepNumbers(steps);
    expect(m.get('Xa')).toBe('1a');
    expect(m.get('Ya')).toBe('2a');
  });
});

describe('evalGate — reiner Gate-Resolver', () => {
  it("'immer' / undefined / Unbekanntes ⇒ true", () => {
    expect(evalGate('immer', { teilvorhaben: [] })).toBe(true);
    expect(evalGate(undefined, { teilvorhaben: [] })).toBe(true);
    // @ts-expect-error — Laufzeit-Toleranz gegen unbekannte Werte
    expect(evalGate('zukunft', { teilvorhaben: [] })).toBe(true);
  });

  it("'hat_teilvorhaben' ⇒ true nur mit mindestens einem TV", () => {
    expect(evalGate('hat_teilvorhaben', { teilvorhaben: [] })).toBe(false);
    expect(evalGate('hat_teilvorhaben', { teilvorhaben: [{}] })).toBe(true);
  });
});
