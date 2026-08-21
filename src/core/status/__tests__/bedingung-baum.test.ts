/**
 * Pfad-Operationen auf `Bedingung`-Bäumen.
 *
 * Der Prüfstein ist nicht „läuft durch", sondern: **sagt der Baum danach noch
 * dasselbe, was die Geste versprach?** Deshalb steht neben jedem Umbau die
 * erwartete Struktur, nicht nur eine Länge.
 */
import { describe, expect, it } from 'vitest';
import type { Bedingung } from '../typen';
import {
  darfBedingungAusruecken, darfBedingungEinruecken, darfBedingungVerschieben, entferneBedingungAn, ersetzeBedingungAn,
  fuegeBedingungEin, holeBedingungAn, istBedingungsGruppe, gruppenKinder, pfadLiegtUnter, mitGruppenKindern, rueckeBedingungAus,
  rueckeBedingungEin, bedingungsTiefe, verschiebeBedingung, verschiebeBedingungsGeschwister,
} from '../bedingung-baum';

const a: Bedingung = { feldId: 'tib_kuerz', op: 'gefuellt' };
const b: Bedingung = { feldId: 'bib_kuerz', op: 'gefuellt' };
const c: Bedingung = { feldId: 'status', op: 'ist', wert: 'beantragt' };

/** `{ alle: [a, b, { einige: [c] }] }` — ein Blatt, ein Blatt, eine Gruppe. */
const baum = (): Bedingung => ({ alle: [a, b, { einige: [c] }] });

describe('bedingung-baum · Zugriff', () => {
  it('holeBedingungAn findet Wurzel, Blatt und verschachteltes Blatt', () => {
    expect(holeBedingungAn(baum(), [])).toEqual(baum());
    expect(holeBedingungAn(baum(), [1])).toEqual(b);
    expect(holeBedingungAn(baum(), [2, 0])).toEqual(c);
  });

  it('holeBedingungAn gibt null, wenn der Pfad ins Leere zeigt', () => {
    expect(holeBedingungAn(baum(), [9])).toBeNull();
    // Durch ein BLATT hindurch gibt es keinen Weg.
    expect(holeBedingungAn(baum(), [0, 0])).toBeNull();
  });

  it('bedingungsTiefe zählt die Ebenen, Wurzel = 0', () => {
    expect(bedingungsTiefe([])).toBe(0);
    expect(bedingungsTiefe([2, 0])).toBe(2);
  });

  it('pfadLiegtUnter erkennt den eigenen Teilbaum', () => {
    expect(pfadLiegtUnter([2, 0], [2])).toBe(true);
    expect(pfadLiegtUnter([2], [2])).toBe(true);
    expect(pfadLiegtUnter([1], [2])).toBe(false);
  });

  it('gruppenKinder/mitGruppenKindern behalten die Verknüpfung', () => {
    const g: Bedingung = { einige: [a] };
    expect(istBedingungsGruppe(g)).toBe(true);
    expect(gruppenKinder(g)).toEqual([a]);
    expect(mitGruppenKindern(g, [b])).toEqual({ einige: [b] });
  });
});

describe('bedingung-baum · Einfügen und Entfernen', () => {
  it('ersetzeBedingungAn tauscht ein verschachteltes Blatt, ohne den Rest zu berühren', () => {
    const neu = ersetzeBedingungAn(baum(), [2, 0], a);
    expect(neu).toEqual({ alle: [a, b, { einige: [a] }] });
  });

  it('ersetzeBedingungAn mit leerem Pfad ersetzt den ganzen Baum', () => {
    expect(ersetzeBedingungAn(baum(), [], a)).toEqual(a);
  });

  it('lässt den Baum unverändert, wenn der Pfad ins Leere zeigt', () => {
    const vorher = baum();
    expect(ersetzeBedingungAn(vorher, [7], a)).toEqual(vorher);
    expect(entferneBedingungAn(vorher, [7])).toEqual(vorher);
    expect(fuegeBedingungEin(vorher, [0], 0, a)).toEqual(vorher);
  });

  it('entferneBedingungAn nimmt das Blatt heraus', () => {
    expect(entferneBedingungAn(baum(), [1])).toEqual({ alle: [a, { einige: [c] }] });
  });

  it('entferneBedingungAn rührt die Wurzel nicht an', () => {
    expect(entferneBedingungAn(baum(), [])).toEqual(baum());
  });

  it('fuegeBedingungEin hängt bei zu großem Index hinten an', () => {
    expect(fuegeBedingungEin(baum(), [], 99, c)).toEqual({ alle: [a, b, { einige: [c] }, c] });
  });

  it('gibt einen NEUEN Baum zurück (Referenz-Vergleich in React)', () => {
    const vorher = baum();
    const nachher = entferneBedingungAn(vorher, [0]);
    expect(nachher).not.toBe(vorher);
    expect(vorher).toEqual(baum());
  });
});

