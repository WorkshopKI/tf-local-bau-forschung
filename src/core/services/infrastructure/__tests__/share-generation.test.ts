/**
 * Umzugs-Gate: wann muss der Anwender den Datenordner neu verbinden?
 *
 * Der Vergleich ist bewusst rein — das Gate entscheidet ueber den einzigen
 * Zustand, aus dem eine bestehende Installation nicht von selbst herausfindet
 * (sie schriebe sonst still in den alten Ordner weiter), und muss deshalb ohne
 * React und ohne IDB pruefbar sein.
 */

import { describe, it, expect } from 'vitest';
import {
  brauchtShareUmzug,
  leseShareGeneration,
  SHARE_GENERATION_BASIS,
} from '../share-generation';
import { SHARE_GENERATION_IDB_KEY } from '../types';
import type { IDBStore } from '@/core/services/storage/idb-store';

function idbMit(wert: unknown): IDBStore {
  return { get: async () => wert } as unknown as IDBStore;
}

describe('brauchtShareUmzug', () => {
  it('fordert den Umzug, wenn nie gestempelt wurde und die Config weitergezogen ist', () => {
    // Der Normalfall beim Rollout: jede Installation aus der Zeit vor v4.0 hat
    // keinen Eintrag und ist damit Generation 1.
    expect(brauchtShareUmzug(undefined, 2)).toBe(true);
    expect(brauchtShareUmzug(null, 2)).toBe(true);
  });

  it('laesst gleiche Generationen in Ruhe', () => {
    expect(brauchtShareUmzug(2, 2)).toBe(false);
    expect(brauchtShareUmzug(1, 1)).toBe(false);
    expect(brauchtShareUmzug(undefined, 1)).toBe(false);
  });

  it('fordert NICHTS, wenn die gespeicherte Generation vorauseilt', () => {
    // Rueckstufung des Builds: der Anwender ist bereits auf dem neueren Ordner.
    // Ein erzwungener Re-Pick wuerde ihn dort nur wieder herunterholen.
    expect(brauchtShareUmzug(3, 2)).toBe(false);
  });

  it('behandelt Unsinn in der IDB wie die Basis, statt zu werfen', () => {
    expect(brauchtShareUmzug(0, 2)).toBe(true);
    expect(brauchtShareUmzug(Number.NaN, 2)).toBe(true);
    expect(brauchtShareUmzug('2' as unknown as number, 2)).toBe(true);
    // ...und ein kaputter Config-Wert darf niemanden ins Gate schicken.
    expect(brauchtShareUmzug(1, undefined)).toBe(false);
  });
});

describe('leseShareGeneration', () => {
  it('liefert die Basis, wenn nichts gespeichert ist', async () => {
    expect(await leseShareGeneration(idbMit(undefined))).toBe(SHARE_GENERATION_BASIS);
  });

  it('liefert den gespeicherten Wert', async () => {
    expect(await leseShareGeneration(idbMit(4))).toBe(4);
  });

  it('liest genau den dokumentierten Key', async () => {
    const gelesen: string[] = [];
    const idb = {
      get: async (key: string) => { gelesen.push(key); return 2; },
    } as unknown as IDBStore;
    await leseShareGeneration(idb);
    expect(gelesen).toEqual([SHARE_GENERATION_IDB_KEY]);
  });
});
