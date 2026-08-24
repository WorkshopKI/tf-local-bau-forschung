/**
 * Der fachliche Prüfer — Bindung, Auflösung, Katalog.
 *
 * Der Umbau löst einen Zustand ab, den man nur durch Nachmessen findet: die
 * fachliche Prüfung war vollständig gebaut und **nirgends gebunden** (`zim-ep` trug
 * sieben Generierungs-Schritte und keinen `llm_qs`, `qsRegelnFuerArtefakt` hatte
 * keinen Produktiv-Aufrufer). Nichts daran war rot — es fehlte kein Fehler, es fehlte
 * eine Prüfung. Diese Datei nagelt fest, dass die Bindung jetzt existiert UND dass
 * ihr Aus-Zustand eine bewusste Entscheidung ist statt eines Versehens.
 */
import { describe, expect, it } from 'vitest';
import { normalizeRegistryFile } from '../storage';
import { prueferFuerArtefakt, prueferMitArt, pruefItemsFuer, workflowFuerArtefakt } from '../selectors';
import { reconcileEinmaligeAktivierungen, GA_FACHPRUEFER_MIGRATION } from '../migrations';
import { SEED_QS_SKILL, QS_BASIS_SKILL_ID, ZIM_EP_DEF } from '../seed';
import { gegenrolle } from '@/core/services/ai/ki-ziel';
import type { PruefItem, SkillRecord, SkillRegistryFile, WorkflowDef } from '../types';

function skill(id: string, over: Partial<SkillRecord> = {}): SkillRecord {
  return {
    id, name: id, beschreibung: '', version: 1, promptTemplate: 'P',
    modifiers: { neu: '', kuerzer: '', laenger: '' }, regelIds: [], slots: [],
    geaendert_am: 't', ...over,
  };
}
function wf(over: Partial<WorkflowDef> = {}): WorkflowDef {
  return { id: 'zim-ep', name: 'GA', version: 1, steps: [], artefaktTyp: 'ga', ...over };
}
function file(skills: SkillRecord[], workflows: WorkflowDef[]): SkillRegistryFile {
  return { version: 1, updated_at: 't', skills, regeln: [], workflows };
}

const ITEM = (over: Partial<PruefItem> = {}): PruefItem => ({
  id: 'k1', gruppe: 'Erdung', kriterium: 'Jede Aussage ist durch die VB gedeckt.', ...over,
});

describe('Der Seed bindet den Prüfer — und schaltet ihn an', () => {
  it('qs-basis ist der fachliche Prüfer und läuft', () => {
    expect(SEED_QS_SKILL.pruefart).toBe('fachlich');
    // v6.36: an. Er existiert nur in dev und pl, und pl wird produktiv nicht genutzt —
    // der Preis einer noch ungemessenen Prüfung ist damit die eigene Wartezeit, und
    // gemessen wird an echten Läufen statt an einem Testkorpus davor.
    expect(SEED_QS_SKILL.aktiv).toBe(true);
  });

  it('der Kill-Switch bleibt: aktiv:false nimmt ihn aus der Kette', () => {
    const aus = { ...SEED_QS_SKILL, aktiv: false };
    const f = file([aus], [wf({ pruefer: [QS_BASIS_SKILL_ID] })]);
    expect(prueferFuerArtefakt(f, 'ga')).toEqual([]);
  });

  it('zim-ep bindet ihn am ARTEFAKT, nicht als llm_qs-Schritte', () => {
    expect(ZIM_EP_DEF.pruefer).toEqual([QS_BASIS_SKILL_ID]);
    expect(ZIM_EP_DEF.steps.every(s => (s.rolle ?? 'generierung') === 'generierung')).toBe(true);
  });
});

