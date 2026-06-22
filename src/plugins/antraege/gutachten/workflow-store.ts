/**
 * Persistenz eines Artefakt-Workflow-Stands. Ein `WorkflowRun` je (Artefakt-Typ,
 * Scope) im generischen `kv`-Store unter `workflow-run:<typ>:<scopeId>` — exakt das
 * Profil des Kurzfassung-Stores: Exact-Key-Lookup, KEIN dedizierter Object-Store/
 * Version-Bump (ein Bump triggert unter file:// mit parallel offenen Varianten ein
 * `onblocked`-Upgrade, siehe recurring-bug-classes.md §3 / Pitfall #29).
 *
 * Artefakt-Engine: `typ` defaultet auf `'ga'` (Gutachten, Scope = Verbund-/
 * Aktenzeichen) → bestehende GA-Aufrufer bleiben unverändert. Bestands-GA-Runs
 * lagen unter dem Alt-Key `gutachten-workflow:<scopeId>`; `getWorkflowRun` liest
 * ihn weiter und promotet ihn lazy auf den neuen Key (verlustfreie Migration,
 * GA byte-identisch). Neue Typen (z.B. `'nf'`, Scope = TV-Aktenzeichen) sind
 * disjunkt gekeyt.
 *
 * Schreib-Disziplin: nur nach abgeschlossenem Statuswechsel persistieren (jeder
 * Runner-Reducer), NIE während der Generierung.
 */
import type { IDBStore } from '@/core/services/storage';
import type { ArtefaktTyp } from '@/core/services/skills';
import { workflowRunPath } from '@/core/services/personal-storage/personal-layout';
import {
  mirrorJsonToPersonal, hydrateJsonFromPersonal, removePersonalMirror,
} from '@/core/services/personal-storage/state-mirror';
import type { WorkflowRun } from './types';

const keyFor = (typ: ArtefaktTyp, scopeId: string): string => `workflow-run:${typ}:${scopeId}`;
/** Alt-Key vor der Artefakt-Engine: GA-Runs lagen unter `gutachten-workflow:<az>`. */
const legacyGaKey = (scopeId: string): string => `gutachten-workflow:${scopeId}`;

// IDB ist Primary; ein JSON-Spiegel im persönlichen Ordner macht den Stand
// browser-wechsel-fest (Mirror beim Put, Hydrate bei IDB-Miss). Best-effort.
export async function getWorkflowRun(
  idb: IDBStore, scopeId: string, typ: ArtefaktTyp = 'ga',
): Promise<WorkflowRun | null> {
  const key = keyFor(typ, scopeId);
  const fromIdb = await idb.get<WorkflowRun>(key);
  if (fromIdb) return fromIdb;
  // Migration: Bestands-GA-Runs unter dem Alt-Key lesbar halten + lazy promoten.
  if (typ === 'ga') {
    const legacy = await idb.get<WorkflowRun>(legacyGaKey(scopeId));
    if (legacy) {
      await idb.set(key, legacy);
      return legacy;
    }
  }
  const fromDisk = await hydrateJsonFromPersonal<WorkflowRun>(idb, workflowRunPath(scopeId, typ));
  if (fromDisk) {
    await idb.set(key, fromDisk); // IDB seeden → nur 1× Disk-Read
    return fromDisk;
  }
  return null;
}

export async function putWorkflowRun(
  idb: IDBStore, run: WorkflowRun, typ: ArtefaktTyp = 'ga',
): Promise<void> {
  await idb.set(keyFor(typ, run.aktenzeichen), run);
  await mirrorJsonToPersonal(idb, workflowRunPath(run.aktenzeichen, typ), run);
}

export async function deleteWorkflowRun(
  idb: IDBStore, scopeId: string, typ: ArtefaktTyp = 'ga',
): Promise<void> {
  await idb.delete(keyFor(typ, scopeId));
  if (typ === 'ga') await idb.delete(legacyGaKey(scopeId)); // Alt-Key mit aufräumen
  await removePersonalMirror(idb, workflowRunPath(scopeId, typ));
}
