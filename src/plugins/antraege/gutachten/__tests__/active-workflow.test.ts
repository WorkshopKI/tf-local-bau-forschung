import { describe, it, expect } from 'vitest';
import { resolveActiveWorkflow, resolveWorkflowSteps, verfuegbareWorkflows } from '../active-workflow';
import { buildSkillMap } from '../skill-context';
import {
  ZIM_EP_DEF, SEED_REGISTRY, type SkillRecord, type SkillRegistryFile, type WorkflowDef, type WorkflowStep,
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

describe('resolveWorkflowSteps — Wahl je artefaktTyp unter dem Freigabe-Gate', () => {
  const wf = (over: Partial<WorkflowDef> & { id: string }): WorkflowDef => ({
    name: over.id, version: 1, steps: [], ...over,
  });

  it("GA byte-identisch: SEED_REGISTRY → zim-ep-Steps (auch bei erlaubeEntwuerfe=false)", () => {
    expect(resolveWorkflowSteps(SEED_REGISTRY, 'ga', { erlaubeEntwuerfe: false }).map(s => s.id))
      .toEqual(ZIM_EP_DEF.steps.map(s => s.id));
  });

  it('GA-Entwurf wird bei erlaubeEntwuerfe=false ignoriert → Seed-Fallback', () => {
    const file = leer({ workflows: [wf({ id: 'ga-draft', artefaktTyp: 'ga', freigabe: 'entwurf', steps: [wfStep('D1', 's')] })] });
    expect(resolveWorkflowSteps(file, 'ga', { erlaubeEntwuerfe: false }).map(s => s.id))
      .toEqual(ZIM_EP_DEF.steps.map(s => s.id));
  });

  it('GA-Entwurf wird bei erlaubeEntwuerfe=true gewählt (kein freigegebener GA)', () => {
    const file = leer({ workflows: [wf({ id: 'ga-draft', artefaktTyp: 'ga', freigabe: 'entwurf', steps: [wfStep('D1', 's')] })] });
    expect(resolveWorkflowSteps(file, 'ga', { erlaubeEntwuerfe: true }).map(s => s.id)).toEqual(['D1']);
  });

  it('freigegeben schlägt Entwurf (auch bei höherer Entwurf-Version)', () => {
    const file = leer({ workflows: [
      wf({ id: 'ga-frei', artefaktTyp: 'ga', freigabe: 'freigegeben', version: 1, steps: [wfStep('F1', 's')] }),
      wf({ id: 'ga-draft', artefaktTyp: 'ga', freigabe: 'entwurf', version: 99, steps: [wfStep('D1', 's')] }),
    ] });
    expect(resolveWorkflowSteps(file, 'ga', { erlaubeEntwuerfe: true }).map(s => s.id)).toEqual(['F1']);
  });

  it('deaktivierte (aktiv:false) Workflows sind keine Kandidaten → Seed-Fallback', () => {
    const file = leer({ workflows: [wf({ id: 'ga-off', artefaktTyp: 'ga', freigabe: 'freigegeben', aktiv: false, steps: [wfStep('X', 's')] })] });
    expect(resolveWorkflowSteps(file, 'ga', { erlaubeEntwuerfe: true }).map(s => s.id))
      .toEqual(ZIM_EP_DEF.steps.map(s => s.id));
  });

  it('NF-Seed (aktiv:false) liefert keine nf-Schritte (kein ga-Fallback für andere Typen)', () => {
    expect(resolveWorkflowSteps(SEED_REGISTRY, 'nf', { erlaubeEntwuerfe: true })).toEqual([]);
  });
});

describe('resolveWorkflowSteps — explizite workflowId (dev-Test)', () => {
  const wf = (over: Partial<WorkflowDef> & { id: string }): WorkflowDef => ({
    name: over.id, version: 1, steps: [], ...over,
  });
  const zweiGa = () => leer({ workflows: [
    wf({ id: 'ga-frei', artefaktTyp: 'ga', freigabe: 'freigegeben', steps: [wfStep('F1', 's')] }),
    wf({ id: 'ga-draft', artefaktTyp: 'ga', freigabe: 'entwurf', steps: [wfStep('D1', 's')] }),
  ] });

  it('gesetzte, verfügbare ID gewinnt über den Tie-Break', () => {
    expect(resolveWorkflowSteps(zweiGa(), 'ga', { erlaubeEntwuerfe: true, workflowId: 'ga-draft' }).map(s => s.id))
      .toEqual(['D1']);
  });
  it('gesetzter Entwurf bei erlaubeEntwuerfe=false → Fallback Tie-Break', () => {
    expect(resolveWorkflowSteps(zweiGa(), 'ga', { erlaubeEntwuerfe: false, workflowId: 'ga-draft' }).map(s => s.id))
      .toEqual(['F1']);
  });
  it('ungültige/leere ID → Tie-Break (byte-identisch)', () => {
    expect(resolveWorkflowSteps(zweiGa(), 'ga', { erlaubeEntwuerfe: true, workflowId: 'gibts-nicht' }).map(s => s.id))
      .toEqual(['F1']);
    // leerer Workflow als Wahl → Fallback
    const mitLeer = leer({ workflows: [wf({ id: 'leer', artefaktTyp: 'ga', freigabe: 'freigegeben', steps: [] })] });
    expect(resolveWorkflowSteps(mitLeer, 'ga', { erlaubeEntwuerfe: true, workflowId: 'leer' }).map(s => s.id))
      .toEqual(ZIM_EP_DEF.steps.map(s => s.id));
  });
  it('ohne workflowId byte-identisch zur Tie-Break-Wahl', () => {
    expect(resolveWorkflowSteps(zweiGa(), 'ga', { erlaubeEntwuerfe: true }).map(s => s.id)).toEqual(['F1']);
  });
});

describe('verfuegbareWorkflows — Dropdown-Quelle (freigegeben zuerst, dann Name)', () => {
  const wf = (over: Partial<WorkflowDef> & { id: string }): WorkflowDef => ({
    name: over.id, version: 1, steps: [], ...over,
  });

  it('filtert Entwürfe je Flag', () => {
    const file = leer({ workflows: [
      wf({ id: 'frei', name: 'Frei', artefaktTyp: 'ga', freigabe: 'freigegeben' }),
      wf({ id: 'entw', name: 'Entwurf', artefaktTyp: 'ga', freigabe: 'entwurf' }),
    ] });
    expect(verfuegbareWorkflows(file, 'ga', { erlaubeEntwuerfe: false }).map(w => w.id)).toEqual(['frei']);
    expect(verfuegbareWorkflows(file, 'ga', { erlaubeEntwuerfe: true }).map(w => w.id)).toEqual(['frei', 'entw']);
  });
  it('sortiert freigegeben vor Entwurf, dann alphabetisch; schließt aktiv:false + Fremdtyp aus', () => {
    const file = leer({ workflows: [
      wf({ id: 'b', name: 'Bravo', artefaktTyp: 'ga', freigabe: 'freigegeben' }),
      wf({ id: 'a', name: 'Alpha', artefaktTyp: 'ga', freigabe: 'entwurf' }),
      wf({ id: 'c', name: 'Charlie', artefaktTyp: 'ga', freigabe: 'freigegeben' }),
      wf({ id: 'off', name: 'Off', artefaktTyp: 'ga', freigabe: 'freigegeben', aktiv: false }),
      wf({ id: 'nf', name: 'NF', artefaktTyp: 'nf', freigabe: 'freigegeben' }),
    ] });
    expect(verfuegbareWorkflows(file, 'ga', { erlaubeEntwuerfe: true }).map(w => w.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('buildSkillMap — opt-in workflowId trifft den gewählten Workflow', () => {
  const wf = (over: Partial<WorkflowDef> & { id: string }): WorkflowDef => ({
    name: over.id, version: 1, steps: [], ...over,
  });

  it('baut die Skill-Map des per workflowId gewählten Entwurfs', () => {
    const file = leer({
      skills: [skill('sX')],
      workflows: [
        wf({ id: 'ga-frei', artefaktTyp: 'ga', freigabe: 'freigegeben', steps: [wfStep('F1', 'sF')] }),
        wf({ id: 'ga-draft', artefaktTyp: 'ga', freigabe: 'entwurf', steps: [wfStep('X', 'sX')] }),
      ],
    });
    const map = buildSkillMap(file, { workflowId: 'ga-draft' });
    expect(map.get('X')?.skill.id).toBe('sX');
    expect(map.has('F1')).toBe(false);
  });
});
