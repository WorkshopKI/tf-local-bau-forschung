/**
 * Der trennzeichen-blinde Namensvergleich.
 *
 * Die Fälle stammen aus dem Bestand (v4.123, [suche-relevanz.md §12](docs/architecture/suche-relevanz.md)):
 * `nafa-tech` ↔ `nafa tech`, `f.i.t` ↔ `f.i.t.`, `sws energie` ↔ `swsenergie`.
 *
 * Der wichtigste Test ist der NEGATIVE: `bona` darf „lab on a chip" nicht
 * finden. Ohne die Wortanfang-Regel fände es das, denn der Kern `labonachip`
 * hat keine Wortgrenzen mehr — und genau daran hängt, ob die Faltung eine
 * Schreibweise zusammenführt oder nur Buchstaben zusammenklebt.
 */
import { describe, it, expect } from 'vitest';
import { baueNadelMuster } from '../wortstamm';
import {
  KERN_FELDER, namensKern, nadelKern, trifftNamensKern, kernFundstellen,
} from '../namensKern';

/** Wie im Korpus: der rohe (kleine) Wert und seine Faltung nebeneinander. */
function trifft(roh: string, nadel: string): boolean {
  return trifftNamensKern(roh, namensKern(roh), namensKern(nadel));
}

describe('namensKern — die Faltung', () => {
  it('entfernt Bindestrich, Leerzeichen, Punkt und Klammer', () => {
    expect(namensKern('nafa-tech')).toBe('nafatech');
    expect(namensKern('sws energie')).toBe('swsenergie');
    expect(namensKern('f.i.t.')).toBe('fit');
    expect(namensKern('(3d-sprüh)')).toBe('3dsprüh');
  });

  it('behält Ziffern und Umlaute — sie sind Wortzeichen', () => {
    expect(namensKern('biomasse 2.0')).toBe('biomasse20');
    expect(namensKern('grün-öl')).toBe('grünöl');
  });

  it('lässt einen Wert ohne Fuge unverändert', () => {
    expect(namensKern('kipro')).toBe('kipro');
  });
});

describe('nadelKern — welche Nadel einen Kern bekommt', () => {
  it('faltet die gewöhnliche Nadel', () => {
    expect(nadelKern('nafa-tech', null)).toBe('nafatech');
  });

  it('gibt einer Nadel mit Platzhalter KEINEN Kern', () => {
    // Der Stern ist kein Wortzeichen — die Faltung würde ihn wegwerfen und aus
    // `mob*spec` stillschweigend `mobspec` machen.
    const muster = baueNadelMuster('mob*spec');
    expect(muster).not.toBeNull();
    expect(nadelKern('mob*spec', muster)).toBe('');
  });

  it('gibt unter drei Zeichen keinen Kern', () => {
    expect(nadelKern('f.i', null)).toBe('');
    expect(nadelKern('f.i.t', null)).toBe('fit');
  });
});

describe('trifftNamensKern — über die Fuge, aber am Wortanfang', () => {
  it('findet dieselbe Sache, anders getrennt', () => {
    expect(trifft('nafa tech', 'nafa-tech')).toBe(true);
    expect(trifft('nafa-tech', 'nafatech')).toBe(true);
    expect(trifft('sws energie', 'swsenergie')).toBe(true);
    expect(trifft('f.i.t.', 'f.i.t')).toBe(true);
    expect(trifft('mikro algen', 'mikroalgen')).toBe(true);
  });

  it('findet auch, wenn nur die NADEL eine Fuge trägt', () => {
    expect(trifft('h2apply', 'h2-apply')).toBe(true);
  });

  it('beginnt nur an einem Wortanfang — sonst klebte es Buchstaben zusammen', () => {
    // `labonachip` enthält `bona`, aber „bona" fängt mitten in „lab" an.
    expect(trifft('lab on a chip', 'bona')).toBe(false);
    // Die Gegenprobe: an einem Wortanfang läuft dieselbe Nadel durch.
    expect(trifft('lab on a chip', 'labon')).toBe(true);
  });

  it('trifft nicht, wo nichts zu treffen ist', () => {
    expect(trifft('nafa-tech', 'nafutech')).toBe(false);
    expect(trifft('kipro', '')).toBe(false);
    // Nadel länger als der ganze Wert.
    expect(trifft('fit', 'fitfitfit')).toBe(false);
  });

  it('läuft im Netzwerkfeld nicht aus dem Namen in das Kennzeichen', () => {
    const roh = 'nafa-tech 16kn065602_am';
    // Der Name selbst: gefunden.
    expect(trifft(roh, 'nafatech')).toBe(true);
    // Ein Stück aus der Mitte des Kennzeichens: kein Wortanfang, kein Treffer.
    expect(trifft(roh, 'kn0656')).toBe(false);
  });
});

describe('kernFundstellen — was markiert wird', () => {
  it('nimmt die übersprungene Fuge mit in die Fundstelle', () => {
    // `nafa-tech` ist ein Stück, nicht zwei mit einer Lücke.
    expect(kernFundstellen('nafa-tech 16kn065602', 'nafatech')).toEqual([[0, 9]]);
  });

  it('meldet nichts, wo die Nadel mitten im Wort begänne', () => {
    expect(kernFundstellen('lab on a chip', 'bona')).toEqual([]);
  });

  it('meldet jede Fundstelle, nicht nur die erste', () => {
    expect(kernFundstellen('a-b c a-b', 'ab')).toEqual([[0, 3], [6, 9]]);
  });
});

describe('KERN_FELDER — die Grenze zum Fließtext', () => {
  it('führt genau die beiden Namensfelder', () => {
    // Wächst diese Menge, muss die Begründung in `namensKern.ts` mitwachsen:
    // im Fließtext liefe dieselbe Faltung über einen Satzpunkt hinweg.
    expect([...KERN_FELDER].sort()).toEqual(['akronym', 'netzwerk']);
  });
});
