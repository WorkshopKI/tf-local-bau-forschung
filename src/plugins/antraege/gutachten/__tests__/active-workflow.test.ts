import { describe, it, expect } from 'vitest';
import { resolveActiveWorkflow } from '../active-workflow';
import { ZIM_EP_DEF, SEED_REGISTRY, type SkillRegistryFile, type WorkflowStep } from '@/core/services/skills';

const leer = (over: Partial<SkillRegistryFile> = {}): SkillRegistryFile => ({
  version: 1, updated_at: 't', skills: [], regeln: [], ...over,
});

describe('resolveActiveWorkflow', () => {
  it('liefert die zim-ep-Steps aus der (Seed-)Registry', () => {
    expect(resolveActiveWorkflow(SEED_REGISTRY).map(s => s.id))
      .toEqual(ZIM_EP_DEF.steps.map(s => s.id));
  });

  it('fällt auf den Seed zurück, wenn keine workflows vorhanden sind', () => {
    expect(resolveActiveWorkflow(leer())).toEqual(ZIM_EP_DEF.steps);
  });

  it('fällt auf den Seed zurück, wenn die zim-ep-Def leer ist', () => {
    const file = leer({ workflows: [{ id: 'zim-ep', name: 'x', version: 9, steps: [] }] });
    expect(resolveActiveWorkflow(file)).toEqual(ZIM_EP_DEF.steps);
  });

  it('nutzt die kuratierte Def, wenn vorhanden (abweichende Reihenfolge)', () => {
    const step: WorkflowStep = { id: 'B', nr: 'B', kurz: 'B', label: 'B', skillId: 'gutachten-ausgangslage', gateExpr: 'immer' };
    const file = leer({ workflows: [{ id: 'zim-ep', name: 'x', version: 2, steps: [step] }] });
    expect(resolveActiveWorkflow(file).map(s => s.id)).toEqual(['B']);
  });
});
