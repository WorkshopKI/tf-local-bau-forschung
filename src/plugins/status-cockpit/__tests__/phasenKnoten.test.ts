/**
 * Der Phasen-Baum und seine Zug-Regeln.
 *
 * Die Zusage, an der alles hängt: **ein Blatt je CODE**. Der Katalog führt
 * dasselbe Vokabular unter `status` und `verbund_status`; als zwei Blätter
 * stünde jeder Status zweimal im Baum, und ein Zug auf nur eines von beiden
 * erzeugte zwei Wege zur Phase — genau das, wogegen `schnittVon` mit „erster
 * Wert gewinnt" geschrieben ist.
 */
import { describe, it, expect } from 'vitest';
import {
  bauePhasenBaum, codeKnotenId, codeAusKnotenId, OHNE_PHASE_ID, WURZEL_ID,
} from '../phasenKnoten';
import { darfAblegen, darfZiehen, deuteZug } from '../phasenDrag';
import { setzeCodePhasen } from '@/core/status';
import type { MappingVersion, StatusWertEintrag, ZahPhase } from '@/core/status';

const phase = (id: string, reihenfolge: number, label = id): ZahPhase => ({
  id, label, reihenfolge, zieltageRelevant: true,
});

const wert = (
  feldId: string, w: string, code: number, rest: Partial<StatusWertEintrag> = {},
): StatusWertEintrag => ({
  id: `${feldId}::${w}`, feldId, wert: w, code,
  kategorie: 'offen', prominenz: 'normal', aktiv: true, unkuratiert: false, ...rest,
});

/** Dieselben drei Codes unter BEIDEN Wert-Feldern — wie im echten Katalog. */
const VERSION: MappingVersion = {
  version: 1, autor: null, zeitstempel: 'x', felder: [],
  zahPhasen: [phase('a', 10, 'Anfang'), phase('b', 20, 'Mitte'), phase('c', 30, 'Ende')],
  werte: [
    wert('status', 'alpha', 11, { zahPhaseId: 'a' }),
    wert('verbund_status', 'alpha', 11, { zahPhaseId: 'a' }),
    wert('status', 'beta', 22, { zahPhaseId: 'b', zieltage: 14 }),
    wert('verbund_status', 'beta', 22, { zahPhaseId: 'b', zieltage: 14 }),
    wert('status', 'gamma', 33, { zahPhaseId: null }),          // bewusst Marker
    wert('verbund_status', 'gamma', 33, { zahPhaseId: null }),
    wert('status', 'delta', 44),                                 // Auslieferung entscheidet
    wert('status', 'epsilon', 55, { zahPhaseId: 'weg' }),        // verwaist
    // Ohne Code: gehört nicht in den Baum.
    { ...wert('status', 'roh', 0), code: undefined } as StatusWertEintrag,
  ],
};

const VORKOMMEN = new Map([
  ['status::alpha', 10], ['verbund_status::alpha', 5],
  ['status::beta', 7], ['verbund_status::beta', 3],
  ['status::gamma', 1], ['verbund_status::gamma', 1],
  ['status::delta', 4], ['status::epsilon', 2],
]);
const schluessel = (feldId: string, w: string): string => `${feldId}::${w}`;
const seedPhase = (code: number): string | null => (code === 44 ? 'c' : null);

const baum = (v: MappingVersion = VERSION) =>
  bauePhasenBaum(v, VORKOMMEN, schluessel, seedPhase);

describe('bauePhasenBaum — ein Blatt je Code', () => {
  it('faltet die beiden Wert-Felder auf EIN Blatt', () => {
    const { items } = baum();
    const blaetter = Object.values(items).filter(i => i.data.art === 'code');
    expect(blaetter.map(b => b.id).sort()).toEqual(
      [11, 22, 33, 44, 55].map(codeKnotenId).sort(),
    );
  });

  it('führt beide Wert-Ids am Blatt mit — sie sind es, die eine Aktion anfasst', () => {
    const knoten = baum().items[codeKnotenId(11)]!;
    expect(knoten.data).toMatchObject({ art: 'code', wertIds: ['status::alpha', 'verbund_status::alpha'] });
  });

  it('SUMMIERT die Vorkommen beider Felder — halbe Zahlen wären eine Fehlinformation', () => {
    const knoten = baum().items[codeKnotenId(11)]!;
    expect(knoten.data).toMatchObject({ vorkommen: 15 });
    const anfang = baum().items['a']!;
    expect(anfang.data).toMatchObject({ codeAnzahl: 1, vorkommen: 15 });
  });

  it('lässt Werte ohne Code draußen — sie haben keine Position im Verfahren', () => {
    const namen = Object.values(baum().items).map(i => i.name);
    expect(namen).not.toContain('roh');
  });

  it('greift für unentschiedene Codes auf die Auslieferung zurück', () => {
    // 44 trägt kein `zahPhaseId` — der Seed sagt „c".
    expect(baum().items['c']!.children).toContain(codeKnotenId(44));
  });

  it('legt bewusste Marker und Verwaiste unter „ohne Phase" — aber unterscheidbar', () => {
    const { items, verwaiste } = baum();
    const gruppe = items[OHNE_PHASE_ID]!;
    expect(gruppe.children).toEqual([codeKnotenId(33), codeKnotenId(55)]);
    expect(items[codeKnotenId(33)]!.data).toMatchObject({ verwaist: false });
    expect(items[codeKnotenId(55)]!.data).toMatchObject({ verwaist: true });
    expect(verwaiste).toBe(1);
  });

  it('stellt „ohne Phase" ans Ende, hinter alle Verfahrensphasen', () => {
    expect(baum().items[WURZEL_ID]!.children).toEqual(['a', 'b', 'c', OHNE_PHASE_ID]);
  });

  it('behält leere Phasen als Ordner — sie sind gültige Drop-Ziele', () => {
    const leer = baum({ ...VERSION, werte: [] }).items['b']!;
    expect(leer.isFolder).toBe(true);
    expect(leer.children).toEqual([]);
  });

  it('zeigt das kuratierte Label, wo eines gesetzt ist', () => {
    const mitLabel = baum({
      ...VERSION,
      werte: [wert('status', 'alpha', 11, { zahPhaseId: 'a', label: 'Schön benannt' })],
    });
    expect(mitLabel.items[codeKnotenId(11)]!.name).toBe('Schön benannt');
  });

  it('codeAusKnotenId ist die Umkehrung — und schweigt bei Nicht-Code-Knoten', () => {
    expect(codeAusKnotenId(codeKnotenId(99))).toBe(99);
    expect(codeAusKnotenId('a')).toBeNull();
    expect(codeAusKnotenId(OHNE_PHASE_ID)).toBeNull();
  });
});

