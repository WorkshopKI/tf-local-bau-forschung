import { describe, it, expect } from 'vitest';
import { leeresManifest, setDateiStatus, istLoeschbar, zusammenfassung } from '../manifest';

describe('manifest', () => {
  it('löschbar erst bei Vollständigkeit', () => {
    let m = leeresManifest('paket', ['a.pdf', 'b.pdf']);
    expect(istLoeschbar(m)).toBe(false);
    m = setDateiStatus(m, 'a.pdf', 'konvertiert');
    expect(istLoeschbar(m)).toBe(false);
    m = setDateiStatus(m, 'b.pdf', 'konvertiert');
    expect(istLoeschbar(m)).toBe(true);
  });

  it('übersprungene zählen als „fertig" für Löschbarkeit', () => {
    let m = leeresManifest('p', ['a.pdf', 'b.doc']);
    m = setDateiStatus(m, 'a.pdf', 'konvertiert');
    m = setDateiStatus(m, 'b.doc', 'uebersprungen');
    expect(istLoeschbar(m)).toBe(true);
  });

  it('fehlgeschlagene blocken Löschbarkeit NICHT (manuell entscheidbar)', () => {
    let m = leeresManifest('p', ['a.pdf']);
    m = setDateiStatus(m, 'a.pdf', 'fehlgeschlagen');
    expect(istLoeschbar(m)).toBe(true);
  });

  it('offen (noch nicht verarbeitet) blockt', () => {
    const m = leeresManifest('p', ['a.pdf', 'b.pdf']);
    expect(zusammenfassung(m)).toEqual({ gesamt: 2, konvertiert: 0, fehlgeschlagen: 0, uebersprungen: 0, offen: 2 });
  });
});
