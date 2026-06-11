/**
 * Persistenz des Gutachten-Workflow-Stands. Pro Verbund ein `WorkflowRun` im
 * generischen `kv`-Store unter `gutachten-workflow:<aktenzeichen>` — exakt das
 * Profil des Kurzfassung-Stores: Exact-Key-Lookup, KEIN dedizierter Object-Store/
 * Version-Bump (ein Bump triggert unter file:// mit parallel offenen Varianten ein
 * `onblocked`-Upgrade, siehe recurring-bug-classes.md §3 / Pitfall #29).
 *
 * Schreib-Disziplin: nur nach abgeschlossenem Statuswechsel persistieren (jeder
 * Runner-Reducer), NIE während der Generierung.
 */
import type { IDBStore } from '@/core/services/storage';
import type { WorkflowRun } from './types';

const keyFor = (aktenzeichen: string): string => `gutachten-workflow:${aktenzeichen}`;

export async function getWorkflowRun(idb: IDBStore, aktenzeichen: string): Promise<WorkflowRun | null> {
  return idb.get<WorkflowRun>(keyFor(aktenzeichen));
}

export async function putWorkflowRun(idb: IDBStore, run: WorkflowRun): Promise<void> {
  await idb.set(keyFor(run.aktenzeichen), run);
}

export async function deleteWorkflowRun(idb: IDBStore, aktenzeichen: string): Promise<void> {
  await idb.delete(keyFor(aktenzeichen));
}
