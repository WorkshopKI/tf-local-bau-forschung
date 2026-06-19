import { describe, it, expect } from 'vitest';
import { resolveActiveWorkflow } from '../active-workflow';
import { buildSkillMap } from '../skill-context';
import {
  ZIM_EP_DEF, SEED_REGISTRY, type SkillRecord, type SkillRegistryFile, type WorkflowStep,
} from '@/core/services/skills';

const leer = (over: Partial<SkillRegistryFile> = {}): SkillRegistryFile => ({
  version: 1, updated_at: 't', skills: [], regeln: [], ...over,
});

const skill = (id: string): SkillRecord => ({
  id, name: id, beschreibung: '', version: 1, promptTemplate: '',
  modifiers: { neu: '', kuerzer: '', laenger: '' }, regelIds: [], slots: [], geaendert_am: 't',
});

const wfStep = (id: string, skillId: string, parentStepId?: string): WorkflowStep => ({
  id, nr: '', kurz: id, label: id, skillId, gateExpr: 'immer', ...(parentStepId ? { parentStepId } : {}),
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

  it('flacht eine Unterschritt-Ebene topologisch (Parent vor Kind)', () => {
    const steps = [wfStep('5', 's5'), wfStep('5a', 's5a', '5')];
    const file = leer({ workflows: [{ id: 'zim-ep', name: 'x', version: 1, steps }] });
    expect(resolveActiveWorkflow(file).map(s => s.id)).toEqual(['5', '5a']);
  });
});

describe('Generierung fließt durch Unterschritte (buildSkillMap)', () => {
  it('buildSkillMap enthält auch den Unterschritt → der Runner kann ihn generieren', () => {
    const steps = [wfStep('5', 's5'), wfStep('5a', 's5a', '5')];
    const file = leer({ skills: [skill('s5'), skill('s5a')], workflows: [{ id: 'zim-ep', name: 'x', version: 1, steps }] });
    const map = buildSkillMap(file);
    expect(map.get('5')?.skill.id).toBe('s5');
    expect(map.get('5a')?.skill.id).toBe('s5a');
  });
});
