import { describe, it, expect } from 'vitest';
import {
  buildAnonymMap,
  resolveAnonIdForUser,
  nextFreeAnonId,
  normalizeKuerzel,
} from '../services/anonym-map';
import type { Antrag, AntragListItem } from '@/core/services/csv/types';

function makeAntrag(az: string, tib?: string): Antrag {
  return {
    aktenzeichen: az,
    programm_id: 'p1',
    tib_kuerz: tib,
    _field_sources: {},
    _updated_at: new Date().toISOString(),
  } as Antrag;
}

function makeListItem(az: string, tib?: string): AntragListItem {
  return {
    aktenzeichen: az,
    programm_id: 'p1',
    tib_kuerz: tib,
    _updated_at: new Date().toISOString(),
  };
}

describe('normalizeKuerzel', () => {
  it('trimmt und uppercased', () => {
    expect(normalizeKuerzel(' mue ')).toBe('MUE');
  });
  it('non-string -> null', () => {
    expect(normalizeKuerzel(null)).toBe(null);
    expect(normalizeKuerzel(undefined)).toBe(null);
    expect(normalizeKuerzel(42)).toBe(null);
  });
  it('leerer String -> null', () => {
    expect(normalizeKuerzel('')).toBe(null);
    expect(normalizeKuerzel('   ')).toBe(null);
  });
});

describe('buildAnonymMap', () => {
  it('alphabetische Sortierung -> stabile MA-Nummern', () => {
    const map = buildAnonymMap([
      makeAntrag('A1', 'MUE'),
      makeAntrag('A2', 'SCH'),
      makeAntrag('A3', 'ALB'),
    ]);
    expect(map.toAnon.get('ALB')).toBe('MA01');
    expect(map.toAnon.get('MUE')).toBe('MA02');
    expect(map.toAnon.get('SCH')).toBe('MA03');
  });

  it('inverse Map ist konsistent', () => {
    const map = buildAnonymMap([
      makeAntrag('A1', 'MUE'),
      makeAntrag('A2', 'SCH'),
    ]);
    for (const [real, anon] of map.toAnon.entries()) {
      expect(map.toReal.get(anon)).toBe(real);
    }
  });

  it('Duplikate werden zusammengefasst (case-insensitive)', () => {
    const map = buildAnonymMap([
      makeAntrag('A1', 'mue'),
      makeAntrag('A2', 'MUE'),
      makeAntrag('A3', ' mue '),
    ]);
    expect(map.toAnon.size).toBe(1);
    expect(map.toAnon.get('MUE')).toBe('MA01');
  });

  it('leeres tib_kuerz wird ignoriert', () => {
    const map = buildAnonymMap([
      makeAntrag('A1', ''),
      makeAntrag('A2', undefined),
      makeAntrag('A3', 'MUE'),
    ]);
    expect(map.toAnon.size).toBe(1);
  });

  it('determinismus: zwei Aufrufe -> gleiches Mapping', () => {
    const input = [
      makeAntrag('A1', 'MUE'),
      makeAntrag('A2', 'SCH'),
      makeAntrag('A3', 'ALB'),
    ];
    const a = buildAnonymMap(input);
    const b = buildAnonymMap(input);
    for (const [k, v] of a.toAnon.entries()) {
      expect(b.toAnon.get(k)).toBe(v);
    }
  });

  it('akzeptiert AntragListItem genauso wie Antrag', () => {
    const map = buildAnonymMap([
      makeListItem('A1', 'MUE'),
      makeListItem('A2', 'SCH'),
    ]);
    expect(map.toAnon.size).toBe(2);
  });

  it('viele MAs -> Padding ueber 9 hinaus', () => {
    const antraege = [];
    for (let i = 1; i <= 12; i++) {
      antraege.push(makeAntrag(`A${i}`, `B${String.fromCharCode(64 + i)}`));
    }
    const map = buildAnonymMap(antraege);
    expect(map.toAnon.size).toBe(12);
    expect([...map.toReal.keys()].sort()).toEqual([
      'MA01', 'MA02', 'MA03', 'MA04', 'MA05', 'MA06',
      'MA07', 'MA08', 'MA09', 'MA10', 'MA11', 'MA12',
    ]);
  });
});

describe('resolveAnonIdForUser', () => {
  const map = buildAnonymMap([
    makeAntrag('A1', 'MUE'),
    makeAntrag('A2', 'SCH'),
  ]);

  it('match exakt', () => {
    expect(resolveAnonIdForUser('MUE', map)).toBe(map.toAnon.get('MUE'));
  });
  it('match case-insensitive', () => {
    expect(resolveAnonIdForUser('mue', map)).toBe(map.toAnon.get('MUE'));
  });
  it('Mehrfach-Kuerzel -> erstes matchendes', () => {
    expect(resolveAnonIdForUser('XYZ,MUE', map)).toBe(map.toAnon.get('MUE'));
  });
  it('"alle" -> null (Filter deaktiviert)', () => {
    expect(resolveAnonIdForUser('alle', map)).toBe(null);
    expect(resolveAnonIdForUser('Alle', map)).toBe(null);
  });
  it('unbekannt -> null', () => {
    expect(resolveAnonIdForUser('XYZ', map)).toBe(null);
  });
  it('leer -> null', () => {
    expect(resolveAnonIdForUser('', map)).toBe(null);
    expect(resolveAnonIdForUser(undefined, map)).toBe(null);
  });
});

describe('nextFreeAnonId', () => {
  it('leeres Set -> MA01', () => {
    expect(nextFreeAnonId([])).toBe('MA01');
  });
  it('Luecke fuellen', () => {
    expect(nextFreeAnonId(['MA01', 'MA03'])).toBe('MA02');
  });
  it('keine Luecke -> n+1', () => {
    expect(nextFreeAnonId(['MA01', 'MA02', 'MA03'])).toBe('MA04');
  });
  it('non-MA-Eintraege werden ignoriert', () => {
    expect(nextFreeAnonId(['XX', 'MA01', 'MA02'])).toBe('MA03');
  });
});
