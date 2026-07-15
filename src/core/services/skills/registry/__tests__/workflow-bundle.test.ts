import { describe, it, expect } from 'vitest';
import {
  exportWorkflowBundle, parseWorkflowBundle, importWorkflowBundle, WORKFLOW_BUNDLE_KIND,
} from '../workflow-bundle';
import type { SkillRecord, SkillRegistryFile, WorkflowStep } from '../types';

function skill(id: string, regelIds: string[], extra: Partial<SkillRecord> = {}): SkillRecord {
  return {
    id, name: id.toUpperCase(), beschreibung: 'd', version: 2, promptTemplate: `P-${id}`,
    modifiers: { neu: '', kuerzer: '', laenger: '' }, regelIds, slots: ['vbMarkdown'],
    geaendert_am: '2026-01-01T00:00:00.000Z', ...extra,
  };
}

function step(over: Partial<WorkflowStep> & Pick<WorkflowStep, 'id' | 'skillId'>): WorkflowStep {
  return { nr: '', kurz: '•', label: over.id, gateExpr: 'immer', ...over };
}

function file(): SkillRegistryFile {
  return {
    version: 1,
    updated_at: 't',
    skills: [
      skill('s1', ['r1'], { systemPrompt: 'sys', maxTokens: 4096 }),
      skill('s2', ['r2']),
    ],
    regeln: [
      { id: 'r1', name: 'R1', typ: 'zeichen_max', params: { max: 800 }, schweregrad: 'fehler', aktiv: true, erstellt_am: 't', geaendert_am: 't' },
      { id: 'r2', name: 'R2', typ: 'satzanzahl', params: { min: 1, max: 5 }, schweregrad: 'hinweis', aktiv: true, erstellt_am: 't', geaendert_am: 't' },
      { id: 'r3', name: 'Andere', typ: 'wortanzahl', params: {}, schweregrad: 'hinweis', aktiv: true, erstellt_am: 't', geaendert_am: 't' },
    ],
    workflows: [
      {
        id: 'wf1', name: 'Testflow', version: 3, artefaktTyp: 'ga', ebene: 'verbund',
        steps: [
          step({ id: 'A', skillId: 's1' }),
          step({ id: 'B', skillId: 's2', parentStepId: 'A' }),
          step({ id: 'Q', skillId: 's2', rolle: 'llm_qs', qsZielStepId: 'B' }),
        ],
      },
    ],
  };
}

describe('exportWorkflowBundle', () => {
  it('bündelt Workflow + referenzierte Skills (ohne Historie) + deren Regeln', () => {
    const b = exportWorkflowBundle(file(), 'wf1')!;
    expect(b.kind).toBe(WORKFLOW_BUNDLE_KIND);
    expect(b.workflow.id).toBe('wf1');
    expect(b.skills.map(s => s.id)).toEqual(['s1', 's2']);
    expect(b.skills.every(s => !('historie' in s))).toBe(true);
    expect(b.regeln.map(r => r.id)).toEqual(['r1', 'r2']); // r3 NICHT (nicht referenziert)
  });
  it('null bei unbekannter ID', () => {
    expect(exportWorkflowBundle(file(), 'gibt-es-nicht')).toBeNull();
  });
});

describe('parseWorkflowBundle', () => {
  it('Round-trip: export → parse erhält Workflow + Whitelist-Felder der Skills', () => {
    const b = exportWorkflowBundle(file(), 'wf1')!;
    const parsed = parseWorkflowBundle(JSON.parse(JSON.stringify(b)))!;
    expect(parsed.workflow.id).toBe('wf1');
    expect(parsed.workflow.steps).toHaveLength(3);
    expect(parsed.skills.map(s => s.id)).toEqual(['s1', 's2']);
    const s1 = parsed.skills.find(s => s.id === 's1')!;
    expect(s1.systemPrompt).toBe('sys'); // Whitelist-Feld überlebt Normalisierung
    expect(s1.maxTokens).toBe(4096);
    expect(parsed.regeln.map(r => r.id)).toEqual(['r1', 'r2']);
  });
  it('verwirft falsche Struktur', () => {
    expect(parseWorkflowBundle({ kind: 'andere' })).toBeNull();
    expect(parseWorkflowBundle({ kind: WORKFLOW_BUNDLE_KIND, workflow: null, skills: [], regeln: [] })).toBeNull();
    expect(parseWorkflowBundle(null)).toBeNull();
  });
});

describe('importWorkflowBundle', () => {
  it('frische Registry: kein Konflikt, Workflow-ID bleibt, Schritt-IDs werden neu vergeben', () => {
    const leer: SkillRegistryFile = { version: 1, updated_at: 't', skills: [], regeln: [] };
    const bundle = exportWorkflowBundle(file(), 'wf1')!;
    let n = 0;
    const res = importWorkflowBundle(leer, bundle, { newId: () => `new-${n++}` });
    expect(res.konflikt).toBe(false);
    expect(res.importedWorkflowId).toBe('wf1');
    expect(res.duplizierteSkills).toEqual([]);
    expect(res.file.skills.map(s => s.id)).toEqual(['s1', 's2']); // additiv, ID bleibt
    expect(res.ergaenzteRegeln).toEqual(['r1', 'r2']);
    const wf = res.file.workflows!.find(w => w.id === 'wf1')!;
    // Schritt-IDs immer neu (nicht A/B/Q), skillId unverändert (keine Kollision)
    expect(wf.steps.map(s => s.id).every(id => id.startsWith('new-'))).toBe(true);
    expect(wf.steps.map(s => s.skillId)).toEqual(['s1', 's2', 's2']);
    // parentStepId/qsZielStepId zeigen auf die neuen Schritt-IDs
    expect(wf.steps[1]!.parentStepId).toBe(wf.steps[0]!.id);
    expect(wf.steps[2]!.qsZielStepId).toBe(wf.steps[1]!.id);
  });

  it('ID-Kollision: Workflow + referenzierte Skills werden dupliziert + umgemappt', () => {
    const f = file();
    const bundle = exportWorkflowBundle(f, 'wf1')!;
    let n = 0;
    const res = importWorkflowBundle(f, bundle, { newId: () => `new-${n++}` });
    // newId-Reihenfolge: Skills [s1→new-0, s2→new-1], Steps [A→new-2, B→new-3, Q→new-4], Workflow→new-5
    expect(res.konflikt).toBe(true);
    expect(res.importedWorkflowId).toBe('new-5');
    expect(res.duplizierteSkills).toEqual(['s1', 's2']);
    expect(res.file.skills.map(s => s.id)).toEqual(['s1', 's2', 'new-0', 'new-1']);
    expect(res.file.skills.find(s => s.id === 'new-0')!.name).toContain('(importiert)');
    const wf = res.file.workflows!.find(w => w.id === 'new-5')!;
    expect(wf.name).toContain('(importiert)');
    expect(wf.steps.map(s => s.id)).toEqual(['new-2', 'new-3', 'new-4']);
    // skillId auf die duplizierten Skills umgemappt
    expect(wf.steps.map(s => s.skillId)).toEqual(['new-0', 'new-1', 'new-1']);
    expect(wf.steps[1]!.parentStepId).toBe('new-2');
    expect(wf.steps[2]!.qsZielStepId).toBe('new-3');
    // Regeln bereits vorhanden → nicht erneut hinzugefügt, Original-Skills unberührt
    expect(res.ergaenzteRegeln).toEqual([]);
    expect(res.file.skills.find(s => s.id === 's1')!.name).toBe('S1');
  });
});
