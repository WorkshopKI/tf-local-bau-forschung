/**
 * Die Zug-Regeln des Phasen-Editors — und die eine Umrechnung, die dazwischen
 * gehört.
 *
 * Der Baum meldet einen **Einfüge**-Index: vor welches Kind der Ablegepunkt
 * fällt, gezählt in der Liste, wie sie noch dasteht. `verschiebeZahPhase` nimmt
 * die Phase dagegen erst heraus und setzt sie dann an `index` — alles hinter ihr
 * ist da schon nachgerückt. Ohne Umrechnung landete jeder Zug nach unten exakt
 * eine Position zu weit, und zwar nur nach unten: der Fehler sah aus wie ein
 * launischer Baum, war aber eine Zählung zu viel.
 */
import { describe, it, expect } from 'vitest';
import { deuteZug, darfAblegen, darfZiehen } from '../phasenDrag';
import { OHNE_PHASE_ID, WURZEL_ID, codeKnotenId, type PhasenBaumKnoten } from '../phasenKnoten';
import type { TfTreeItem, TfTreeItems } from '@/components/tree';

const phasenIds = ['a', 'b', 'c', 'd'];

/** Ein Baum mit vier Phasen, einer „ohne Phase"-Gruppe und einem Code darin. */
function baum(): TfTreeItems<PhasenBaumKnoten> {
  const items: Record<string, TfTreeItem<PhasenBaumKnoten>> = {};
  for (const id of phasenIds) {
    items[id] = {
      id, name: id, isFolder: true, children: [],
      data: {
        art: 'phase',
        phase: { id, label: id, reihenfolge: 10, zieltageRelevant: false, fristLaeuft: true },
        codeAnzahl: 0, vorkommen: 0,
      },
    };
  }
  const code = codeKnotenId(11);
  items[code] = {
    id: code, name: '11', isFolder: false,
    data: {
      art: 'code', code: 11, wert: 'x', wertIds: ['w1'],
      zieltage: null, vorkommen: 0, verwaist: false,
    },
  };
  items[OHNE_PHASE_ID] = {
    id: OHNE_PHASE_ID, name: 'Ohne Phase', isFolder: true, children: [code],
    data: { art: 'ohne-phase', codeAnzahl: 1, vorkommen: 0 },
  };
  items[WURZEL_ID] = {
    id: WURZEL_ID, name: 'Wurzel', isFolder: true,
    children: [...phasenIds, OHNE_PHASE_ID],
    data: { art: 'wurzel' },
  };
  return items;
}

describe('Phase sortieren — Einfüge-Index wird zur Ziel-Position', () => {
  const items = baum();
  const ziel = (phaseId: string, index: number): number => {
    const zug = deuteZug(items, [phaseId], WURZEL_ID, index);
    expect(zug.art).toBe('phase-sortieren');
    return zug.art === 'phase-sortieren' ? zug.index : -1;
  };

  it('nach unten: „vor das dritte Kind" heißt Position 1, nicht 2', () => {
    // a b c d → a auf die Linie zwischen b und c. Ergebnis muss b a c d sein.
    expect(ziel('a', 2)).toBe(1);
  });

  it('nach oben bleibt der Index, wie er ist', () => {
    // a b c d → c ganz nach vorn. Herausnehmen verschiebt nichts davor.
    expect(ziel('c', 0)).toBe(0);
  });

  it('an dieselbe Stelle bleibt dieselbe Stelle', () => {
    expect(ziel('b', 1)).toBe(1);
  });

  it('ganz ans Ende der Phasen, nicht hinter „Ohne Phase"', () => {
    // Index 4 wäre die Position der Gruppe „ohne Phase" — sie ist keine Phase.
    expect(ziel('a', 4)).toBe(phasenIds.length - 1);
  });

  it('ohne Index passiert nichts, statt kommentarlos ans Ende zu setzen', () => {
    expect(deuteZug(items, ['a'], WURZEL_ID, undefined)).toEqual({ art: 'nichts' });
  });
});

describe('Phasen-Editor — was überhaupt gezogen werden darf', () => {
  const items = baum();

  it('ein Code zieht in eine Phase, eine Phase nur auf die oberste Ebene', () => {
    expect(darfAblegen(items, [codeKnotenId(11)], 'a')).toBe(true);
    expect(darfAblegen(items, ['a'], WURZEL_ID)).toBe(true);
    expect(darfAblegen(items, ['a'], 'b')).toBe(false);
  });

  it('die Gruppe „ohne Phase" bleibt, wo sie ist', () => {
    expect(darfZiehen([OHNE_PHASE_ID])).toBe(false);
    expect(darfZiehen([WURZEL_ID])).toBe(false);
  });

  it('gemischte Auswahlen haben kein gemeinsames Ziel', () => {
    expect(darfAblegen(items, ['a', codeKnotenId(11)], WURZEL_ID)).toBe(false);
  });
});
