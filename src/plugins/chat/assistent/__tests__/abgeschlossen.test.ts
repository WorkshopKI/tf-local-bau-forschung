/**
 * Wann der Assistent einen Vorgang als abgeschlossen behandelt: ein Verbund erst,
 * wenn sein Status UND jedes Teilvorhaben es sind.
 */
import { describe, expect, it } from 'vitest';
import { vorgangAbgeschlossen } from '../abgeschlossen';

describe('vorgangAbgeschlossen', () => {
  it('ein Teilvorhaben im Widerspruch hält den abgelehnten Verbund offen', () => {
    expect(vorgangAbgeschlossen('abgelehnt/zurückgezogen', ['Widerspruch zur Ablehnung'])).toBe(false);
  });

  it('abgeschlossen, wenn Verbund und alle Teilvorhaben es sind', () => {
    expect(vorgangAbgeschlossen('abgelehnt/zurückgezogen', ['abgelehnt/zurückgezogen', 'Schlussvermerk'])).toBe(true);
  });

  it('ein offener Verbund-Status bleibt offen, auch wenn alle Teilvorhaben fertig sind', () => {
    expect(vorgangAbgeschlossen('techn geprüft', ['Schlussvermerk'])).toBe(false);
  });

  it('ohne Teilvorhaben entscheidet der eigene Status', () => {
    expect(vorgangAbgeschlossen('Schlussvermerk', [])).toBe(true);
    expect(vorgangAbgeschlossen(undefined, [])).toBe(false);
  });
});
