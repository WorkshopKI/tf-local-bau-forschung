import { describe, it, expect } from 'vitest';
import {
  comboKey,
  keyOfCombo,
  serializeJsonl,
  parseJsonl,
  dedupeLastByKey,
  buildCombos,
  pendingCombos,
} from '../orchestration';
import type { SectionDef } from '../registry-load';
import type { EvalModelConfig, Fixture } from '../types';

function fixture(vbFile: string, antragstyp: 'EP' | 'KN'): Fixture {
  return {
    vbFile,
    antragstyp,
    context: {
      key: 'k', akronym: 'A', titel: null, antragsteller: null,
      foerderkennzeichen: 'k', knownIds: ['k'], teilvorhaben: [],
    },
    vbMarkdown: '# vb',
  };
}

const m1: EvalModelConfig = { id: 'm1', name: 'M1', baseUrl: 'http://x', model: 'a', klasse: 'intern' };
const m2: EvalModelConfig = { id: 'm2', name: 'M2', baseUrl: 'http://y', model: 'b', klasse: 'intern' };
const sections: SectionDef[] = [
  { abschnitt: 'A', skillId: 'gutachten-kurzfassung', label: 'Kurzfassung' },
  { abschnitt: 'B', skillId: 'gutachten-ausgangslage', label: 'Ausgangslage' },
];

describe('comboKey / JSONL', () => {
  it('comboKey ist stabil und eindeutig', () => {
    expect(comboKey('f.md', 'm1', 'A')).toBe('f.md m1 A');
  });

  it('kontext-Achse: „voll" hängt KEIN Suffix an (Alt-Resume bleibt gültig), „relevant" disambiguiert', () => {
    expect(comboKey('f.md', 'm1', 'A', 'voll')).toBe('f.md m1 A');
    expect(comboKey('f.md', 'm1', 'A', 'relevant')).toBe('f.md m1 A relevant');
    expect(comboKey('f.md', 'm1', 'A', 'voll')).not.toBe(comboKey('f.md', 'm1', 'A', 'relevant'));
  });

  it('serialize/parse JSONL round-trip, tolerant gegen kaputte Zeilen', () => {
    const a = { x: 1 };
    const b = { x: 2 };
    const text = serializeJsonl(a) + 'KAPUTT{\n' + serializeJsonl(b) + '\n';
    const parsed = parseJsonl<{ x: number }>(text);
    expect(parsed).toEqual([a, b]);
  });

  it('dedupeLastByKey behält das letzte Vorkommen', () => {
    const items = [{ k: 'a', v: 1 }, { k: 'a', v: 2 }, { k: 'b', v: 3 }];
    expect(dedupeLastByKey(items, i => i.k)).toEqual([{ k: 'a', v: 2 }, { k: 'b', v: 3 }]);
  });
});

describe('buildCombos', () => {
  it('volles Kreuzprodukt EP × Modelle × Abschnitte', () => {
    const { combos, skippedKN } = buildCombos([fixture('a.md', 'EP')], [m1, m2], sections);
    expect(combos).toHaveLength(1 * 2 * 2);
    expect(skippedKN).toEqual([]);
    expect(keyOfCombo(combos[0]!)).toBe('a.md m1 A');
  });

  it('KN-Fixtures werden ausgelassen und separat zurückgegeben (kein stiller Drop)', () => {
    const { combos, skippedKN } = buildCombos(
      [fixture('ep.md', 'EP'), fixture('kn.md', 'KN')],
      [m1],
      sections,
    );
    expect(combos.every(c => c.fixture.vbFile === 'ep.md')).toBe(true);
    expect(skippedKN.map(f => f.vbFile)).toEqual(['kn.md']);
  });

  it('kontext=both verdoppelt die Kombinationen je Abschnitt; Resume-Keys disjunkt', () => {
    const { combos } = buildCombos([fixture('a.md', 'EP')], [m1], sections, ['voll', 'relevant']);
    expect(combos).toHaveLength(1 * 1 * 2 * 2); // fixture × modell × abschnitt × kontext
    expect(combos.filter(c => c.kontext === 'voll')).toHaveLength(2);
    expect(combos.filter(c => c.kontext === 'relevant')).toHaveLength(2);
    const keys = combos.map(keyOfCombo);
    expect(new Set(keys).size).toBe(keys.length); // alle eindeutig
    expect(keys).toContain('a.md m1 A');
    expect(keys).toContain('a.md m1 A relevant');
  });
});

describe('pendingCombos (Resume)', () => {
  it('überspringt bereits erledigte Kombinationen', () => {
    const { combos } = buildCombos([fixture('a.md', 'EP')], [m1], sections);
    const done = new Set(['a.md m1 A']);
    const pending = pendingCombos(combos, done);
    expect(pending).toHaveLength(1);
    expect(keyOfCombo(pending[0]!)).toBe('a.md m1 B');
  });

  it('alles erledigt → leeres Pending', () => {
    const { combos } = buildCombos([fixture('a.md', 'EP')], [m1], sections);
    const done = new Set(combos.map(keyOfCombo));
    expect(pendingCombos(combos, done)).toEqual([]);
  });
});
