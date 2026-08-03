/**
 * Die Regel-Fabrik wird von ZWEI Aufrufern genutzt (Skill-Verwaltungsseite und
 * Inline-Werkstatt in der Gutachten-Ansicht). Der Test hält fest, was beim
 * Kopieren statt Teilen verloren gegangen wäre — allen voran das Aufräumen der
 * `regelIds` beim Löschen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildRegelMutations } from '../regelMutations';
import type { QualitaetsRegel, SkillRecord, SkillRegistryFile } from '@/core/services/skills';

function regel(id: string, over: Partial<QualitaetsRegel> = {}): QualitaetsRegel {
  return {
    id,
    name: `Regel ${id}`,
    typ: 'verbotenes_muster',
    params: {},
    schweregrad: 'hinweis',
    aktiv: true,
    erstellt_am: '2026-01-01T00:00:00.000Z',
    geaendert_am: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function skill(id: string, regelIds: string[]): SkillRecord {
  return {
    id,
    name: `Skill ${id}`,
    beschreibung: '',
    version: 1,
    promptTemplate: 'x',
    modifiers: { neu: '', kuerzer: '', laenger: '' },
    regelIds,
    slots: [],
    geaendert_am: '2026-01-01T00:00:00.000Z',
  };
}

const BASIS: SkillRegistryFile = {
  version: 1,
  updated_at: '2026-01-01T00:00:00.000Z',
  regeln: [regel('r1'), regel('r2'), regel('r3')],
  skills: [skill('s1', ['r1', 'r2']), skill('s2', ['r2']), skill('s3', [])],
};

/** Fängt den geschriebenen Stand ab, statt echt zu persistieren. */
function fabrik(file: SkillRegistryFile = BASIS) {
  const geschrieben: SkillRegistryFile[] = [];
  const roh: SkillRegistryFile[] = [];
  const gespeichert = vi.fn();
  const geloescht = vi.fn();
  const mut = buildRegelMutations({
    file,
    run: async next => { geschrieben.push(next); },
    persist: async next => { roh.push(next); },
    onGespeichert: gespeichert,
    onGeloescht: geloescht,
  });
  return { mut, geschrieben, roh, gespeichert, geloescht };
}

describe('buildRegelMutations', () => {
  beforeEach(() => { vi.stubGlobal('window', { confirm: (): boolean => true }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('deleteRegel entfernt die Zuordnung in ALLEN Skills, nicht nur im ersten', async () => {
    const { mut, geschrieben, geloescht } = fabrik();
    mut.deleteRegel(regel('r2'));
    await vi.waitFor(() => expect(geschrieben).toHaveLength(1));

    const next = geschrieben[0]!;
    expect(next.regeln.map(r => r.id)).toEqual(['r1', 'r3']);
    // s1 UND s2 verwiesen auf r2 — beide müssen sauber sein.
    expect(next.skills.find(s => s.id === 's1')!.regelIds).toEqual(['r1']);
    expect(next.skills.find(s => s.id === 's2')!.regelIds).toEqual([]);
    await vi.waitFor(() => expect(geloescht).toHaveBeenCalledOnce());
  });

  it('deleteRegel bricht ab, wenn die Rückfrage verneint wird', () => {
    vi.stubGlobal('window', { confirm: (): boolean => false });
    const { mut, geschrieben } = fabrik();
    mut.deleteRegel(regel('r2'));
    expect(geschrieben).toHaveLength(0);
  });

  it('saveRegel ersetzt an Ort und Stelle — die Reihenfolge ist Prompt-Text', async () => {
    const { mut, geschrieben, gespeichert } = fabrik();
    mut.saveRegel(regel('r2', { name: 'Umbenannt' }));
    await vi.waitFor(() => expect(geschrieben).toHaveLength(1));

    expect(geschrieben[0]!.regeln.map(r => r.id)).toEqual(['r1', 'r2', 'r3']);
    expect(geschrieben[0]!.regeln[1]!.name).toBe('Umbenannt');
    await vi.waitFor(() => expect(gespeichert).toHaveBeenCalledOnce());
  });

  it('toggleAktiv kippt das Flag und stempelt geaendert_am neu', async () => {
    const { mut, geschrieben } = fabrik();
    mut.toggleAktiv(regel('r1', { aktiv: true }));
    await vi.waitFor(() => expect(geschrieben).toHaveLength(1));

    const r = geschrieben[0]!.regeln.find(x => x.id === 'r1')!;
    expect(r.aktiv).toBe(false);
    expect(r.geaendert_am).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('persistRegel nutzt den ROHEN Persist (Leave-Guard-Pfad) und schließt nichts', async () => {
    const { mut, roh, geschrieben, gespeichert } = fabrik();
    await mut.persistRegel(regel('r3', { name: 'Vor dem Verlassen' }));

    expect(roh).toHaveLength(1);
    expect(roh[0]!.regeln.find(r => r.id === 'r3')!.name).toBe('Vor dem Verlassen');
    expect(geschrieben).toHaveLength(0);
    expect(gespeichert).not.toHaveBeenCalled();
  });

  it('lässt den Ausgangsstand unangetastet (keine In-Place-Mutation)', async () => {
    const { mut, geschrieben } = fabrik();
    mut.deleteRegel(regel('r2'));
    await vi.waitFor(() => expect(geschrieben).toHaveLength(1));

    expect(BASIS.regeln.map(r => r.id)).toEqual(['r1', 'r2', 'r3']);
    expect(BASIS.skills.find(s => s.id === 's1')!.regelIds).toEqual(['r1', 'r2']);
  });
});
