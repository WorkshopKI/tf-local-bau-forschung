/**
 * Die Diff-Vorschau der Referenz-Importe. Der wichtigste Fall ist `entfallen`:
 * Einträge, die die neue Datei nicht mehr führt, sind der Fingerabdruck einer
 * unvollständigen oder falschen Zuarbeit — sie müssen VOR der Übernahme
 * sichtbar sein, nicht danach.
 */
import { describe, it, expect } from 'vitest';
import { berechneDiff, diffZusammenfassung } from '@/core/status/import/diff';

interface Zeile { code: number; text: string; extra?: string }

const schluessel = (z: Zeile): string => String(z.code);
const felder = (z: Zeile): Record<string, unknown> => ({ text: z.text });

describe('berechneDiff', () => {
  const vorher: Zeile[] = [
    { code: 31, text: 'beantragt' },
    { code: 35, text: 'NF gestellt' },
    { code: 99, text: 'Schlussvermerk' },
  ];

  it('erkennt neu, geändert und entfallen getrennt', () => {
    const nachher: Zeile[] = [
      { code: 31, text: 'beantragt' },
      { code: 35, text: 'Nachforderung gestellt' },
      { code: 11, text: 'Skizze eingegangen' },
    ];
    const d = berechneDiff(vorher, nachher, schluessel, felder);
    expect(d.neu.map(e => e.schluessel)).toEqual(['11']);
    expect(d.geaendert.map(e => e.schluessel)).toEqual(['35']);
    expect(d.entfallen.map(e => e.schluessel)).toEqual(['99']);
    expect(d.unveraendert).toBe(1);
    expect(d.leer).toBe(false);
  });

  it('nennt bei „geändert" die abweichenden Felder', () => {
    const d = berechneDiff(vorher, [{ code: 35, text: 'anders' }], schluessel, felder);
    expect(d.geaendert[0]?.felder).toEqual(['text']);
    expect(d.geaendert[0]?.vorher?.text).toBe('NF gestellt');
    expect(d.geaendert[0]?.nachher?.text).toBe('anders');
  });

  it('ignoriert Eigenschaften, die `felderVon` nicht nennt (keine Scheinänderung)', () => {
    const nachher: Zeile[] = vorher.map(z => ({ ...z, extra: 'egal' }));
    expect(berechneDiff(vorher, nachher, schluessel, felder).leer).toBe(true);
  });

  it('ist unabhängig von der Reihenfolge', () => {
    const gedreht = [...vorher].reverse();
    expect(berechneDiff(vorher, gedreht, schluessel, felder).leer).toBe(true);
  });

  it('meldet eine leere Datei als „alles entfallen", nicht als „keine Änderung"', () => {
    const d = berechneDiff(vorher, [], schluessel, felder);
    expect(d.entfallen).toHaveLength(3);
    expect(d.leer).toBe(false);
  });

  it('behandelt einen leeren Bestand als „alles neu"', () => {
    const d = berechneDiff([], vorher, schluessel, felder);
    expect(d.neu).toHaveLength(3);
    expect(d.entfallen).toHaveLength(0);
  });
});

describe('diffZusammenfassung', () => {
  it('sagt ausdrücklich, wenn nichts zu tun ist', () => {
    const d = berechneDiff([{ code: 1, text: 'a' }], [{ code: 1, text: 'a' }], schluessel, felder);
    expect(diffZusammenfassung(d)).toBe('Keine Änderungen — die Datei entspricht dem aktuellen Stand.');
  });

  it('nennt nur die Kategorien, die vorkommen', () => {
    const d = berechneDiff([], [{ code: 1, text: 'a' }], schluessel, felder);
    expect(diffZusammenfassung(d)).toBe('1 neu (0 unverändert)');
  });
});