describe('Die Zug-Regeln', () => {
  const { items } = baum();

  it('ein Code darf in eine Phase und in „ohne Phase"', () => {
    expect(darfAblegen(items, [codeKnotenId(11)], 'b')).toBe(true);
    expect(darfAblegen(items, [codeKnotenId(11)], OHNE_PHASE_ID)).toBe(true);
  });

  it('ein Code darf NICHT auf einen Code und nicht auf die Wurzel', () => {
    expect(darfAblegen(items, [codeKnotenId(11)], codeKnotenId(22))).toBe(false);
    expect(darfAblegen(items, [codeKnotenId(11)], WURZEL_ID)).toBe(false);
  });

  it('ein Zug, der nichts ändert, wird gar nicht erst angeboten', () => {
    expect(darfAblegen(items, [codeKnotenId(11)], 'a')).toBe(false);
    expect(darfAblegen(items, [codeKnotenId(33)], OHNE_PHASE_ID)).toBe(false);
  });

  it('eine Phase darf nur auf oberster Ebene sortiert werden', () => {
    expect(darfAblegen(items, ['a'], WURZEL_ID)).toBe(true);
    expect(darfAblegen(items, ['a'], 'b')).toBe(false);
    expect(darfAblegen(items, ['a'], OHNE_PHASE_ID)).toBe(false);
  });

  it('gemischte Auswahlen werden abgelehnt — es gäbe kein gemeinsames Ziel', () => {
    expect(darfAblegen(items, ['a', codeKnotenId(11)], WURZEL_ID)).toBe(false);
  });

  it('Wurzel und „ohne Phase" werden nicht gezogen', () => {
    expect(darfZiehen([WURZEL_ID])).toBe(false);
    expect(darfZiehen([OHNE_PHASE_ID])).toBe(false);
    expect(darfZiehen(['a'])).toBe(true);
  });
});

describe('deuteZug übersetzt in Store-Aktionen', () => {
  const { items } = baum();

  it('Codes umhängen — mit `null` für die Marker-Gruppe', () => {
    expect(deuteZug(items, [codeKnotenId(11), codeKnotenId(22)], 'c', undefined))
      .toEqual({ art: 'code-umhaengen', codes: [11, 22], zielPhase: 'c' });
    expect(deuteZug(items, [codeKnotenId(11)], OHNE_PHASE_ID, undefined))
      .toEqual({ art: 'code-umhaengen', codes: [11], zielPhase: null });
  });

  it('Phase sortieren nur mit Index — ohne ihn passiert nichts', () => {
    expect(deuteZug(items, ['c'], WURZEL_ID, 0))
      .toEqual({ art: 'phase-sortieren', phaseId: 'c', index: 0 });
    expect(deuteZug(items, ['c'], WURZEL_ID, undefined)).toEqual({ art: 'nichts' });
  });

  it('begrenzt den Index auf die Phasen — nie hinter „ohne Phase"', () => {
    // Die Wurzel hat 4 Kinder, aber nur 3 davon sind Phasen.
    expect(deuteZug(items, ['a'], WURZEL_ID, 3))
      .toEqual({ art: 'phase-sortieren', phaseId: 'a', index: 2 });
  });
});

describe('Der Zug wirkt auf BEIDE Feld-Einträge', () => {
  it('setzeCodePhasen schreibt TV- und Verbund-Zeile gemeinsam', () => {
    const zug = deuteZug(baum().items, [codeKnotenId(11)], 'c', undefined);
    expect(zug.art).toBe('code-umhaengen');
    if (zug.art !== 'code-umhaengen') return;
    const nachher = setzeCodePhasen(VERSION, new Map(zug.codes.map(c => [c, zug.zielPhase])));
    const betroffen = nachher.werte.filter(w => w.code === 11);
    expect(betroffen).toHaveLength(2);
    expect(betroffen.every(w => w.zahPhaseId === 'c')).toBe(true);
    // Und der Baum zeigt danach genau ein Blatt in der neuen Phase.
    const neu = baum(nachher);
    expect(neu.items['c']!.children).toContain(codeKnotenId(11));
    expect(neu.items['a']!.children).not.toContain(codeKnotenId(11));
  });
});
