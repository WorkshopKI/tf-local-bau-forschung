import { describe, it, expect } from 'vitest';
import { zeitplanUnsicher, hatLaufzeitSpanne, tabelleAlsMarkdown } from '../zeitplan-qualitaet';
import type { ApZeile, RohTabelle } from '../tabellen';

const ap = (over: Partial<ApZeile> = {}): ApZeile => ({ nummer: '1', bezeichnung: 'AP', istUnterAp: false, ...over });

describe('zeitplanUnsicher', () => {
  it('ist unsicher bei 0 geparsten AP-Zeilen', () => {
    expect(zeitplanUnsicher([])).toBe(true);
  });

  it('ist unsicher, wenn > 50 % der Zeilen keine Laufzeit-Spanne haben', () => {
    const zeilen = [
      ap({ monatStart: 1, monatEnde: 6 }),
      ap({ monatStart: undefined, monatEnde: undefined }),
      ap({ monatStart: 3, monatEnde: undefined }),
    ];
    expect(zeilen.filter(z => !hatLaufzeitSpanne(z)).length).toBe(2); // 2/3 > 0,5
    expect(zeitplanUnsicher(zeilen)).toBe(true);
  });

  it('ist sicher, wenn die Mehrheit der Zeilen eine Laufzeit-Spanne hat', () => {
    const zeilen = [
      ap({ monatStart: 1, monatEnde: 6 }),
      ap({ monatStart: 2, monatEnde: 8 }),
      ap({ monatStart: undefined, monatEnde: undefined }),
    ];
    expect(zeitplanUnsicher(zeilen)).toBe(false); // 1/3 ohne Spanne
  });

  it('genau 50 % ohne Spanne ist noch sicher (> 50 % ist die Grenze)', () => {
    const zeilen = [ap({ monatStart: 1, monatEnde: 6 }), ap({})];
    expect(zeitplanUnsicher(zeilen)).toBe(false);
  });
});

describe('tabelleAlsMarkdown', () => {
  const t = (over: Partial<RohTabelle> = {}): RohTabelle => ({ header: ['AP', 'Monate'], rows: [['1', '1–6']], start: 0, end: 0, ...over });

  it('rendert eine Pipe-Tabelle mit Kopf + Trenner + Zeilen', () => {
    expect(tabelleAlsMarkdown(t())).toBe('| AP | Monate |\n| --- | --- |\n| 1 | 1–6 |');
  });

  it('escaped Pipes in Zellen', () => {
    expect(tabelleAlsMarkdown(t({ rows: [['1', 'a|b']] }))).toContain('a\\|b');
  });

  it('füllt fehlende Zellen auf die Header-Breite auf', () => {
    expect(tabelleAlsMarkdown(t({ rows: [['1']] }))).toBe('| AP | Monate |\n| --- | --- |\n| 1 |  |');
  });

  it('gibt leeren String bei völlig leerer Tabelle', () => {
    expect(tabelleAlsMarkdown({ header: [], rows: [], start: 0, end: 0 })).toBe('');
  });
});
