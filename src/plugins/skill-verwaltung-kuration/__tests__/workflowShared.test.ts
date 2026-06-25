import { describe, it, expect } from 'vitest';
import {
  reorderSteps, upsertStep, withWorkflowSteps, getWorkflowDef, getWorkflowById, blankStep,
  blankWorkflow, upsertWorkflowDef, istSeedWorkflow, ARTEFAKT_TYP_LABEL, EBENE_LABEL,
} from '../workflowShared';
import { ZIM_EP_DEF, type SkillRegistryFile, type WorkflowDef, type WorkflowStep } from '@/core/services/skills';

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

describe('withWorkflowSteps (Ziel-Def per id)', () => {
  it('bumpt die Version + ersetzt die Steps der adressierten Def', () => {
    const file = leer({ workflows: [{ id: 'zim-ep', name: 'x', version: 3, steps: [] }] });
    const out = withWorkflowSteps(file, 'zim-ep', [s('X')]);
    const def = out.workflows!.find(w => w.id === 'zim-ep')!;
    expect(def.version).toBe(4);
    expect(def.steps.map(x => x.id)).toEqual(['X']);
  });
  it('legt die Default-Def aus dem Seed an, wenn keine vorhanden', () => {
    const out = withWorkflowSteps(leer(), ZIM_EP_DEF.id, [s('X')]);
    const def = out.workflows!.find(w => w.id === ZIM_EP_DEF.id)!;
    expect(def.version).toBe(ZIM_EP_DEF.version + 1);
    expect(def.steps.map(x => x.id)).toEqual(['X']);
  });
  it('trifft die nf-Def per id und lässt zim-ep unangetastet', () => {
    const file = leer({ workflows: [
      { id: 'zim-ep', name: 'GA', version: 1, steps: [s('A')] },
      { id: 'zim-nf', name: 'NF', version: 2, steps: [s('N')], artefaktTyp: 'nf', ebene: 'tv' },
    ] });
    const out = withWorkflowSteps(file, 'zim-nf', [s('X')]);
    const nf = out.workflows!.find(w => w.id === 'zim-nf')!;
    const ga = out.workflows!.find(w => w.id === 'zim-ep')!;
    expect(nf.version).toBe(3);
    expect(nf.steps.map(x => x.id)).toEqual(['X']);
    expect(ga.steps.map(x => x.id)).toEqual(['A']);
  });
});

describe('upsertWorkflowDef (version-neutral)', () => {
  it('hängt eine neue Def an', () => {
    const w = blankWorkflow({ name: 'X', artefaktTyp: 'abl', ebene: 'verbund' });
    const out = upsertWorkflowDef(leer(), w);
    expect(out.workflows).toHaveLength(1);
    expect(out.workflows![0]!.id).toBe(w.id);
  });
  it('ersetzt nach id OHNE Version-Bump', () => {
    const a: WorkflowDef = { id: 'k', name: 'A', version: 5, steps: [] };
    const out = upsertWorkflowDef(leer({ workflows: [a] }), { ...a, name: 'B' });
    const def = out.workflows!.find(w => w.id === 'k')!;
    expect(def.name).toBe('B');
    expect(def.version).toBe(5);
    expect(out.workflows).toHaveLength(1);
  });
});

describe('blankWorkflow', () => {
  it('ist ein Entwurf mit leeren Schritten + Metadaten', () => {
    const w = blankWorkflow({ name: 'PreCheck', artefaktTyp: 'precheck', ebene: 'verbund' });
    expect(w.freigabe).toBe('entwurf');
    expect(w.aktiv).toBe(true);
    expect(w.version).toBe(1);
    expect(w.steps).toEqual([]);
    expect(w.artefaktTyp).toBe('precheck');
    expect(w.ebene).toBe('verbund');
  });
  it('vergibt eindeutige ids', () => {
    expect(blankWorkflow({ name: 'a', artefaktTyp: 'ga', ebene: 'verbund' }).id)
      .not.toBe(blankWorkflow({ name: 'a', artefaktTyp: 'ga', ebene: 'verbund' }).id);
  });
});

describe('getWorkflowDef / getWorkflowById / istSeedWorkflow / Labels / blankStep', () => {
  it('getWorkflowDef fällt auf den Seed zurück', () => {
    expect(getWorkflowDef(leer()).id).toBe(ZIM_EP_DEF.id);
  });
  it('getWorkflowById findet per id oder undefined', () => {
    const file = leer({ workflows: [{ id: 'zim-nf', name: 'NF', version: 1, steps: [] }] });
    expect(getWorkflowById(file, 'zim-nf')!.name).toBe('NF');
    expect(getWorkflowById(file, 'fehlt')).toBeUndefined();
  });
  it('istSeedWorkflow erkennt die Seeds, nicht eigene', () => {
    expect(istSeedWorkflow('zim-ep')).toBe(true);
    expect(istSeedWorkflow('zim-nf')).toBe(true);
    expect(istSeedWorkflow(crypto.randomUUID())).toBe(false);
  });
  it('Labels decken Typen + Ebenen ab', () => {
    expect(ARTEFAKT_TYP_LABEL.precheck).toBe('PreCheck');
    expect(ARTEFAKT_TYP_LABEL.ga).toBe('Gutachten');
    expect(EBENE_LABEL.tv).toBe('Teilvorhaben');
  });
  it('blankStep erzeugt einen gültigen, leeren Schritt mit eindeutiger id', () => {
    const a = blankStep();
    const b = blankStep();
    expect(a.id).not.toBe(b.id);
    expect(a.gateExpr).toBe('immer');
    expect(a.skillId).toBe('');
  });
});
