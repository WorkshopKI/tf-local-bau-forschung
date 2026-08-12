import { describe, it, expect } from 'vitest';
import { baueWortChips, wirksameAnfrage, markierWoerter } from '../deutung';

describe('baueWortChips', () => {
  it('zerlegt an Leerraum und behält die Schreibweise des Nutzers', () => {
    expect(baueWortChips('Laser Schweißen', 'und', [])).toEqual([
      { wort: 'Laser', aktiv: true },
      { wort: 'Schweißen', aktiv: true },
    ]);
  });

  it('markiert abgewählte Wörter, entfernt sie aber nicht aus der Zeile', () => {
    const chips = baueWortChips('Laser Schweißen', 'und', ['schweissen', 'laser']);
    expect(chips.map(c => c.aktiv)).toEqual([false, true]);
    expect(chips).toHaveLength(2);
  });

  it('vergleicht ohne Rücksicht auf Groß-/Kleinschreibung', () => {
    expect(baueWortChips('Laser', 'und', ['LASER'])[0]?.aktiv).toBe(false);
  });

  it('entdoppelt — zwei gleiche Chips wären zwei Schalter für dieselbe Sache', () => {
    expect(baueWortChips('laser Laser', 'und', [])).toHaveLength(1);
  });

  it('bei genauer Wortfolge gibt es GENAU einen Chip', () => {
    expect(baueWortChips('additive Fertigung', 'wortfolge', []))
      .toEqual([{ wort: 'additive Fertigung', aktiv: true }]);
  });

  it('leere Anfrage ergibt keine Chips', () => {
    expect(baueWortChips('', 'und', [])).toEqual([]);
    expect(baueWortChips('   ', 'und', [])).toEqual([]);
  });
});

describe('wirksameAnfrage', () => {
  it('lässt die Anfrage unangetastet, solange nichts abgewählt ist', () => {
    expect(wirksameAnfrage('Laser Schweißen', 'und', [])).toBe('Laser Schweißen');
  });

  it('nimmt das abgewählte Wort heraus', () => {
    expect(wirksameAnfrage('Laser Schweißen', 'und', ['schweißen'])).toBe('Laser');
  });

  it('gibt die volle Anfrage zurück, wenn ALLES abgewählt ist', () => {
    // Sonst landete der Nutzer im Startzustand — ohne seine Chips und ohne Rückweg.
    expect(wirksameAnfrage('Laser Schweißen', 'und', ['laser', 'schweißen']))
      .toBe('Laser Schweißen');
  });

  it('nimmt bei Wortfolge nichts heraus, solange der eine Chip aktiv ist', () => {
    expect(wirksameAnfrage('additive Fertigung', 'wortfolge', [])).toBe('additive Fertigung');
  });
});

describe('markierWoerter', () => {
  it('liefert nur die aktiven Wörter — was nicht gesucht wird, wird nicht markiert', () => {
    expect(markierWoerter('Laser Schweißen', 'und', ['laser'])).toEqual(['Schweißen']);
  });

  it('bei Wortfolge die ganze Wendung', () => {
    expect(markierWoerter('additive Fertigung', 'wortfolge', [])).toEqual(['additive Fertigung']);
  });
});
