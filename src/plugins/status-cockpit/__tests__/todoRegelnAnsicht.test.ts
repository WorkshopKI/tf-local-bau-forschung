/**
 * Das Ansichts-Modell des Regeln-Tabs: welche Regeln ein Regelsatz zeigt, welche
 * davon geöffnet ist und in welchem Zustand sie steht.
 *
 * Der Kern ist Pitfall #47: `regelsatz` fehlend heißt AB, `giltFuer` an einer
 * Sperre fehlend heißt ALLE — gegenläufig zu `zustaendig`. Eine Sperre, die aus
 * einem fremden Satz verschwände, nähme dort die Begründung mit, warum ein
 * Vorgang stumm bleibt.
 */
import { describe, it, expect } from 'vitest';
import type { Rolle, TodoRegel } from '@/core/status';
import {
  brauchtRolloutRueckfrage, positionsText, sichtbareRegeln, waehleRegel, zustandsMarker,
} from '../todoRegelnAnsicht';

const regel = (p: Partial<TodoRegel> & { id: string; reihenfolge: number }): TodoRegel => ({
  beschreibung: p.id, bedingung: { feldId: 'status', op: 'gefuellt' },
  todo: 'etwas tun', zustaendig: [], aktiv: true, ...p,
});

const AB1 = regel({ id: 'r1', reihenfolge: 20 });
const AB2 = regel({ id: 'r2', reihenfolge: 10 });
const FB1 = regel({ id: 'f1', reihenfolge: 30, regelsatz: 'fb' });
const SPERRE_ALLE = regel({ id: 's0', reihenfolge: 5, sperrt: ['*'], todo: '' });
const SPERRE_FB = regel({ id: 's9', reihenfolge: 6, sperrt: ['*'], giltFuer: ['fb'], todo: '' });

describe('sichtbareRegeln', () => {
  it('rechnet eine Regel ohne regelsatz dem AB-Satz zu', () => {
    expect(sichtbareRegeln([AB1, FB1], 'ab').map(r => r.id)).toEqual(['r1']);
    expect(sichtbareRegeln([AB1, FB1], 'fb').map(r => r.id)).toEqual(['f1']);
  });

  it('zeigt eine Sperre ohne giltFuer in JEDEM Satz', () => {
    for (const satz of ['ab', 'fb', 'qs'] as Rolle[]) {
      expect(sichtbareRegeln([SPERRE_ALLE], satz).map(r => r.id), satz).toEqual(['s0']);
    }
  });

  it('beschränkt eine Sperre mit giltFuer auf die genannten Sätze', () => {
    expect(sichtbareRegeln([SPERRE_FB], 'fb').map(r => r.id)).toEqual(['s9']);
    expect(sichtbareRegeln([SPERRE_FB], 'ab')).toEqual([]);
  });

  it('sortiert nach reihenfolge, nicht nach Array-Position', () => {
    expect(sichtbareRegeln([AB1, SPERRE_ALLE, AB2], 'ab').map(r => r.id)).toEqual(['s0', 'r2', 'r1']);
  });
});

describe('waehleRegel', () => {
  const regeln = sichtbareRegeln([AB1, SPERRE_ALLE, AB2], 'ab'); // s0, r2, r1

  it('liefert null ohne Auswahl und bei unbekannter Id', () => {
    expect(waehleRegel(regeln, null)).toBeNull();
    expect(waehleRegel(regeln, 'gibt-es-nicht'), 'verworfener Entwurf schließt das Detail').toBeNull();
  });

  it('gibt den Index der SORTIERTEN Liste zurück', () => {
    expect(waehleRegel(regeln, 'r1')).toEqual({ regel: AB1, index: 2, anzahl: 3 });
    expect(waehleRegel(regeln, 's0')?.index).toBe(0);
  });
});

describe('zustandsMarker', () => {
  it('erkennt eine vorgangsweite Sperre im fremden Satz als nicht-eigen', () => {
    const m = zustandsMarker(SPERRE_ALLE, 'fb', []);
    expect(m.istSperre).toBe(true);
    expect(m.eigen, 'verschieben nur im Satz AB').toBe(false);
    expect(m.giltFuerAlle).toBe(true);
  });

  it('nennt dieselbe Sperre im eigenen Satz nicht „gilt für alle"', () => {
    const m = zustandsMarker(SPERRE_ALLE, 'ab', []);
    expect(m.eigen).toBe(true);
    expect(m.giltFuerAlle).toBe(false);
  });

  it('meldet stillgelegt und reicht unbekannte Felder durch', () => {
    const m = zustandsMarker(regel({ id: 'x', reihenfolge: 1, aktiv: false }), 'ab', ['D_FEHLT']);
    expect(m.stillgelegt).toBe(true);
    expect(m.unbekannte).toEqual(['D_FEHLT']);
  });
});

describe('positionsText', () => {
  it('zeigt 1-basiert über 0-basiertem Index', () => {
    expect(positionsText(4, 27)).toBe('Position 5 von 27');
    expect(positionsText(0, 1)).toBe('Position 1 von 1');
  });
});

describe('brauchtRolloutRueckfrage', () => {
  it('fragt nur beim AKTIVIEREN außerhalb des AB-Satzes', () => {
    expect(brauchtRolloutRueckfrage(FB1, true)).toBe(true);
    expect(brauchtRolloutRueckfrage(FB1, false), 'stilllegen ist immer harmlos').toBe(false);
    expect(brauchtRolloutRueckfrage(AB1, true), 'AB wirkt überall gleich').toBe(false);
  });
});
