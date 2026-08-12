import { describe, it, expect } from 'vitest';
import {
  merkeSuche, entferneSuche, vermerkeLauf, veraenderungText,
  MAX_GESPEICHERT, type GespeicherteSuche,
} from '../gespeicherteSuchen';

function eintrag(p: Partial<GespeicherteSuche> = {}): GespeicherteSuche {
  return {
    id: p.id ?? 'normen', name: p.name ?? 'Normen', query: p.query ?? 'Normen',
    verknuepfung: 'und', stammSuche: false, bereich: 'alles',
    letzteTrefferzahl: p.letzteTrefferzahl ?? null, zuletzt: p.zuletzt ?? null,
    ...p,
  };
}

describe('merkeSuche', () => {
  it('legt neu an, neueste zuerst', () => {
    const liste = merkeSuche([eintrag({ id: 'a' })], eintrag({ id: 'b' }));
    expect(liste.map(e => e.id)).toEqual(['b', 'a']);
  });

  it('ersetzt statt zu doppeln', () => {
    const liste = merkeSuche([eintrag({ id: 'a', name: 'alt' })], eintrag({ id: 'a', name: 'neu' }));
    expect(liste).toHaveLength(1);
    expect(liste[0]?.name).toBe('neu');
  });

  it('hält die Obergrenze ein', () => {
    let liste: GespeicherteSuche[] = [];
    for (let i = 0; i < MAX_GESPEICHERT + 5; i++) liste = merkeSuche(liste, eintrag({ id: `x${i}` }));
    expect(liste).toHaveLength(MAX_GESPEICHERT);
  });
});

describe('entferneSuche', () => {
  it('nimmt genau einen heraus', () => {
    const liste = entferneSuche([eintrag({ id: 'a' }), eintrag({ id: 'b' })], 'a');
    expect(liste.map(e => e.id)).toEqual(['b']);
  });

  it('unbekannte Id ändert nichts', () => {
    expect(entferneSuche([eintrag({ id: 'a' })], 'zzz')).toHaveLength(1);
  });
});

describe('vermerkeLauf', () => {
  it('schreibt Trefferzahl und Zeitpunkt an den richtigen Eintrag', () => {
    const liste = vermerkeLauf([eintrag({ id: 'a' }), eintrag({ id: 'b' })], 'b', 12, '2026-08-12');
    expect(liste[1]?.letzteTrefferzahl).toBe(12);
    expect(liste[1]?.zuletzt).toBe('2026-08-12');
    expect(liste[0]?.letzteTrefferzahl).toBeNull();
  });
});

describe('veraenderungText', () => {
  it('nennt den Zuwachs SEIT DEM LETZTEN LAUF — nicht „neue Anträge"', () => {
    expect(veraenderungText(eintrag({ letzteTrefferzahl: 4 }), 6)).toBe('+2 seit zuletzt');
  });

  it('nennt auch den Rückgang', () => {
    expect(veraenderungText(eintrag({ letzteTrefferzahl: 6 }), 4)).toBe('-2 seit zuletzt');
  });

  it('schweigt bei Gleichstand — eine Zeile, die immer dasselbe sagt, liest niemand', () => {
    expect(veraenderungText(eintrag({ letzteTrefferzahl: 6 }), 6)).toBeNull();
  });

  it('schweigt, solange es nichts zu vergleichen gibt', () => {
    expect(veraenderungText(eintrag({ letzteTrefferzahl: null }), 6)).toBeNull();
    expect(veraenderungText(eintrag({ letzteTrefferzahl: 6 }), null)).toBeNull();
  });
});
