import { describe, it, expect } from 'vitest';
import { kontextZustand } from '../kontext-zustand';

describe('kontextZustand', () => {
  it('aufgelöster Antrag → bereit', () => {
    expect(kontextZustand({ ctxVorhanden: true, laedt: false })).toBe('bereit');
  });

  it('laufende Auflösung schlägt „nicht auflösbar" — sonst flackert beim Öffnen „nicht gefunden"', () => {
    expect(kontextZustand({ ctxVorhanden: false, laedt: true })).toBe('laedt');
  });

  it('bereits aufgelöst + erneuter Lauf (nachrückender Datenstand) bleibt bereit', () => {
    expect(kontextZustand({ ctxVorhanden: true, laedt: true })).toBe('bereit');
  });

  it('Auflösung durch, kein Kontext → nicht auflösbar (Seite darf keine toten Knöpfe zeigen)', () => {
    expect(kontextZustand({ ctxVorhanden: false, laedt: false })).toBe('nicht-aufloesbar');
  });
});
