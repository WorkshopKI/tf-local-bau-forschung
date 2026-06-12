/**
 * Einmaliger Sicherungs-Sweep: spiegelt vorhandenen Gutachten-/Workflow-Stand
 * aus der IndexedDB in den persönlichen Ordner.
 *
 * Hintergrund: Der Store-Spiegel (v2.78.0) entsteht nur beim **Schreiben** eines
 * Records. Daten, die VOR dem Feature erzeugt oder offline (ohne Ordner-Freigabe)
 * bearbeitet wurden, haben noch keinen Disk-Spiegel und würden einen Browser-
 * Wechsel nicht überleben. Dieser Sweep holt das beim App-Start nach (Aufruf im
 * ShellLayout-Mount → einmal pro Session).
 *
 * Best-effort: ohne Handle/Permission no-op; pro Record nur schreiben, wenn der
 * Spiegel fehlt ODER der IDB-Stand neuer ist (kein Schreib-Sturm bei jedem Start,
 * kein Überschreiben einer neueren Disk-Kopie mit älterem IDB-Stand).
 */
import { atomicWrite, readText, getPersoenlichHandle } from '@/core/services/infrastructure';
import type { IDBStore } from '@/core/services/storage';
import { workflowRunPath, kurzfassungPath, batchJobPath } from './personal-layout';
import { isNewer } from './sync';

const WF_PREFIX = 'gutachten-workflow:';
const KF_PREFIX = 'gutachten-kurzfassung:';
const BATCH_KEY = 'gutachten-batch:aktiv';

interface Stamped { geaendert_am?: string }

const json = (v: unknown): string => JSON.stringify(v, null, 2);

/** Readwrite-Permission abfragen, ohne Prompt. `null` wenn die API fehlt (Test/
 *  alter Browser) → optimistisch fortfahren (der atomicWrite fängt es sonst ab). */
async function queryReadwrite(handle: FileSystemDirectoryHandle): Promise<PermissionState | null> {
  const fn = (handle as unknown as { queryPermission?: (d: { mode: string }) => Promise<PermissionState> }).queryPermission;
  if (typeof fn !== 'function') return null;
  try { return await fn.call(handle, { mode: 'readwrite' }); } catch { return null; }
}

/** Spiegeln nötig? Wenn die Disk-Datei fehlt ODER der IDB-Record neuer ist. */
async function needsMirror(handle: FileSystemDirectoryHandle, path: string, value: unknown): Promise<boolean> {
  const raw = await readText(handle, path);
  if (!raw) return true;
  try {
    const disk = JSON.parse(raw) as Stamped;
    return isNewer((value as Stamped).geaendert_am, disk.geaendert_am);
  } catch {
    return true; // kaputte Disk-Datei → überschreiben
  }
}

/**
 * Spiegelt alle WorkflowRun-/Kurzfassung-Records + den aktiven Batch-Job aus der
 * IDB in den persönlichen Ordner (catch-up). Gibt die Anzahl tatsächlich
 * geschriebener Spiegel zurück.
 */
export async function backupGutachtenStateToPersonal(idb: IDBStore): Promise<number> {
  let count = 0;
  try {
    const handle = await getPersoenlichHandle(idb);
    if (!handle) return 0;
    const perm = await queryReadwrite(handle);
    if (perm && perm !== 'granted') return 0;

    for (const [key, value] of await idb.entries(WF_PREFIX)) {
      const path = workflowRunPath(key.slice(WF_PREFIX.length));
      if (await needsMirror(handle, path, value)) { await atomicWrite(handle, path, json(value)); count++; }
    }
    for (const [key, value] of await idb.entries(KF_PREFIX)) {
      const path = kurzfassungPath(key.slice(KF_PREFIX.length));
      if (await needsMirror(handle, path, value)) { await atomicWrite(handle, path, json(value)); count++; }
    }
    // Batch-Singleton hat kein geaendert_am → nur spiegeln, wenn auf der Platte fehlt
    // (der aktive Job hält seinen Spiegel ohnehin per put aktuell).
    const batch = await idb.get(BATCH_KEY);
    if (batch && !(await readText(handle, batchJobPath()))) {
      await atomicWrite(handle, batchJobPath(), json(batch));
      count++;
    }
  } catch {
    /* best-effort — IDB bleibt Source-of-Truth */
  }
  return count;
}
