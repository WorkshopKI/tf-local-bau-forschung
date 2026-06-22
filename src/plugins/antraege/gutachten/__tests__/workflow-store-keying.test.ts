import { describe, it, expect } from 'vitest';
import { getWorkflowRun, putWorkflowRun, deleteWorkflowRun } from '../workflow-store';
import type { WorkflowRun } from '../types';
import type { IDBStore } from '@/core/services/storage';

const NOW = '2026-06-22T10:00:00.000Z';

function run(aktenzeichen: string, aktiverSchritt = 'A'): WorkflowRun {
  return { aktenzeichen, schritte: {}, aktiverSchritt, erstellt_am: NOW, geaendert_am: NOW, schemaVersion: 1 };
}

/** Minimaler In-Memory-IDBStore mit einsehbarer Map (nur get/set/delete genutzt). */
function fakeIdb() {
  const m = new Map<string, unknown>();
  const idb = {
    async get<T>(k: string): Promise<T | null> { return (m.get(k) as T) ?? null; },
    async set(k: string, v: unknown): Promise<void> { m.set(k, v); },
    async delete(k: string): Promise<void> { m.delete(k); },
  } as unknown as IDBStore;
  return { idb, map: m };
}

describe('workflow-store — Run-Keying je (Typ, Scope)', () => {
  it('GA defaultet auf typ=ga und schreibt unter workflow-run:ga:<scope>', async () => {
    const { idb, map } = fakeIdb();
    await putWorkflowRun(idb, run('AZ-1')); // typ default 'ga'
    expect(map.has('workflow-run:ga:AZ-1')).toBe(true);
    expect(await getWorkflowRun(idb, 'AZ-1')).not.toBeNull();
  });

  it('Migration: Bestands-GA unter Alt-Key gutachten-workflow:<scope> wird gefunden + lazy promotet', async () => {
    const { idb, map } = fakeIdb();
    // Simuliere einen Pre-Engine-Stand: nur der Alt-Key existiert.
    map.set('gutachten-workflow:16EP051840', run('16EP051840', 'C'));

    const found = await getWorkflowRun(idb, '16EP051840'); // typ default 'ga'
    expect(found?.aktiverSchritt).toBe('C');
    // Promotion auf den neuen Key:
    expect(map.has('workflow-run:ga:16EP051840')).toBe(true);
    // Alt-Key bleibt (harmlos) liegen, wird aber nicht mehr gelesen:
    expect(map.has('gutachten-workflow:16EP051840')).toBe(true);
  });

  it('disjunkt: GA und NF mit GLEICHER scopeId kollidieren nicht', async () => {
    const { idb, map } = fakeIdb();
    await putWorkflowRun(idb, run('X', 'A'), 'ga');
    await putWorkflowRun(idb, run('X', 'B'), 'nf');
    expect(map.has('workflow-run:ga:X')).toBe(true);
    expect(map.has('workflow-run:nf:X')).toBe(true);
    expect((await getWorkflowRun(idb, 'X', 'ga'))?.aktiverSchritt).toBe('A');
    expect((await getWorkflowRun(idb, 'X', 'nf'))?.aktiverSchritt).toBe('B');
  });

  it('NF liest NICHT den GA-Alt-Key (Migration nur für ga)', async () => {
    const { idb, map } = fakeIdb();
    map.set('gutachten-workflow:Y', run('Y', 'G'));
    expect(await getWorkflowRun(idb, 'Y', 'nf')).toBeNull();
  });

  it('delete entfernt neuen Key + (bei ga) den Alt-Key', async () => {
    const { idb, map } = fakeIdb();
    map.set('gutachten-workflow:Z', run('Z'));
    await putWorkflowRun(idb, run('Z'), 'ga'); // promotet implizit beim nächsten Lesen; hier direkt schreiben
    await deleteWorkflowRun(idb, 'Z', 'ga');
    expect(map.has('workflow-run:ga:Z')).toBe(false);
    expect(map.has('gutachten-workflow:Z')).toBe(false);
    expect(await getWorkflowRun(idb, 'Z', 'ga')).toBeNull();
  });
});
