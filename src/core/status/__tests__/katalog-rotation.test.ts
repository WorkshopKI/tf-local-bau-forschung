/**
 * Was diese Datei festnagelt:
 *
 * 1. **Nichts geht verloren.** Haupt- und Archivdatei zusammen sind lückenlos —
 *    keine Fassung doppelt, keine fehlend. Das ist die Invariante, an der die
 *    ganze Rotation hängt: die Versionierung existiert, damit man zurückkann.
 * 2. **Die aktive Fassung bleibt in der Hauptdatei**, auch wenn sie alt ist.
 *    Sie ist die, die jeder Client beim Start braucht.
 * 3. **Unterhalb der Schwelle passiert nichts** — kein Archiv, keine Bewegung.
 * 4. **Die Hauptdatei wird nie leer**: `istKatalogDatei` verlangt mindestens
 *    eine Fassung, eine leere Datei wäre für jeden Leser ungültig.
 */
import { describe, it, expect } from 'vitest';
import {
  planeRotation, vereinigeArchiv, istKatalogArchiv, FASSUNGEN_IN_HAUPTDATEI,
} from '@/core/status/katalog-rotation';
import type { MappingVersion } from '@/core/status/typen';

const v = (nr: number, autor = 'MUE'): MappingVersion => ({
  version: nr, autor, zeitstempel: `2026-08-0${(nr % 9) + 1}T10:00:00.000Z`,
  felder: [], werte: [],
});

/** n Fassungen, aufsteigend nummeriert ab 1. */
const liste = (n: number): MappingVersion[] => Array.from({ length: n }, (_, i) => v(i + 1));

