/**
 * Persistenz-Schicht des Gutachten-Workflows: „Zustand setzen und schreiben" plus
 * die self-catching Hülle für reine Reducer-Aktionen.
 *
 * Beide Funktionen sind Fabriken statt Hooks — sie brauchen nur den Setter und den
 * Store, keinen React-Lebenszyklus. Dadurch ist die Regel „ein `setState` + ein
 * `persist` je Aktion" (Pitfall #16/#20) an EINER Stelle nachlesbar, statt in jeder
 * Aktion des Hooks mitgedacht werden zu müssen.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { putWorkflowRun } from './workflow-store';
import type { WorkflowRun } from './types';

/** Setzt den Run in den State UND schreibt ihn — nie das eine ohne das andere. */
export function makePersist(
  idb: IDBStore,
  setRun: (run: WorkflowRun) => void,
): (next: WorkflowRun) => Promise<void> {
  return async (next: WorkflowRun): Promise<void> => {
    setRun(next);
    await putWorkflowRun(idb, next);
  };
}

/**
 * Hülle für reine Reducer-Aktionen: `(run, now) => run` anwenden, und nur bei
 * echter Änderung persistieren (`next !== run`) — ein Reducer, der nichts zu tun
 * fand, löst so keinen Share-Write aus. Self-catching (Pitfall #15): jeder Fehler
 * landet im Banner, nicht in einer verschluckten Promise.
 */
export function makeReduce(
  getRun: () => WorkflowRun | null,
  persist: (next: WorkflowRun) => Promise<void>,
  setError: (msg: string) => void,
): (fn: (r: WorkflowRun, now: string) => WorkflowRun) => Promise<void> {
  return async (fn: (r: WorkflowRun, now: string) => WorkflowRun): Promise<void> => {
    const run = getRun();
    if (!run) return;
    try {
      const next = fn(run, new Date().toISOString());
      if (next !== run) await persist(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
}
