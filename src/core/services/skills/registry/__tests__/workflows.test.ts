import { describe, it, expect } from 'vitest';
import { normalizeRegistryFile, mergeMissingSeeds } from '../storage';
import { evalGate } from '../workflow-steps';
import { SEED_REGISTRY, SEED_WORKFLOWS } from '../seed';
import type { SkillRegistryFile } from '../types';

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
