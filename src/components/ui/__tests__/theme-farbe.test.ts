/**
 * Eine Primärfarbe sind DREI Werte.
 *
 * Bis v4.116 speicherte das Profil nur den Farbton; beim Start setzte
 * `applyThemeColor(hue)` Standard-Sättigung und -Helligkeit ein. Sechs der
 * sieben Vorgaben kamen dadurch in einer anderen Farbe zurück, als das
 * markierte Feld behauptete — „Graphit" (220 · 8 % · 38 %) als
 * `hsl(220, 25%, 42%)`.
 */
import { describe, it, expect } from 'vitest';
import { PRESET_COLORS, farbeAusProfil, istGewaehlteFarbe } from '../theme';

const GRAPHIT = PRESET_COLORS.find(c => c.name === 'Graphit')!;
const SCHIEFER = PRESET_COLORS[0]!;

describe('farbeAusProfil', () => {
  it('nimmt die gespeicherten drei Werte', () => {
    expect(farbeAusProfil({ hue: 220, sat: '8%', lit: '38%' })).toMatchObject({ h: 220, s: '8%', l: '38%' });
  });

  it('heilt ein Bestands-Profil ohne sat/lit über den Farbton', () => {
    // Genau der Fall, der den Bug sichtbar machte: alte Profile führen nur `hue`.
    expect(farbeAusProfil({ hue: GRAPHIT.h })).toMatchObject({ h: GRAPHIT.h, s: GRAPHIT.s, l: GRAPHIT.l });
  });

  it('fällt bei unbekanntem Farbton auf die Standard-Sättigung zurück', () => {
    expect(farbeAusProfil({ hue: 7 })).toMatchObject({ h: 7, s: SCHIEFER.s, l: SCHIEFER.l });
  });

  it('ohne Profil die erste Vorgabe', () => {
    expect(farbeAusProfil(undefined)).toMatchObject({ h: SCHIEFER.h, s: SCHIEFER.s, l: SCHIEFER.l });
    expect(farbeAusProfil({})).toMatchObject({ h: SCHIEFER.h });
  });

  it('ignoriert einen halben Stand (nur sat, kein lit)', () => {
    expect(farbeAusProfil({ hue: GRAPHIT.h, sat: '50%' })).toMatchObject({ s: GRAPHIT.s, l: GRAPHIT.l });
  });
});

describe('istGewaehlteFarbe', () => {
  it('vergleicht alle drei Werte, nicht nur den Farbton', () => {
    expect(istGewaehlteFarbe(GRAPHIT, farbeAusProfil({ hue: GRAPHIT.h }))).toBe(true);
    // Derselbe Farbton, andere Sättigung: kein Häkchen.
    expect(istGewaehlteFarbe(GRAPHIT, { name: '', h: GRAPHIT.h, s: '25%', l: '42%' })).toBe(false);
  });

  it('markiert genau eine Vorgabe je gespeichertem Stand', () => {
    for (const c of PRESET_COLORS) {
      const aktuell = farbeAusProfil({ hue: c.h, sat: c.s, lit: c.l });
      expect(PRESET_COLORS.filter(v => istGewaehlteFarbe(v, aktuell))).toHaveLength(1);
    }
  });
});
