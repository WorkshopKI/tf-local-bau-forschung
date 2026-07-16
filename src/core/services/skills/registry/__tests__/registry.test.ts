import { describe, it, expect } from 'vitest';
import { normalizeRegistryFile } from '../storage';
import {
  getSkillById, resolveRegeln, skillsUsingRegel, workflowStepsUsingSkill, describeRegelParams,
  artefaktTypOf, ebeneOf, pruefartOf,
} from '../selectors';
import { SEED_REGISTRY, SEED_SKILL, KURZFASSUNG_SKILL_ID, ZIM_EP_DEF } from '../seed';
import { runRegelChecks } from '../check-engine';
import type { QualitaetsRegel, SkillRegistryFile } from '../types';

describe('normalizeRegistryFile — tolerantes Lesen', () => {
  it('akzeptiert eine gültige Datei und behält bekannte + unbekannte Typen', () => {
    const raw = {
      version: 1,
      updated_at: '2026-06-11T10:00:00.000Z',
      skills: [{ id: 's1', name: 'Skill', regelIds: ['r1', 'r2'], slots: ['stammdaten'] }],
      regeln: [
        { id: 'r1', typ: 'zeichen_max', params: { max: 800 }, schweregrad: 'fehler' },
        { id: 'r2', typ: 'zukunfts_typ', params: { foo: 1 } }, // unbekannt → behalten
      ],
    };
    const file = normalizeRegistryFile(raw)!;
    expect(file).not.toBeNull();
    expect(file.skills).toHaveLength(1);
    expect(file.regeln).toHaveLength(2);
    // Defaults: fehlende Felder ergänzt
    expect(file.skills[0]!.version).toBe(1);
    expect(file.skills[0]!.modifiers).toEqual({ neu: '', kuerzer: '', laenger: '' });
    expect(file.regeln[1]!.typ).toBe('zukunfts_typ'); // unbekannt, nicht verworfen
    expect(file.regeln[1]!.aktiv).toBe(true); // default
  });

  it('verwirft strukturell ungültige Dateien (Version, Arrays)', () => {
    expect(normalizeRegistryFile({ version: 2, skills: [], regeln: [] })).toBeNull();
    expect(normalizeRegistryFile({ version: 1, skills: 'nope', regeln: [] })).toBeNull();
    expect(normalizeRegistryFile(null)).toBeNull();
  });

  it('lässt Skills/Regeln ohne id fallen', () => {
    const file = normalizeRegistryFile({
      version: 1,
      skills: [{ name: 'kein id' }, { id: 'ok' }],
      regeln: [{ typ: 'zeichen_max' }, { id: 'r', typ: 'zeichen_max' }],
    })!;
    expect(file.skills.map(s => s.id)).toEqual(['ok']);
    expect(file.regeln.map(r => r.id)).toEqual(['r']);
  });
});

describe('Selektoren', () => {
  it('getSkillById + resolveRegeln (Reihenfolge, fehlende IDs ausgelassen)', () => {
    const skill = getSkillById(SEED_REGISTRY, KURZFASSUNG_SKILL_ID)!;
    expect(skill).toBeDefined();
    const regeln = resolveRegeln(SEED_REGISTRY, skill);
    expect(regeln.map(r => r.id)).toEqual(SEED_SKILL.regelIds);
  });

  it('resolveRegeln überspringt nicht vorhandene IDs', () => {
    const file = { ...SEED_REGISTRY, skills: [{ ...SEED_SKILL, regelIds: ['seed-satzanzahl', 'gibt-es-nicht'] }] };
    expect(resolveRegeln(file, file.skills[0]!).map(r => r.id)).toEqual(['seed-satzanzahl']);
  });

  it('skillsUsingRegel berechnet „verwendet in"', () => {
    expect(skillsUsingRegel(SEED_REGISTRY, 'seed-satzanzahl')).toEqual([SEED_SKILL.name]);
    expect(skillsUsingRegel(SEED_REGISTRY, 'unbenutzt')).toEqual([]);
  });

  it('workflowStepsUsingSkill findet Schritte über file.workflows', () => {
    const treffer = workflowStepsUsingSkill(SEED_REGISTRY, KURZFASSUNG_SKILL_ID);
    expect(treffer).toHaveLength(1);
    expect(treffer[0]).toMatchObject({ workflowId: 'zim-ep', stepId: 'A', nr: 'A' });
  });

  it('workflowStepsUsingSkill: Mehrfachnutzung in einem Workflow', () => {
    const file: SkillRegistryFile = {
      version: 1,
      updated_at: 't',
      skills: [],
      regeln: [],
      workflows: [{
        id: 'wf1', name: 'WF', version: 1, steps: [
          { id: 's1', nr: '1', kurz: '1', label: 'Eins', skillId: 'shared' },
          { id: 's2', nr: '2', kurz: '2', label: 'Zwei', skillId: 'andere' },
          { id: 's3', nr: '3', kurz: '3', label: 'Drei', skillId: 'shared' },
        ],
      }],
    };
    expect(workflowStepsUsingSkill(file, 'shared').map(t => t.stepId)).toEqual(['s1', 's3']);
    expect(workflowStepsUsingSkill(file, 'gibt-es-nicht')).toEqual([]);
  });

  it('workflowStepsUsingSkill: Seed-Fallback wenn keine Workflows kuratiert', () => {
    const ohne: SkillRegistryFile = { version: 1, updated_at: 't', skills: [], regeln: [], workflows: [] };
    const treffer = workflowStepsUsingSkill(ohne, KURZFASSUNG_SKILL_ID);
    expect(treffer).toHaveLength(1);
    expect(treffer[0]!.workflowId).toBe('zim-ep');
  });

  it('describeRegelParams liefert Kurzformen', () => {
    const r = (typ: string, params: Record<string, unknown>): QualitaetsRegel => ({
      id: 'x', name: 'x', typ, params, schweregrad: 'fehler', aktiv: true, erstellt_am: 't', geaendert_am: 't',
    });
    expect(describeRegelParams(r('zeichen_max', { max: 1000 }))).toBe('max 1000 Zeichen');
    expect(describeRegelParams(r('satzanzahl', { min: 8, max: 12 }))).toBe('8–12 Sätze');
    expect(describeRegelParams(r('zukunfts_typ', {}))).toBe('unbekannter Typ');
  });
});

