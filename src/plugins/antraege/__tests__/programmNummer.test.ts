/**
 * Die Invariante „alle Teilvorhaben eines Verbunds tragen dasselbe Programm".
 *
 * Geprüft wird der reine Kern (`programmNummernVon`) plus die Zusage, dass die
 * Verletzung MELDET statt zu heilen: die Anzeige bekommt weiter eine Nummer,
 * aber niemand darf glauben, sie sei eindeutig gewesen.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { programmNummer, programmNummernVon } from '../status/programmNummer';

const tv = (unterprogramm_id?: string): { unterprogramm_id?: string } =>
  (unterprogramm_id === undefined ? {} : { unterprogramm_id });

afterEach(() => { vi.restoreAllMocks(); });

describe('programmNummernVon', () => {
  it('sammelt jede Nummer genau einmal, in Fundreihenfolge', () => {
    expect(programmNummernVon([tv('137'), tv('137'), tv('76')])).toEqual(['137', '76']);
  });

  it('überspringt leere und nicht gesetzte Werte, ohne sie zu zählen', () => {
    expect(programmNummernVon([tv(), tv('  '), tv(' 76 ')])).toEqual(['76']);
  });

  it('liefert eine leere Liste, wenn kein TV eine Nummer führt', () => {
    expect(programmNummernVon([tv(), tv()])).toEqual([]);
  });
});

describe('programmNummer', () => {
  it('gibt die eine Nummer zurück und meldet nichts', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(programmNummer([tv('137'), tv('137')], 'VB1')).toBe('137');
    expect(spy).not.toHaveBeenCalled();
  });

  it('meldet die Verletzung, liefert aber weiter die erste Nummer', () => {
    // Geheilt wird NICHT: die Oberfläche soll nicht kippen, aber die Meldung
    // nennt Verbund und Nummern, damit der Datenfehler auffindbar ist.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(programmNummer([tv('137'), tv('76')], 'VB1')).toBe('137');
    expect(spy).toHaveBeenCalledTimes(1);
    const meldung = String(spy.mock.calls[0]?.[0] ?? '');
    expect(meldung).toContain('VB1');
    expect(meldung).toContain('137');
    expect(meldung).toContain('76');
  });

  it('bleibt bei „unbekannt", wenn keine Nummer da ist', () => {
    expect(programmNummer([tv()], 'VB1')).toBeNull();
  });
});
