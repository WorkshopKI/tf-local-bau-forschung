import { describe, it, expect } from 'vitest';
import { matchTvAusDateiname } from '../quellen';

describe('matchTvAusDateiname', () => {
  const tvs = ['16KN123456', '16KN123457', '16KN123458'];

  it('findet das TV-FKZ im Dateinamen (mit Trennern/Groß-Klein)', () => {
    expect(matchTvAusDateiname('Anlage_5_16kn123457_final.pdf', tvs)).toBe('16KN123457');
    expect(matchTvAusDateiname('16KN 12 34 58 - Arbeitsplan.docx', tvs)).toBe('16KN123458');
  });

  it('ohne erkennbares TV-FKZ → null', () => {
    expect(matchTvAusDateiname('Arbeitsplan_ohne_kennung.pdf', tvs)).toBeNull();
    expect(matchTvAusDateiname('Anlage 5.docx', tvs)).toBeNull();
  });

  it('bei Präfix-Kollision gewinnt das längste passende TV-FKZ', () => {
    const kollision = ['16KN1234', '16KN12345'];
    expect(matchTvAusDateiname('anlage5-16kn12345.pdf', kollision)).toBe('16KN12345');
  });
});
