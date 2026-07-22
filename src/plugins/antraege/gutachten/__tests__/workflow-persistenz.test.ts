/**
 * Die Persistenz-Hülle des Gutachten-Workflows.
 *
 * Sie kodiert zwei Regeln, die vorher im Hook mitgedacht werden mussten und deshalb
 * nur über das UI prüfbar waren: „ein `setState` + ein `persist`, nie das eine ohne
 * das andere" (Pitfall #16/#20) und „ein Reducer, der nichts geändert hat, löst
 * KEINEN Share-Write aus". Der zweite ist der teurere — ein überflüssiger Write geht
 * auf den geteilten SMB-Share.
 */
import { describe, it, expect, vi } from 'vitest';
import { makePersist, makeReduce } from '../workflow-persistenz';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { WorkflowRun } from '../types';

function fakeIdb(): { geschrieben: unknown[]; idb: IDBStore } {
  const geschrieben: unknown[] = [];
  const idb = {
    get: async () => null,
    set: async (_k: string, v: unknown) => { geschrieben.push(v); },
    delete: async () => undefined,
    keys: async () => [],
  } as unknown as IDBStore;
  return { geschrieben, idb };
}

const NOW = '2026-07-01T00:00:00.000Z';
// Gleiche Form wie in workflow-store-keying.test.ts — `aktenzeichen` trägt das Keying.
const run = (aktiverSchritt = 'A'): WorkflowRun =>
  ({ aktenzeichen: 'AZ-1', schritte: {}, aktiverSchritt, erstellt_am: NOW, geaendert_am: NOW, schemaVersion: 1 });

describe('makePersist', () => {
  it('setzt den State UND schreibt — nie nur eines von beidem', async () => {
    const { geschrieben, idb } = fakeIdb();
    const setRun = vi.fn();
    const r = run();
    await makePersist(idb, setRun)(r);
    expect(setRun).toHaveBeenCalledWith(r);
    expect(geschrieben).toHaveLength(1);
  });
});

describe('makeReduce', () => {
  it('persistiert, wenn der Reducer einen NEUEN Run liefert', async () => {
    const persist = vi.fn(async () => undefined);
    const reduce = makeReduce(() => run('A'), persist, vi.fn());
    await reduce((r, now) => ({ ...r, geaendert_am: now }));
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('schreibt NICHT, wenn der Reducer denselben Run zurueckgibt', async () => {
    const persist = vi.fn(async () => undefined);
    const vorhanden = run('A');
    const reduce = makeReduce(() => vorhanden, persist, vi.fn());
    await reduce(r => r); // Reducer fand nichts zu tun
    expect(persist).not.toHaveBeenCalled();
  });

  it('tut nichts ohne geladenen Run', async () => {
    const persist = vi.fn(async () => undefined);
    const setError = vi.fn();
    await makeReduce(() => null, persist, setError)(r => r);
    expect(persist).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });

  it('faengt einen werfenden Reducer und meldet ihn (Pitfall #15 — nie still)', async () => {
    const setError = vi.fn();
    const reduce = makeReduce(() => run(), vi.fn(async () => undefined), setError);
    await reduce(() => { throw new Error('Reducer kaputt'); });
    expect(setError).toHaveBeenCalledWith('Reducer kaputt');
  });

  it('faengt auch einen Schreibfehler des persist', async () => {
    const setError = vi.fn();
    const persist = vi.fn(async () => { throw new Error('Share nicht erreichbar'); });
    const reduce = makeReduce(() => run(), persist, setError);
    await reduce((r, now) => ({ ...r, geaendert_am: now }));
    expect(setError).toHaveBeenCalledWith('Share nicht erreichbar');
  });

  it('liest den Run bei JEDEM Aufruf frisch (kein eingefrorener Closure-Stand)', async () => {
    let aktuell = run('A');
    const gesehen: string[] = [];
    const reduce = makeReduce(() => aktuell, async () => undefined, vi.fn());
    await reduce(r => { gesehen.push(r.aktiverSchritt); return { ...r }; });
    aktuell = run('C');
    await reduce(r => { gesehen.push(r.aktiverSchritt); return { ...r }; });
    expect(gesehen).toEqual(['A', 'C']);
  });
});
