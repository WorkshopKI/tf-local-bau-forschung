import { describe, it, expect } from 'vitest';
import type { AntragListItem } from '@/core/services/csv/types';
import {
  classifyPrecheckBucket,
  matchesPrecheckBucket,
  applyPrecheckBucket,
  getPrecheckItems,
  asPrecheckBucket,
} from '../precheckQuickfilter';

/** Minimaler AntragListItem-Stub: nur der TV-PreCheck wird gesetzt. */
function item(label: string | null | undefined): AntragListItem {
  return { aktenzeichen: 'x', precheck_tv_status_label: label } as unknown as AntragListItem;
}

describe('classifyPrecheckBucket', () => {
  const cases: Array<[string | null | undefined, ReturnType<typeof classifyPrecheckBucket>]> = [
    ['PreCheck positiv - Verbund', 'positiv'], // Bindestrich zählt NICHT als negativ
    ['D_PC+', 'positiv'],
    ['PreCheck negativ', 'negativ'],
    ['D_PC-', 'negativ'],
    ['PreCheck ausstehend', 'offen'],
    ['D_PC?', 'offen'],
    ['', 'offen'],        // 'ohne' → in „offen" gefaltet
    [null, 'offen'],
    [undefined, 'offen'],
    ['   ', 'offen'],
  ];
  it.each(cases)('%o → %s', (label, expected) => {
    expect(classifyPrecheckBucket(label)).toBe(expected);
  });
});

describe('matchesPrecheckBucket', () => {
  it('„Alle" matcht jeden Antrag', () => {
    expect(matchesPrecheckBucket(item('PreCheck negativ'), 'Alle')).toBe(true);
    expect(matchesPrecheckBucket(item(''), 'Alle')).toBe(true);
  });
  it('positiv matcht nur positiv', () => {
    expect(matchesPrecheckBucket(item('D_PC+'), 'positiv')).toBe(true);
    expect(matchesPrecheckBucket(item('D_PC-'), 'positiv')).toBe(false);
  });
  it('offen matcht leere UND ausstehende Labels', () => {
    expect(matchesPrecheckBucket(item(''), 'offen')).toBe(true);
    expect(matchesPrecheckBucket(item('D_PC?'), 'offen')).toBe(true);
    expect(matchesPrecheckBucket(item('PreCheck positiv'), 'offen')).toBe(false);
  });
});

describe('applyPrecheckBucket', () => {
  const list = [
    item('PreCheck positiv'),
    item('PreCheck negativ'),
    item(''),
    item('D_PC?'),
    item('D_PC+'),
  ];
  it('„Alle" gibt die Liste unverändert zurück (Identität)', () => {
    expect(applyPrecheckBucket(list, 'Alle')).toBe(list);
  });
  it('positiv filtert auf 2', () => {
    expect(applyPrecheckBucket(list, 'positiv')).toHaveLength(2);
  });
  it('negativ filtert auf 1', () => {
    expect(applyPrecheckBucket(list, 'negativ')).toHaveLength(1);
  });
  it('offen filtert auf 2 (leer + ausstehend)', () => {
    expect(applyPrecheckBucket(list, 'offen')).toHaveLength(2);
  });
});

describe('getPrecheckItems', () => {
  it('partitioniert die countBase exakt (positiv+negativ+offen = Alle)', () => {
    const base = [
      item('PreCheck positiv'),
      item('D_PC+'),
      item('PreCheck negativ'),
      item(''),
      item('D_PC?'),
    ];
    const items = getPrecheckItems(base);
    const byLabel = Object.fromEntries(items.map(i => [i.label, i.count]));
    expect(byLabel['Alle']).toBe(5);
    expect(byLabel['positiv']).toBe(2);
    expect(byLabel['negativ']).toBe(1);
    expect(byLabel['offen']).toBe(2);
    expect((byLabel['positiv'] ?? 0) + (byLabel['negativ'] ?? 0) + (byLabel['offen'] ?? 0)).toBe(byLabel['Alle']);
  });
  it('Reihenfolge Alle → positiv → negativ → offen', () => {
    expect(getPrecheckItems([]).map(i => i.label)).toEqual(['Alle', 'positiv', 'negativ', 'offen']);
  });
});

describe('asPrecheckBucket', () => {
  it('gültige Buckets bleiben erhalten', () => {
    expect(asPrecheckBucket('positiv')).toBe('positiv');
    expect(asPrecheckBucket('negativ')).toBe('negativ');
    expect(asPrecheckBucket('offen')).toBe('offen');
  });
  it('alles andere → Alle', () => {
    expect(asPrecheckBucket('Alle')).toBe('Alle');
    expect(asPrecheckBucket('quatsch')).toBe('Alle');
    expect(asPrecheckBucket(undefined)).toBe('Alle');
    expect(asPrecheckBucket(42)).toBe('Alle');
  });
});