describe('bedingung-baum · Verschieben', () => {
  it('schiebt ein Blatt in die Gruppe daneben', () => {
    const neu = verschiebeBedingung(baum(), [0], [2], 0);
    expect(neu).toEqual({ alle: [b, { einige: [a, c] }] });
  });

  it('holt ein Blatt aus der Gruppe an die Wurzel', () => {
    const neu = verschiebeBedingung(baum(), [2, 0], [], 0);
    expect(neu).toEqual({ alle: [c, a, b, { einige: [] }] });
  });

  it('korrigiert den Index beim Zug nach unten in derselben Liste', () => {
    // Ohne Korrektur landete „a eins nach hinten" wieder auf Position 0, weil
    // das Entfernen die Liste vorher schon verkürzt hat.
    const neu = verschiebeBedingung(baum(), [0], [], 2);
    expect(neu).toEqual({ alle: [b, a, { einige: [c] }] });
  });

  it('lässt den Zug nach oben in derselben Liste unkorrigiert', () => {
    const neu = verschiebeBedingung(baum(), [1], [], 0);
    expect(neu).toEqual({ alle: [b, a, { einige: [c] }] });
  });

  it('verweigert das Verschieben einer Gruppe in den eigenen Teilbaum', () => {
    const vorher = baum();
    expect(darfBedingungVerschieben(vorher, [2], [2])).toBe(false);
    expect(verschiebeBedingung(vorher, [2], [2], 0)).toEqual(vorher);
  });

  it('verweigert das Verschieben der Wurzel und das Ablegen auf einem Blatt', () => {
    const vorher = baum();
    expect(darfBedingungVerschieben(vorher, [], [2])).toBe(false);
    expect(darfBedingungVerschieben(vorher, [0], [1])).toBe(false);
  });

  it('verschiebeBedingungsGeschwister tauscht Nachbarn und hält an den Rändern', () => {
    expect(verschiebeBedingungsGeschwister(baum(), [1], 'hoch')).toEqual({ alle: [b, a, { einige: [c] }] });
    expect(verschiebeBedingungsGeschwister(baum(), [0], 'hoch')).toEqual(baum());
    expect(verschiebeBedingungsGeschwister(baum(), [2], 'runter')).toEqual(baum());
  });
});

describe('bedingung-baum · Ein- und Ausrücken', () => {
  it('rückt nur ein, wenn der Vorgänger eine Gruppe ist', () => {
    // `{ alle: [{ einige: [c] }, a] }` — a hat eine Gruppe vor sich.
    const mitGruppeVorn: Bedingung = { alle: [{ einige: [c] }, a] };
    expect(darfBedingungEinruecken(mitGruppeVorn, [1])).toBe(true);
    expect(rueckeBedingungEin(mitGruppeVorn, [1])).toEqual({ alle: [{ einige: [c, a] }] });
  });

  it('rückt NICHT ein, wenn der Vorgänger ein Blatt ist', () => {
    // Sonst entstünde stillschweigend eine Gruppe, die niemand gewählt hat.
    const vorher = baum();
    expect(darfBedingungEinruecken(vorher, [1])).toBe(false);
    expect(rueckeBedingungEin(vorher, [1])).toEqual(vorher);
  });

  it('rückt am ersten Kind und an der Wurzel nicht ein', () => {
    expect(darfBedingungEinruecken(baum(), [0])).toBe(false);
    expect(darfBedingungEinruecken(baum(), [])).toBe(false);
  });

  it('rückt hinter die eigene Gruppe aus', () => {
    expect(darfBedingungAusruecken([2, 0])).toBe(true);
    expect(rueckeBedingungAus(baum(), [2, 0])).toEqual({ alle: [a, b, { einige: [] }, c] });
  });

  it('rückt auf der obersten Ebene nicht aus', () => {
    expect(darfBedingungAusruecken([0])).toBe(false);
    expect(rueckeBedingungAus(baum(), [0])).toEqual(baum());
  });

  it('Einrücken und Ausrücken heben sich auf', () => {
    const start: Bedingung = { alle: [{ einige: [c] }, a] };
    const rein = rueckeBedingungEin(start, [1]);
    expect(rein).toEqual({ alle: [{ einige: [c, a] }] });
    expect(rueckeBedingungAus(rein, [0, 1])).toEqual(start);
  });

  it('trägt eine dritte Ebene (die alte Grenze lag bei zwei)', () => {
    const tief: Bedingung = { alle: [{ einige: [{ alle: [a] }, b] }] };
    expect(holeBedingungAn(tief, [0, 0, 0])).toEqual(a);
    expect(darfBedingungEinruecken(tief, [0, 1])).toBe(true);
    expect(rueckeBedingungEin(tief, [0, 1])).toEqual({ alle: [{ einige: [{ alle: [a, b] }] }] });
  });
});
