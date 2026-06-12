import { describe, it, expect } from 'vitest';
import { berechneMengen, type MengenKandidat } from '../mengen';

const k = (aktenzeichen: string, hatVb: boolean): MengenKandidat => ({ aktenzeichen, fkz: aktenzeichen, titel: aktenzeichen, hatVb });

describe('berechneMengen', () => {
  it('teilt in bereit / ohne_vb / bereits_stand (nur_a)', () => {
    const r = berechneMengen(
      [k('V1', true), k('V2', false), k('V3', true)],
      'nur_a',
      { V3: { A: 'freigegeben' } },
    );
    expect(r.bereit.map(e => e.aktenzeichen)).toEqual(['V1']);
    expect(r.ohneVb.map(e => e.aktenzeichen)).toEqual(['V2']);
    expect(r.bereitsStand.map(e => e.aktenzeichen)).toEqual(['V3']);
  });

  it('a_bis_g: bereits_stand nur wenn ALLE gewünschten Schritte vorhanden', () => {
    const r = berechneMengen([k('V1', true)], 'a_bis_g', { V1: { A: 'entwurf' } }); // B–G fehlen
    expect(r.bereit.map(e => e.aktenzeichen)).toEqual(['V1']);
    expect(r.bereitsStand).toEqual([]);
  });

  it('a_bis_g: alle A–G vorhanden → bereits_stand', () => {
    const voll = { A: 'freigegeben', B: 'entwurf', C: 'entwurf', D: 'entwurf', E: 'entwurf', F: 'entwurf', G: 'entwurf' };
    const r = berechneMengen([k('V1', true)], 'a_bis_g', { V1: voll });
    expect(r.bereitsStand.map(e => e.aktenzeichen)).toEqual(['V1']);
  });

  it('Entwurf ODER Freigabe zählt als vorhanden', () => {
    const r = berechneMengen([k('V1', true)], 'nur_a', { V1: { A: 'entwurf' } });
    expect(r.bereitsStand.map(e => e.aktenzeichen)).toEqual(['V1']);
  });
});
