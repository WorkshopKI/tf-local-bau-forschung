import { describe, it, expect } from 'vitest';
import { zaehlwort } from '../zaehlwort';

describe('zaehlwort', () => {
  it('wählt Singular nur bei genau 1', () => {
    expect(zaehlwort(0, 'Wert', 'Werte')).toBe('0 Werte');
    expect(zaehlwort(1, 'Wert', 'Werte')).toBe('1 Wert');
    expect(zaehlwort(2, 'Wert', 'Werte')).toBe('2 Werte');
  });

  it('gruppiert die Zahl deutsch', () => {
    expect(zaehlwort(14221, 'Vorgang', 'Vorgänge')).toBe('14.221 Vorgänge');
  });

  it('dekliniert NICHT — der Aufrufer übergibt den Kasus seines Satzes', () => {
    // Das ist die dokumentierte Grenze der Hilfe: „von 1 Programm" / „von 3
    // Programmen" entsteht nur, weil der Aufrufer den Dativ übergibt.
    expect(`von ${zaehlwort(1, 'Programm', 'Programmen')}`).toBe('von 1 Programm');
    expect(`von ${zaehlwort(3, 'Programm', 'Programmen')}`).toBe('von 3 Programmen');
  });
});
