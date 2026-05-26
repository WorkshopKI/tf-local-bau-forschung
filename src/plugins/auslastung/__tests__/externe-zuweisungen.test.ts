/**
 * Unit-Tests für externe-zuweisungen.ts.
 *
 * Schwerpunkte:
 *  1. `dateToQuartal` — Quartal-Ableitung aus ISO-Date.
 *  2. `parseKuerzelTokens` — Tokenisierung des Profil-Felds.
 *  3. `countExterneZuweisungenImQuartal` — Zählung extern zugewiesener Anträge.
 *  4. `getExterneAntragIds` — IDs für Pool-Filter.
 */
import { describe, it, expect } from 'vitest';
import {
  dateToQuartal,
  parseKuerzelTokens,
  countExterneZuweisungenImQuartal,
  getExterneAntragIds,
  type ExterneZuweisungAntrag,
} from '../services/externe-zuweisungen';

function makeAntrag(overrides: Partial<ExterneZuweisungAntrag> = {}): ExterneZuweisungAntrag {
  return {
    aktenzeichen: '16EP260112',
    tib_kuerz: 'MUE',
    antragsdatum: '2026-04-15',
    ...overrides,
  };
}

describe('dateToQuartal', () => {
  it('ISO-Date "YYYY-MM-DD" → Quartal', () => {
    expect(dateToQuartal('2026-01-15')).toBe('2026-Q1');
    expect(dateToQuartal('2026-03-31')).toBe('2026-Q1');
    expect(dateToQuartal('2026-04-01')).toBe('2026-Q2');
    expect(dateToQuartal('2026-06-30')).toBe('2026-Q2');
    expect(dateToQuartal('2026-07-01')).toBe('2026-Q3');
    expect(dateToQuartal('2026-09-30')).toBe('2026-Q3');
    expect(dateToQuartal('2026-10-01')).toBe('2026-Q4');
    expect(dateToQuartal('2026-12-31')).toBe('2026-Q4');
  });

  it('Slash-Separator "YYYY/MM/DD" → Quartal', () => {
    expect(dateToQuartal('2026/04/15')).toBe('2026-Q2');
  });

  it('führende/trailing Whitespace toleriert', () => {
    expect(dateToQuartal('  2026-04-15  ')).toBe('2026-Q2');
  });

  it('undefined/null/empty → null', () => {
    expect(dateToQuartal(undefined)).toBeNull();
    expect(dateToQuartal(null)).toBeNull();
    expect(dateToQuartal('')).toBeNull();
    expect(dateToQuartal('   ')).toBeNull();
  });

  it('ungültiges Format → null', () => {
    expect(dateToQuartal('15.04.2026')).toBeNull();    // de-Format wird NICHT unterstützt
    expect(dateToQuartal('foo')).toBeNull();
    expect(dateToQuartal('2026')).toBeNull();
    expect(dateToQuartal('2026-04')).toBeNull();       // ohne Tag wäre möglich, aber Regex verlangt -DD
  });

  it('ungültiger Monat → null', () => {
    expect(dateToQuartal('2026-00-15')).toBeNull();
    expect(dateToQuartal('2026-13-15')).toBeNull();
  });
});

describe('parseKuerzelTokens', () => {
  it('einzelnes Kürzel → ein Token', () => {
    expect(parseKuerzelTokens('MUE')).toEqual(['MUE']);
  });

  it('komma-separiert → mehrere Tokens', () => {
    expect(parseKuerzelTokens('MUE, SCH')).toEqual(['MUE', 'SCH']);
    expect(parseKuerzelTokens('MUE,SCH,LÄK')).toEqual(['MUE', 'SCH', 'LÄK']);
  });

  it('lowercase → uppercase normalisiert', () => {
    expect(parseKuerzelTokens('mue, sch')).toEqual(['MUE', 'SCH']);
  });

  it('"alle" (case-insensitive) → leeres Array (PL-Modus)', () => {
    expect(parseKuerzelTokens('alle')).toEqual([]);
    expect(parseKuerzelTokens('ALLE')).toEqual([]);
    expect(parseKuerzelTokens('  Alle  ')).toEqual([]);
  });

  it('leer/undefined/whitespace → leeres Array', () => {
    expect(parseKuerzelTokens(undefined)).toEqual([]);
    expect(parseKuerzelTokens(null)).toEqual([]);
    expect(parseKuerzelTokens('')).toEqual([]);
    expect(parseKuerzelTokens('   ')).toEqual([]);
  });

  it('leere Tokens werden gefiltert', () => {
    expect(parseKuerzelTokens('MUE,,SCH')).toEqual(['MUE', 'SCH']);
    expect(parseKuerzelTokens(', MUE , ')).toEqual(['MUE']);
  });
});