describe('Prüfkatalog überlebt das Laden', () => {
  it('vollständiger Eintrag kommt unverändert an', () => {
    const roh = file([skill('p', { pruefart: 'fachlich', pruefkatalog: [ITEM({ herkunft: 'RL 4.5.1', giltFuer: ['A'] })] })], []);
    const p = normalizeRegistryFile(roh)!.skills[0]!;
    expect(p.pruefart).toBe('fachlich');
    expect(p.pruefkatalog).toEqual([ITEM({ herkunft: 'RL 4.5.1', giltFuer: ['A'] })]);
  });

  it('Eintrag ohne id oder ohne Kriterium faellt weg', () => {
    const roh = file([skill('p', {
      pruefkatalog: [ITEM({ id: '' }), ITEM({ id: 'k2', kriterium: '  ' }), ITEM({ id: 'k3', kriterium: 'gilt' })],
    })], []);
    expect(normalizeRegistryFile(roh)!.skills[0]!.pruefkatalog).toHaveLength(1);
  });

  it('zwei gleiche Kriteriums-Texte: der zweite faellt weg', () => {
    // Der Befund wird ueber den Text zurueckgemappt (er ist die ###-Ueberschrift im
    // Antwortformat) — zwei gleiche Texte waeren nicht unterscheidbar.
    const roh = file([skill('p', { pruefkatalog: [ITEM({ id: 'a' }), ITEM({ id: 'b' })] })], []);
    const k = normalizeRegistryFile(roh)!.skills[0]!.pruefkatalog!;
    expect(k).toHaveLength(1);
    expect(k[0]!.id).toBe('a');
  });

  it('fehlende Gruppe wird zu „Allgemein", leerer Katalog zu gar keinem Feld', () => {
    const roh = file([
      skill('p', { pruefkatalog: [ITEM({ gruppe: '' })] }),
      skill('q', { pruefkatalog: [] }),
    ], []);
    const out = normalizeRegistryFile(roh)!;
    expect(out.skills[0]!.pruefkatalog![0]!.gruppe).toBe('Allgemein');
    expect(out.skills[1]).not.toHaveProperty('pruefkatalog');
  });

  it('die Prüfer-Bindung am Workflow überlebt ebenfalls', () => {
    const roh = file([], [wf({ pruefer: ['p', '  ', ''] })]);
    expect(normalizeRegistryFile(roh)!.workflows![0]!.pruefer).toEqual(['p']);
  });
});

describe('prueferFuerArtefakt — zwei Tore', () => {
  const p = skill('p', { pruefart: 'fachlich' });

  it('löst die gebundenen IDs in Lauf-Reihenfolge auf', () => {
    const q = skill('q', { pruefart: 'textlich' });
    const out = prueferFuerArtefakt(file([q, p], [wf({ pruefer: ['p', 'q'] })]), 'ga');
    expect(out.map(s => s.id)).toEqual(['p', 'q']);
  });

  it('ein stillgelegter Prüfer fliegt raus (Kill-Switch)', () => {
    const aus = { ...p, aktiv: false };
    expect(prueferFuerArtefakt(file([aus], [wf({ pruefer: ['p'] })]), 'ga')).toEqual([]);
  });

  it('eine verwaiste ID fliegt still raus', () => {
    expect(prueferFuerArtefakt(file([], [wf({ pruefer: ['weg'] })]), 'ga')).toEqual([]);
  });

  it('ohne Bindung: leer — die Kette bleibt zweibeinig', () => {
    expect(prueferFuerArtefakt(file([p], [wf({})]), 'ga')).toEqual([]);
  });

  it('prueferMitArt greift genau die gesuchte Sicht', () => {
    const lekt = skill('l', { pruefart: 'textlich' });
    const f = file([lekt, p], [wf({ pruefer: ['l', 'p'] })]);
    expect(prueferMitArt(f, 'ga', 'fachlich')?.id).toBe('p');
    expect(prueferMitArt(f, 'ga', 'administrativ')).toBeUndefined();
  });

  it('workflowFuerArtefakt faellt auf den Seed-Workflow zurueck', () => {
    const f: SkillRegistryFile = { version: 1, updated_at: 't', skills: [], regeln: [] };
    expect(workflowFuerArtefakt(f, 'ga')?.id).toBe('zim-ep');
  });
});

describe('pruefItemsFuer — die engere Angabe schlaegt die weitere', () => {
  const pruefer = skill('p', {
    pruefart: 'fachlich',
    pruefkatalog: [
      ITEM({ id: 'ueberall', kriterium: 'gilt ueberall' }),
      ITEM({ id: 'nurA', kriterium: 'nur in A', giltFuer: ['A'] }),
      ITEM({ id: 'aus', kriterium: 'stillgelegt', aktiv: false }),
      ITEM({ id: 'leer', kriterium: 'leere Liste gilt ueberall', giltFuer: [] }),
    ],
  });

  it('schneidet den Katalog ueber giltFuer zu; leer heisst ueberall', () => {
    expect(pruefItemsFuer(pruefer, 'A')).toEqual(['gilt ueberall', 'nur in A', 'leere Liste gilt ueberall']);
    expect(pruefItemsFuer(pruefer, 'B')).toEqual(['gilt ueberall', 'leere Liste gilt ueberall']);
  });

  it('qsKriterien am Abschnitts-Skill gewinnen vollstaendig', () => {
    const abschnitt = skill('A', { qsKriterien: ['eigenes Kriterium'] });
    expect(pruefItemsFuer(pruefer, 'A', abschnitt)).toEqual(['eigenes Kriterium']);
  });

  it('leere qsKriterien fallen auf den Katalog zurueck', () => {
    const abschnitt = skill('A', { qsKriterien: ['   '] });
    expect(pruefItemsFuer(pruefer, 'B', abschnitt)).toEqual(['gilt ueberall', 'leere Liste gilt ueberall']);
  });

  it('ohne Prüfer und ohne Kriterien: leer (dann greifen die generischen Dimensionen)', () => {
    expect(pruefItemsFuer(undefined, 'A')).toEqual([]);
  });
});

