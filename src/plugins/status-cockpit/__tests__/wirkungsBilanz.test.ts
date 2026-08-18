/**
 * Die Zusage der Bilanzzeile: **sie nennt genau das, was man abstellen kann.**
 *
 * Eine stillgelegte Regel tut erwartungsgemäß nichts — sie mitzuzählen machte
 * die Zeile zur Anzeige des eigenen `aktiv`-Hakens. Und ohne Messlauf steht
 * dort gar nichts: „alle wirkungslos" wäre eine Behauptung über Daten, die
 * niemand erhoben hat.
 */
import { describe, it, expect } from 'vitest';
import {
  regelKurzname, wirkungsAnzeige, wirkungsBilanzText, wirkungsloseRegeln,
} from '../todoRegelnAnsicht';
import type { RegelWirkung, TodoRegel } from '@/core/status';

function regel(p: Partial<TodoRegel> & { id: string }): TodoRegel {
  return {
    reihenfolge: 10, beschreibung: `${p.id.toUpperCase()} · Beispiel`,
    bedingung: { alle: [] }, todo: 'etwas tun', zustaendig: ['ab'], aktiv: true, ...p,
  } as TodoRegel;
}
const w = (gewinnt: number, trifftZu: number, greift = 0): RegelWirkung =>
  ({ gewinnt, trifftZu, greift });

describe('wirkungsAnzeige — „gewinnt nie" ist ein Befund, kein Zahlenpaar', () => {
  it('meldet eine Regel, die überall verdeckt wird, als Nullbefund', () => {
    const a = wirkungsAnzeige(w(0, 21), false);
    expect(a?.nullbefund).toBe(true);
    expect(a?.kurz).toBe('trifft 21 · gewinnt 0');
    expect(a?.lang).toContain('verdeckt sie überall');
  });

  it('lässt die gewöhnliche Teilverdeckung unangetastet', () => {
    const a = wirkungsAnzeige(w(59, 67), false);
    expect(a?.nullbefund).toBe(false);
    expect(a?.kurz).toBe('trifft 67 · gewinnt 59');
  });
});

describe('wirkungsloseRegeln', () => {
  const regeln = [
    regel({ id: 'r1', reihenfolge: 10 }),
    regel({ id: 'r10', reihenfolge: 20 }),
    regel({ id: 'r23b', reihenfolge: 30 }),
    regel({ id: 's0', reihenfolge: 5, sperrt: ['precheck'], todo: undefined }),
  ];
  const wirkung = new Map<string, RegelWirkung>([
    ['r1', w(17, 17)],
    ['r10', w(0, 0)],
    ['r23b', w(0, 21)],
    ['s0', w(0, 0, 8790)],
  ]);

  it('trennt „trifft nie" von „immer verdeckt"', () => {
    expect(wirkungsloseRegeln(regeln, wirkung, 'ab')).toEqual([
      { regel: regeln[1], grund: 'trifft nie' },
      { regel: regeln[2], grund: 'immer verdeckt' },
    ]);
  });

  it('zählt eine stillgelegte Regel NICHT als Befund', () => {
    // Sonst meldete die Zeile als Mangel, was jemand absichtlich abgeschaltet hat.
    const aus = [regel({ id: 'r10', aktiv: false })];
    expect(wirkungsloseRegeln(aus, new Map([['r10', w(0, 0)]]), 'ab')).toEqual([]);
  });

  it('meldet eine Sperre, die nie greift — dort ist `greift` die Aussage', () => {
    const sp = [regel({ id: 's9', sperrt: ['rne'], todo: undefined })];
    expect(wirkungsloseRegeln(sp, new Map([['s9', w(0, 0, 0)]]), 'ab'))
      .toEqual([{ regel: sp[0], grund: 'greift nie' }]);
  });

  it('behauptet ohne Messlauf nichts', () => {
    expect(wirkungsloseRegeln(regeln, null, 'ab')).toEqual([]);
  });
});

describe('regelKurzname', () => {
  it('nimmt den Namen, unter dem die Regel im Termin läuft', () => {
    expect(regelKurzname(regel({ id: 'x', beschreibung: 'R23b · PreCheck Verbund offen' })))
      .toBe('R23b');
  });

  it('behält die ganze Beschreibung, wenn es keinen Trenner gibt', () => {
    expect(regelKurzname(regel({ id: 'x', beschreibung: 'Ohne Trenner' }))).toBe('Ohne Trenner');
  });
});

describe('wirkungsBilanzText', () => {
  it('nennt die wirkungslosen Regeln namentlich, nicht als Anzahl', () => {
    const regeln = [regel({ id: 'r10', beschreibung: 'R10 · Termin' }),
      regel({ id: 'r23b', reihenfolge: 20, beschreibung: 'R23b · PreCheck' })];
    const wirkung = new Map([['r10', w(0, 0)], ['r23b', w(0, 21)]]);
    expect(wirkungsBilanzText(regeln, wirkung, 'ab'))
      .toBe('2 Regeln bleiben ohne Wirkung: R10 (trifft nie) · R23b (immer verdeckt)');
  });

  it('sagt es ausdrücklich, wenn alles wirkt — Schweigen läse sich als ungeprüft', () => {
    const regeln = [regel({ id: 'r1' })];
    expect(wirkungsBilanzText(regeln, new Map([['r1', w(17, 17)]]), 'ab'))
      .toBe('jede ausgewertete Regel wirkt');
  });

  it('schweigt ohne Messlauf', () => {
    expect(wirkungsBilanzText([regel({ id: 'r1' })], null, 'ab')).toBeNull();
  });

  it('setzt den Einzahl-Satz, wenn genau eine Regel betroffen ist', () => {
    const regeln = [regel({ id: 'r10', beschreibung: 'R10 · Termin' })];
    expect(wirkungsBilanzText(regeln, new Map([['r10', w(0, 0)]]), 'ab'))
      .toBe('eine Regel bleibt ohne Wirkung: R10 (trifft nie)');
  });
});