describe('countExterneZuweisungenImQuartal', () => {
  it('0 Treffer wenn keine Anträge passen', () => {
    const antraege = [
      makeAntrag({ tib_kuerz: 'SCH', antragsdatum: '2026-04-15' }),
      makeAntrag({ tib_kuerz: 'MUE', antragsdatum: '2026-01-15' }),  // anderes Q
    ];
    expect(countExterneZuweisungenImQuartal(antraege, ['MUE'], '2026-Q2')).toBe(0);
  });

  it('1 Treffer', () => {
    const antraege = [
      makeAntrag({ tib_kuerz: 'MUE', antragsdatum: '2026-04-15' }),
      makeAntrag({ tib_kuerz: 'SCH', antragsdatum: '2026-04-20' }),
    ];
    expect(countExterneZuweisungenImQuartal(antraege, ['MUE'], '2026-Q2')).toBe(1);
  });

  it('mehrere Kürzel-Tokens — alle Treffer addieren sich', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A', tib_kuerz: 'MUE', antragsdatum: '2026-04-15' }),
      makeAntrag({ aktenzeichen: 'B', tib_kuerz: 'SCH', antragsdatum: '2026-05-20' }),
      makeAntrag({ aktenzeichen: 'C', tib_kuerz: 'LÄK', antragsdatum: '2026-06-01' }),
    ];
    expect(countExterneZuweisungenImQuartal(antraege, ['MUE', 'SCH'], '2026-Q2')).toBe(2);
  });

  it('case-insensitive Match auf tib_kuerz', () => {
    const antraege = [
      makeAntrag({ tib_kuerz: 'mue', antragsdatum: '2026-04-15' }),
      makeAntrag({ tib_kuerz: 'Mue', antragsdatum: '2026-05-15' }),
    ];
    expect(countExterneZuweisungenImQuartal(antraege, ['MUE'], '2026-Q2')).toBe(2);
  });

  it('anderes Quartal wird ausgeschlossen', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A', tib_kuerz: 'MUE', antragsdatum: '2026-01-15' }),
      makeAntrag({ aktenzeichen: 'B', tib_kuerz: 'MUE', antragsdatum: '2026-04-15' }),
      makeAntrag({ aktenzeichen: 'C', tib_kuerz: 'MUE', antragsdatum: '2026-07-15' }),
    ];
    expect(countExterneZuweisungenImQuartal(antraege, ['MUE'], '2026-Q2')).toBe(1);
  });

  it('leere meineKuerzel → 0 (PL-Modus)', () => {
    const antraege = [makeAntrag()];
    expect(countExterneZuweisungenImQuartal(antraege, [], '2026-Q2')).toBe(0);
  });

  it('leere antraege-Liste → 0', () => {
    expect(countExterneZuweisungenImQuartal([], ['MUE'], '2026-Q2')).toBe(0);
  });

  it('Antrag ohne tib_kuerz oder antragsdatum → übersprungen', () => {
    const antraege = [
      makeAntrag({ tib_kuerz: undefined, antragsdatum: '2026-04-15' }),
      makeAntrag({ tib_kuerz: 'MUE', antragsdatum: undefined }),
      makeAntrag({ tib_kuerz: '', antragsdatum: '2026-04-15' }),
      makeAntrag({ tib_kuerz: 'MUE', antragsdatum: '' }),
    ];
    expect(countExterneZuweisungenImQuartal(antraege, ['MUE'], '2026-Q2')).toBe(0);
  });
});

describe('getExterneAntragIds', () => {
  it('Set der aktenzeichen mit Treffer', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A', tib_kuerz: 'MUE', antragsdatum: '2026-04-15' }),
      makeAntrag({ aktenzeichen: 'B', tib_kuerz: 'SCH', antragsdatum: '2026-05-15' }),
      makeAntrag({ aktenzeichen: 'C', tib_kuerz: 'MUE', antragsdatum: '2026-01-15' }),  // anderes Q
    ];
    const ids = getExterneAntragIds(antraege, ['MUE', 'SCH'], '2026-Q2');
    expect(ids).toEqual(new Set(['A', 'B']));
  });

  it('leere meineKuerzel → leeres Set', () => {
    const antraege = [makeAntrag()];
    const ids = getExterneAntragIds(antraege, [], '2026-Q2');
    expect(ids.size).toBe(0);
  });

  it('case-insensitive Match', () => {
    const antraege = [
      makeAntrag({ aktenzeichen: 'A', tib_kuerz: 'mue', antragsdatum: '2026-04-15' }),
    ];
    const ids = getExterneAntragIds(antraege, ['MUE'], '2026-Q2');
    expect(ids.has('A')).toBe(true);
  });
});
