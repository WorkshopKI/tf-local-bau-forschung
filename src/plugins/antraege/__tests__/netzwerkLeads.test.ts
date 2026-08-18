import { describe, it, expect } from 'vitest';
import {
  leiteNetzwerkNamenAb, ohneKlammern, type NetzwerkZeile,
} from '../services/netzwerk-leads';

function tv(akz: string, nw: string): NetzwerkZeile {
  return { aktenzeichen: akz, vbPhase: 3, netzwerkRoh: nw, akronym: '' };
}
function lead(akz: string, phase: number, akronym = ''): NetzwerkZeile {
  return { aktenzeichen: akz, vbPhase: phase, netzwerkRoh: '', akronym };
}

describe('leiteNetzwerkNamenAb', () => {
  it('gibt dem Netzwerkantrag den Namen, den seine Mitglieder nennen', () => {
    const namen = leiteNetzwerkNamenAb([
      lead('16KN083001', 1, 'mobiInspec'),
      tv('16KN083020', '"mobiInspec" 16KN083001_ED'),
      tv('16KN083021', '"mobiInspec" 16KN083001_ED'),
    ]);
    expect(namen.get('16KN083001')).toBe('mobiInspec');
  });

  it('gilt für BEIDE Phasen desselben Netzwerks', () => {
    const namen = leiteNetzwerkNamenAb([
      lead('16KN083001', 1), lead('16KN083002', 2),
      tv('16KN083020', '"mobiInspec" 16KN083001_ED'),
    ]);
    expect([...namen.keys()].sort()).toEqual(['16KN083001', '16KN083002']);
  });

  it('nimmt bei mehreren Schreibweisen die häufigste — der Tippfehler gewinnt nicht', () => {
    const namen = leiteNetzwerkNamenAb([
      lead('16KN083001', 1),
      ...Array.from({ length: 29 }, (_, i) => tv(`16KN0830${20 + i}`, '"mobiInspec" 16KN083001_ED')),
      tv('16KN083099', '"mobilnspec" 16KN083002_ED'),
    ]);
    expect(namen.get('16KN083001')).toBe('mobiInspec');
  });

  it('fällt auf das eigene Akronym zurück, wenn das Netzwerk keine Mitglieder hat', () => {
    const namen = leiteNetzwerkNamenAb([lead('16KN034001', 1, 'KoMet')]);
    expect(namen.get('16KN034001')).toBe('KoMet');
  });

  it('streift die Klammern des abgelehnten Versuchs ab', () => {
    const namen = leiteNetzwerkNamenAb([lead('16KN080301', 1, '(mobiInspec)')]);
    expect(namen.get('16KN080301')).toBe('mobiInspec');
  });

  it('rät nicht: ohne Mitglieder und ohne Akronym bleibt der Antrag namenlos', () => {
    expect(leiteNetzwerkNamenAb([lead('16KN086601', 1, '')]).size).toBe(0);
  });

  it('nimmt Teilvorhaben nicht auf — die tragen ihren Bezug selbst', () => {
    const namen = leiteNetzwerkNamenAb([tv('16KN083020', '"mobiInspec" 16KN083001_ED')]);
    expect(namen.size).toBe(0);
  });

  it('lässt Einzelanträge (16EP) unberührt', () => {
    expect(leiteNetzwerkNamenAb([
      { aktenzeichen: '16EP250059', vbPhase: 1, netzwerkRoh: '', akronym: 'JoA' },
    ]).size).toBe(0);
  });

  it('trennt Netzwerke, deren Nummern sich nur in der Stelle unterscheiden', () => {
    // 16KN0803xx und 16KN0830xx sind ZWEI Netzwerke, nicht eines.
    const namen = leiteNetzwerkNamenAb([
      lead('16KN080301', 1, '(Alt)'),
      lead('16KN083001', 1, 'Neu'),
      tv('16KN083020', '"Neu" 16KN083001_ED'),
    ]);
    expect(namen.get('16KN080301')).toBe('Alt');
    expect(namen.get('16KN083001')).toBe('Neu');
  });
});

describe('ohneKlammern', () => {
  it('nimmt nur UMSCHLIESSENDE Klammern weg', () => {
    expect(ohneKlammern('(mobiInspec)')).toBe('mobiInspec');
    expect(ohneKlammern('AutoPV (alt)')).toBe('AutoPV (alt)');
    expect(ohneKlammern('mobiInspec')).toBe('mobiInspec');
    expect(ohneKlammern('')).toBe('');
  });
});
