import { describe, it, expect } from 'vitest';
import { darstellungsZusammenfassung, schalterAn } from '@/components/ui/darstellungsAchsen';
import { GRUPPIER_ACHSEN } from '../gruppierung';
import { DICHTE_OPTIONEN } from '../ticket/dichte';
import {
  baueBoardAchsen,
  dichteAusSchluessel,
  gruppierungAusSchluessel,
  type BoardDarstellung,
} from '../darstellungsAchsen';

const STANDARD: BoardDarstellung = {
  gruppierung: 'keine',
  dichte: 'dicht',
  zeigeArchiv: false,
  darfVerwalten: true,
};

describe('baueBoardAchsen', () => {
  it('liefert Gruppierung und Dichte immer, Archiv nur mit Schreibrecht', () => {
    expect(baueBoardAchsen(STANDARD).map(a => a.id)).toEqual(['gruppierung', 'dichte', 'archiv']);
    expect(baueBoardAchsen({ ...STANDARD, darfVerwalten: false }).map(a => a.id))
      .toEqual(['gruppierung', 'dichte']);
  });

  it('zieht die Gruppier-Optionen aus GRUPPIER_ACHSEN statt sie aufzuzählen', () => {
    const achse = baueBoardAchsen(STANDARD)[0];
    // Identität, nicht Gleichheit: eine Kopie würde beim nächsten neuen Wert
    // stillschweigend zurückbleiben.
    expect(achse?.options).toBe(GRUPPIER_ACHSEN);
  });

  it('übernimmt die Dichte-Beschriftungen unverändert', () => {
    const achse = baueBoardAchsen(STANDARD)[1];
    expect(achse?.options.map(o => o.label)).toEqual(DICHTE_OPTIONEN.map(o => o.label));
  });

  it('macht aus „Archivierte" einen Schalter, der in die richtige Richtung zeigt', () => {
    const aus = baueBoardAchsen(STANDARD).find(a => a.id === 'archiv')!;
    expect(aus.art).toBe('schalter');
    expect(schalterAn(aus)).toBe(false);
    const ein = baueBoardAchsen({ ...STANDARD, zeigeArchiv: true }).find(a => a.id === 'archiv')!;
    expect(schalterAn(ein)).toBe(true);
  });
});

describe('Zusammenfassung am Knopf', () => {
  it('ist im Startzustand leer — der Knopf trägt dann nur seinen Namen', () => {
    expect(darstellungsZusammenfassung(baueBoardAchsen(STANDARD)))
      .toEqual({ text: '', weitere: 0 });
  });

  it('schreibt die erste Abweichung aus und zählt die übrigen', () => {
    const achsen = baueBoardAchsen({
      ...STANDARD, gruppierung: 'bereich', dichte: 'ultra', zeigeArchiv: true,
    });
    expect(darstellungsZusammenfassung(achsen)).toEqual({ text: 'Bereich', weitere: 2 });
  });

  it('nennt den Archiv-Schalter bei seinem Achsen-Label, nicht bei seinem Wert', () => {
    // „Darstellung: eingeblendet" sagt nichts darüber, WAS eingeblendet ist.
    const achsen = baueBoardAchsen({ ...STANDARD, zeigeArchiv: true });
    expect(darstellungsZusammenfassung(achsen)).toEqual({
      text: 'Archivierte zeigen', weitere: 0,
    });
  });

  it('meldet die komfortable Dichte als Abweichung — sie ist NICHT der Startwert', () => {
    // Der Startwert ist 'dicht' (useBoardAnsicht). Nähme man DICHTE_OPTIONEN[0]
    // als Standard, stünde dauerhaft „Kompakt" am Knopf, ohne dass jemand etwas
    // verstellt hat.
    const achsen = baueBoardAchsen({ ...STANDARD, dichte: '' });
    expect(darstellungsZusammenfassung(achsen)).toEqual({ text: 'Komfortabel', weitere: 0 });
  });
});

describe('Menü-Schlüssel ↔ Wert', () => {
  it('bildet die komfortable Dichte auf einen nicht-leeren Schlüssel ab und zurück', () => {
    const dichte = baueBoardAchsen({ ...STANDARD, dichte: '' })[1];
    expect(dichte?.value).toBe('komfort');
    expect(dichte?.options.some(o => o.key === '')).toBe(false);
    expect(dichteAusSchluessel('komfort')).toBe('');
  });

  it('reicht die übrigen Dichte-Schlüssel durch', () => {
    expect(dichteAusSchluessel('dicht')).toBe('dicht');
    expect(dichteAusSchluessel('ultra')).toBe('ultra');
  });

  it('fällt bei unbekannten Schlüsseln auf den Startzustand zurück', () => {
    expect(dichteAusSchluessel('quatsch')).toBe('');
    expect(gruppierungAusSchluessel('quatsch')).toBe('keine');
  });

  it('reicht die Gruppier-Schlüssel durch', () => {
    for (const g of GRUPPIER_ACHSEN) {
      expect(gruppierungAusSchluessel(g.key)).toBe(g.key);
    }
  });
});
