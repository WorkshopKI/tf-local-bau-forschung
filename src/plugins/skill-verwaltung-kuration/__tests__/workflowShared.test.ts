import { describe, it, expect } from 'vitest';
import { reorderSteps, upsertStep, withWorkflowSteps, getWorkflowDef, blankStep } from '../workflowShared';
import { ZIM_EP_DEF, type SkillRegistryFile, type WorkflowStep } from '@/core/services/skills';

const s = (id: string): WorkflowStep => ({ id, nr: id, kurz: id, label: id, skillId: '', gateExpr: 'immer' });
const list = [s('A'), s('B'), s('C'), s('D')];
const leer = (over: Partial<SkillRegistryFile> = {}): SkillRegistryFile => ({
  version: 1, updated_at: 't', skills: [], regeln: [], ...over,
});

describe('reorderSteps', () => {
  it('verschiebt vorwärts (0→2)', () => {
    expect(reorderSteps(list, 0, 2).map(x => x.id)).toEqual(['B', 'C', 'A', 'D']);
  });
  it('verschiebt rückwärts (3→1)', () => {
    expect(reorderSteps(list, 3, 1).map(x => x.id)).toEqual(['A', 'D', 'B', 'C']);
  });
  it('ist No-Op bei gleichem Index (neue Referenz, gleiche Reihenfolge)', () => {
    const out = reorderSteps(list, 1, 1);
    expect(out.map(x => x.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(out).not.toBe(list);
  });
  it('ist No-Op bei Out-of-range', () => {
    expect(reorderSteps(list, 0, 9).map(x => x.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(reorderSteps(list, -1, 2).map(x => x.id)).toEqual(['A', 'B', 'C', 'D']);
  });
  it('lässt das Original unverändert', () => {
    reorderSteps(list, 0, 3);
    expect(list.map(x => x.id)).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('upsertStep', () => {
  it('ersetzt nach id', () => {
    const out = upsertStep(list, { ...s('B'), label: 'NEU' });
    expect(out.find(x => x.id === 'B')!.label).toBe('NEU');
    expect(out).toHaveLength(4);
  });
  it('hängt neue Schritte an', () => {
    expect(upsertStep(list, s('E')).map(x => x.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});

describe('withWorkflowSteps', () => {
  it('bumpt die Version + ersetzt die Steps der zim-ep-Def', () => {
    const file = leer({ workflows: [{ id: 'zim-ep', name: 'x', version: 3, steps: [] }] });
    const out = withWorkflowSteps(file, [s('X')]);
    const def = out.workflows!.find(w => w.id === 'zim-ep')!;
    expect(def.version).toBe(4);
    expect(def.steps.map(x => x.id)).toEqual(['X']);
  });
  it('legt die Def aus dem Seed an, wenn keine vorhanden (Version-Bump auf Seed-Basis)', () => {
    const out = withWorkflowSteps(leer(), [s('X')]);
    const def = out.workflows!.find(w => w.id === ZIM_EP_DEF.id)!;
    expect(def.version).toBe(ZIM_EP_DEF.version + 1);
    expect(def.steps.map(x => x.id)).toEqual(['X']);
  });
});

describe('getWorkflowDef / blankStep', () => {
  it('getWorkflowDef fällt auf den Seed zurück', () => {
    expect(getWorkflowDef(leer()).id).toBe(ZIM_EP_DEF.id);
  });
  it('blankStep erzeugt einen gültigen, leeren Schritt mit eindeutiger id', () => {
    const a = blankStep();
    const b = blankStep();
    expect(a.id).not.toBe(b.id);
    expect(a.gateExpr).toBe('immer');
    expect(a.skillId).toBe('');
  });
});
