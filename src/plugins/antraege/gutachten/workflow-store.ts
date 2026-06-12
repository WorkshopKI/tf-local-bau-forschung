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
import { workflowRunPath } from '@/core/services/personal-storage/personal-layout';
import {
  mirrorJsonToPersonal, hydrateJsonFromPersonal, removePersonalMirror,
} from '@/core/services/personal-storage/state-mirror';
import type { WorkflowRun } from './types';

const keyFor = (aktenzeichen: string): string => `gutachten-workflow:${aktenzeichen}`;

// IDB ist Primary; ein JSON-Spiegel im persönlichen Ordner macht den Stand
// browser-wechsel-fest (Mirror beim Put, Hydrate bei IDB-Miss). Best-effort.
export async function getWorkflowRun(idb: IDBStore, aktenzeichen: string): Promise<WorkflowRun | null> {
  const fromIdb = await idb.get<WorkflowRun>(keyFor(aktenzeichen));
  if (fromIdb) return fromIdb;
  const fromDisk = await hydrateJsonFromPersonal<WorkflowRun>(idb, workflowRunPath(aktenzeichen));
  if (fromDisk) {
    await idb.set(keyFor(aktenzeichen), fromDisk); // IDB seeden → nur 1× Disk-Read
    return fromDisk;
  }
  return null;
}

export async function putWorkflowRun(idb: IDBStore, run: WorkflowRun): Promise<void> {
  await idb.set(keyFor(run.aktenzeichen), run);
  await mirrorJsonToPersonal(idb, workflowRunPath(run.aktenzeichen), run);
}

export async function deleteWorkflowRun(idb: IDBStore, aktenzeichen: string): Promise<void> {
  await idb.delete(keyFor(aktenzeichen));
  await removePersonalMirror(idb, workflowRunPath(aktenzeichen));
}