describe('gegenrolle', () => {
  it('kehrt die Rolle um — der Prüfer laeuft nicht auf dem Erzeuger', () => {
    expect(gegenrolle('standard')).toBe('stark');
    expect(gegenrolle('stark')).toBe('standard');
  });
});

describe('Migration: Prüfer-Bindung auf Bestands-Shares', () => {
  const ALLE_MARKER = reconcileEinmaligeAktivierungen(
    { version: 1, updated_at: 't', skills: [], regeln: [] },
  ).file.angewandteMigrationen ?? [];
  const nurDiese = (skills: SkillRecord[], workflows: WorkflowDef[]): SkillRegistryFile => ({
    ...file(skills, workflows),
    angewandteMigrationen: ALLE_MARKER.filter(m => m !== GA_FACHPRUEFER_MIGRATION),
  });

  it('setzt Bindung + Prüfart und legt einen NIE entschiedenen Prüfer still', () => {
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(
      nurDiese([skill(QS_BASIS_SKILL_ID)], [wf({ id: 'zim-ep', version: 2 })]),
    );
    expect(geaendert).toBe(true);
    expect(out.workflows![0]!.pruefer).toEqual([QS_BASIS_SKILL_ID]);
    expect(out.workflows![0]!.version).toBe(3);
    expect(out.skills[0]!.pruefart).toBe('fachlich');
    // Der springende Punkt, gemessen an einer echten Share-Kopie: auf einem
    // Bestands-Share FEHLT `aktiv` — und `undefined` gilt als aktiv. Ohne diese
    // Zeile ginge die nie gemessene Prüfung dort beim naechsten Abschnitt scharf.
    expect(out.skills[0]!.aktiv).toBe(false);
  });

  it('eine EXPLIZITE Entscheidung bleibt stehen — in beide Richtungen', () => {
    const an = reconcileEinmaligeAktivierungen(
      nurDiese([skill(QS_BASIS_SKILL_ID, { aktiv: true })], [wf({ id: 'zim-ep' })]),
    ).file;
    expect(an.skills[0]!.aktiv).toBe(true);
    const aus = reconcileEinmaligeAktivierungen(
      nurDiese([skill(QS_BASIS_SKILL_ID, { aktiv: false })], [wf({ id: 'zim-ep' })]),
    ).file;
    expect(aus.skills[0]!.aktiv).toBe(false);
  });

  it('eine bereits gesetzte Bindung wird nicht ueberschrieben', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      nurDiese([skill(QS_BASIS_SKILL_ID)], [wf({ id: 'zim-ep', pruefer: ['eigener-pruefer'] })]),
    );
    expect(out.workflows![0]!.pruefer).toEqual(['eigener-pruefer']);
  });

  it('eine bereits gesetzte Prüfart wird nicht ueberschrieben', () => {
    const { file: out } = reconcileEinmaligeAktivierungen(
      nurDiese([skill(QS_BASIS_SKILL_ID, { pruefart: 'administrativ' })], [wf({ id: 'zim-ep' })]),
    );
    expect(out.skills[0]!.pruefart).toBe('administrativ');
  });

  it('ein Share ohne workflows bricht nicht — mergeMissingSeeds bringt sie mit', () => {
    const ohne: SkillRegistryFile = {
      version: 1, updated_at: 't', skills: [skill(QS_BASIS_SKILL_ID)], regeln: [],
      angewandteMigrationen: ALLE_MARKER.filter(m => m !== GA_FACHPRUEFER_MIGRATION),
    };
    const { file: out } = reconcileEinmaligeAktivierungen(ohne);
    expect(out.skills[0]!.pruefart).toBe('fachlich');
    expect(out.skills[0]!.aktiv).toBe(false);
    expect(out.workflows).toBeUndefined();
  });

  it('laeuft nur einmal — eine spaetere Entbindung bleibt stehen', () => {
    const einmal = reconcileEinmaligeAktivierungen(
      nurDiese([skill(QS_BASIS_SKILL_ID)], [wf({ id: 'zim-ep' })]),
    ).file;
    const entbunden: SkillRegistryFile = {
      ...einmal,
      workflows: [{ ...einmal.workflows![0]!, pruefer: [] }],
    };
    const { file: out, geaendert } = reconcileEinmaligeAktivierungen(entbunden);
    expect(geaendert).toBe(false);
    expect(out.workflows![0]!.pruefer).toEqual([]);
  });
});