describe('Artefakt-Engine — additive Felder + Default-Resolver', () => {
  it('liest pruefart/artefaktTyp/ebene bei gültigen Werten, defaultet via Resolver bei fehlenden', () => {
    const file = normalizeRegistryFile({
      version: 1,
      skills: [{ id: 's1' }],
      regeln: [
        { id: 'r-fach', typ: 'zeichen_max', pruefart: 'fachlich' },
        { id: 'r-default', typ: 'zeichen_max' },
        { id: 'r-mist', typ: 'zeichen_max', pruefart: 'quatsch' }, // ungültig → weggelassen
      ],
      workflows: [
        { id: 'nf', name: 'NF', version: 1, steps: [], artefaktTyp: 'nf', ebene: 'tv' },
        { id: 'ga', name: 'GA', version: 1, steps: [] }, // ohne Felder
        { id: 'bad', name: 'B', version: 1, steps: [], artefaktTyp: 'xx', ebene: 'yy' }, // ungültig
      ],
    })!;
    // Regeln: gültige pruefart bleibt, fehlende/ungültige sind feld-frei
    expect(file.regeln.find(r => r.id === 'r-fach')!.pruefart).toBe('fachlich');
    expect(file.regeln.find(r => r.id === 'r-default')!.pruefart).toBeUndefined();
    expect(file.regeln.find(r => r.id === 'r-mist')!.pruefart).toBeUndefined();
    expect(pruefartOf(file.regeln.find(r => r.id === 'r-default')!)).toBe('textlich');
    // Workflows: gültige Typ/Ebene bleiben, fehlende/ungültige feld-frei
    const nf = file.workflows!.find(w => w.id === 'nf')!;
    expect(nf.artefaktTyp).toBe('nf');
    expect(nf.ebene).toBe('tv');
    const ga = file.workflows!.find(w => w.id === 'ga')!;
    expect(ga.artefaktTyp).toBeUndefined();
    expect(ga.ebene).toBeUndefined();
    expect(artefaktTypOf(ga)).toBe('ga');
    expect(ebeneOf(ga)).toBe('verbund');
    const bad = file.workflows!.find(w => w.id === 'bad')!;
    expect(bad.artefaktTyp).toBeUndefined();
    expect(bad.ebene).toBeUndefined();
  });

  it('GA-Seed (ZIM_EP_DEF) trägt keine Artefakt-Felder → defaultet auf ga/verbund (byte-identisch)', () => {
    expect(ZIM_EP_DEF.artefaktTyp).toBeUndefined();
    expect(ZIM_EP_DEF.ebene).toBeUndefined();
    expect(artefaktTypOf(ZIM_EP_DEF)).toBe('ga');
    expect(ebeneOf(ZIM_EP_DEF)).toBe('verbund');
  });
});

describe('Seed', () => {
  it('enthält die Gutachten-Skills A–G + QS-Basis + zusammenpassende Regeln', () => {
    // A (Kurzfassung) + B–G = 7 Skills + qs-basis + relevanz-map + nf-auswahl-fuellung +
    // anfrage-anonymisieren + anfrage-metadaten + aufbereitung-aspekte + aufbereitung-steckbrief +
    // aufbereitung-zahlen + aufbereitung-glossar + aufbereitung-verwertung + aufbereitung-recherche-prompt = 18;
    // 5 A-Regeln + 9 B–G-Regeln + 3 NF-Regeln + 5 GA-QS-Regeln = 22 Regeln (QS + Relevanz-Map + Anfrage-Skills +
    // Aufbereitungs-Skills haben keine). B–G: B(3) + C(3: seed-c-wortanzahl[Waise] + seed-c-umfang + seed-c-keine-aufzaehlungen) + D(2) + G(1).
    expect(SEED_REGISTRY.skills).toHaveLength(18);
    expect(SEED_REGISTRY.regeln).toHaveLength(22);
    expect(getSkillById(SEED_REGISTRY, 'qs-basis')!.regelIds).toEqual([]);
    const skill = SEED_REGISTRY.skills[0]!; // A = Kurzfassung
    expect(skill.id).toBe('gutachten-kurzfassung');
    // Jede regelId JEDES Skills existiert in der Regel-Bibliothek:
    for (const s of SEED_REGISTRY.skills) {
      for (const id of s.regelIds) {
        expect(SEED_REGISTRY.regeln.find(r => r.id === id)).toBeDefined();
      }
    }
    expect(skill.systemPrompt).toBeTruthy();
    expect(skill.slots).toContain('vbMarkdown');
  });

  it('die Seed-Regeln laufen sauber über einen Beispieltext', () => {
    const skill = SEED_REGISTRY.skills[0]!;
    const regeln = resolveRegeln(SEED_REGISTRY, skill);
    const results = runRegelChecks('Das Vorhaben entwickelt ein Verfahren. Es überwacht Prozesse dezentral.', regeln);
    // 5 aktive Regeln → 5 Ergebnisse, jedes mit regelId
    expect(results).toHaveLength(5);
    expect(results.every(r => typeof r.regelId === 'string')).toBe(true);
  });
});