describe('planeRotation — die Aufteilung', () => {
  it('unterhalb der Schwelle passiert nichts', () => {
    const f = liste(FASSUNGEN_IN_HAUPTDATEI);
    expect(planeRotation(f, 1)).toEqual({ behalten: f, auslagern: [] });
    expect(planeRotation(liste(3), 1).auslagern).toEqual([]);
  });

  it('oberhalb bleiben genau n, der Rest wandert', () => {
    const p = planeRotation(liste(12), 12);
    expect(p.behalten).toHaveLength(FASSUNGEN_IN_HAUPTDATEI);
    expect(p.auslagern).toHaveLength(12 - FASSUNGEN_IN_HAUPTDATEI);
    expect(p.behalten.map(x => x.version)).toEqual([5, 6, 7, 8, 9, 10, 11, 12]);
    expect(p.auslagern.map(x => x.version)).toEqual([1, 2, 3, 4]);
  });

  it('schält von UNTEN ab — die ältesten zuerst', () => {
    // Wichtig fuer `naechsteVersionsnummer`: die rechnet aus dem lokalen
    // Maximum. Würde oben abgeschält, entstünden doppelte Nummern.
    const p = planeRotation(liste(10), 10, 3);
    expect(p.auslagern.map(x => x.version)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(p.behalten.map(x => x.version)).toEqual([8, 9, 10]);
  });

  it('kommt mit unsortierter Eingabe klar', () => {
    const p = planeRotation([v(3), v(1), v(5), v(2), v(4)], 5, 2);
    expect(p.behalten.map(x => x.version)).toEqual([4, 5]);
    expect(p.auslagern.map(x => x.version)).toEqual([1, 2, 3]);
  });
});

describe('planeRotation — die aktive Fassung bleibt erreichbar', () => {
  it('holt eine alte aktive Fassung in die Hauptdatei zurück', () => {
    // Der reale Fall: jemand reaktiviert v2 und veröffentlicht sie. Sie ins
    // Archiv zu schieben hiesse, dass jeder Client beim Start die Archivdatei
    // lesen muss — also genau das, was die Rotation vermeiden soll.
    const p = planeRotation(liste(10), 2, 3);
    expect(p.behalten.map(x => x.version)).toContain(2);
    expect(p.auslagern.map(x => x.version)).not.toContain(2);
  });

  it('hält die Anzahl konstant — die verdrängte wandert ins Archiv', () => {
    const p = planeRotation(liste(10), 2, 3);
    expect(p.behalten).toHaveLength(3);
    expect(p.auslagern).toHaveLength(7);
    // v8 war die älteste der behaltenen und macht Platz.
    expect(p.behalten.map(x => x.version)).toEqual([2, 9, 10]);
    expect(p.auslagern.map(x => x.version)).toContain(8);
  });

  it('ohne aktive Nummer bleibt es beim einfachen Schnitt', () => {
    expect(planeRotation(liste(10), null, 3).behalten.map(x => x.version)).toEqual([8, 9, 10]);
  });

  it('eine aktive Fassung, die ohnehin bleibt, ändert nichts', () => {
    expect(planeRotation(liste(10), 10, 3).behalten.map(x => x.version)).toEqual([8, 9, 10]);
  });
});

describe('planeRotation — nichts geht verloren', () => {
  it('Haupt- und Archivteil zusammen sind die Eingabe, ohne Doppelte', () => {
    for (const [n, aktiv, grenze] of [[12, 12, 8], [10, 2, 3], [30, 15, 8], [2, 1, 8]] as const) {
      const p = planeRotation(liste(n), aktiv, grenze);
      const alle = [...p.behalten, ...p.auslagern].map(x => x.version).sort((a, b) => a - b);
      expect(alle, `n=${n} aktiv=${aktiv}`).toEqual(liste(n).map(x => x.version));
      expect(new Set(alle).size, `n=${n}: keine Doppelten`).toBe(n);
    }
  });

  it('die Hauptdatei wird nie leer', () => {
    // `istKatalogDatei` verlangt mindestens eine Fassung — eine leere Hauptdatei
    // wäre für jeden Leser eine kaputte Datei.
    expect(planeRotation(liste(5), 1, 0).behalten.length).toBeGreaterThanOrEqual(1);
    expect(planeRotation(liste(5), 1, -3).behalten.length).toBeGreaterThanOrEqual(1);
    expect(planeRotation([v(1)], 1, 8).behalten).toHaveLength(1);
  });

  it('leere Eingabe liefert leere Teile, keine Ausnahme', () => {
    expect(planeRotation([], null)).toEqual({ behalten: [], auslagern: [] });
  });

  it('zwei Läufe über dieselbe Eingabe liefern dasselbe', () => {
    const f = liste(12);
    expect(planeRotation(f, 12)).toEqual(planeRotation(f, 12));
  });
});

describe('vereinigeArchiv', () => {
  it('hängt Neues an und sortiert aufsteigend', () => {
    expect(vereinigeArchiv([v(1), v(2)], [v(3), v(4)]).map(x => x.version))
      .toEqual([1, 2, 3, 4]);
  });

  it('die VORHANDENE Fassung gewinnt bei gleicher Nummer', () => {
    // Sie liegt seit ihrer Auslagerung unverändert im Archiv; die lokale Kopie
    // könnte von einem Rechner stammen, der sie nie hätte ändern dürfen.
    const zusammen = vereinigeArchiv([v(2, 'ARCHIV')], [v(2, 'LOKAL')]);
    expect(zusammen).toHaveLength(1);
    expect(zusammen[0]?.autor).toBe('ARCHIV');
  });

  it('leeres Archiv nimmt einfach das Neue auf', () => {
    expect(vereinigeArchiv([], [v(1)]).map(x => x.version)).toEqual([1]);
    expect(vereinigeArchiv([v(1)], []).map(x => x.version)).toEqual([1]);
  });

  it('zwei Läufe liefern dieselbe Datei — sie wird verglichen', () => {
    const a = [v(3), v(1)];
    const b = [v(2)];
    expect(vereinigeArchiv(a, b)).toEqual(vereinigeArchiv(a, b));
  });
});

describe('istKatalogArchiv', () => {
  it('akzeptiert ein LEERES Archiv — noch nie rotiert ist ein gültiger Zustand', () => {
    // Anders als die Hauptdatei: dort wäre eine leere Liste bedeutungslos.
    expect(istKatalogArchiv({ version: 1, fassungen: [], updatedAt: 'x' })).toBe(true);
  });

  it('akzeptiert ein gefülltes Archiv', () => {
    expect(istKatalogArchiv({ version: 1, fassungen: [v(1)], updatedAt: 'x' })).toBe(true);
  });

  it('lehnt fremde Formate ab', () => {
    expect(istKatalogArchiv(null)).toBe(false);
    expect(istKatalogArchiv({ version: 2, fassungen: [] })).toBe(false);
    expect(istKatalogArchiv({ version: 1 })).toBe(false);
    expect(istKatalogArchiv({ version: 1, fassungen: [{ version: 'eins' }] })).toBe(false);
    expect(istKatalogArchiv({ version: 1, fassungen: [{ version: 1, felder: [] }] })).toBe(false);
  });

  it('verlangt KEINEN aktiv-Zeiger — das Archiv sagt nicht, was gilt', () => {
    expect(istKatalogArchiv({ version: 1, fassungen: [v(1)], updatedAt: 'x' })).toBe(true);
  });
});
