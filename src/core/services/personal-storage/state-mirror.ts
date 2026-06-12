/**
 * Generischer Durable-Spiegel für IDB-State in den persönlichen Ordner.
 *
 * Hintergrund: Gutachten-/Workflow-State (WorkflowRun, Kurzfassung, Batch-Job)
 * liegt im browser-profil-lokalen `kv`-Store → ein Browser-Wechsel verliert ihn.
 * Diese Helfer spiegeln den State zusätzlich als JSON in den persönlichen Ordner
 * (überlebt auf der Platte) und holen ihn bei leerer IDB von dort zurück.
 *
 * Muster (in den Stores verdrahtet):
 *   put    → IDB.set (Primary) + mirrorJsonToPersonal (durable)
 *   get    → IDB.get; bei Miss hydrateJsonFromPersonal + IDB.set (seed)
 *   delete → IDB.delete + removePersonalMirror
 *
 * ALLES best-effort: ohne Handle / ohne Permission / offline ist die IDB weiter
 * Source-of-Truth — kein Wurf, kein Blockieren der Generierung.
 */
import { atomicWrite, readText, removeFile, getPersoenlichHandle } from '@/core/services/infrastructure';
import type { IDBStore } from '@/core/services/storage';

/** State als JSON in den persönlichen Ordner spiegeln (mit `.backup`-Rotation —
 *  der Spiegel ist die Restore-Quelle, ein Korruptions-Schutz lohnt). No-op ohne
 *  Handle/Permission. */
export async function mirrorJsonToPersonal(idb: IDBStore, path: string, value: unknown): Promise<void> {
  try {
    const handle = await getPersoenlichHandle(idb);
    if (!handle) return;
    await atomicWrite(handle, path, JSON.stringify(value, null, 2));
  } catch {
    /* best-effort — IDB bleibt Source-of-Truth */
  }
}

/** State aus dem persönlichen Ordner lesen (für IDB-Miss-Hydration). `null` bei
 *  fehlendem Handle/Datei oder kaputtem JSON. */
export async function hydrateJsonFromPersonal<T>(idb: IDBStore, path: string): Promise<T | null> {
  try {
    const handle = await getPersoenlichHandle(idb);
    if (!handle) return null;
    const raw = await readText(handle, path);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Spiegel-Datei entfernen (Delete-Sync — sonst hydratisiert ein gelöschter
 *  Record beim nächsten Get wieder). */
export async function removePersonalMirror(idb: IDBStore, path: string): Promise<void> {
  try {
    const handle = await getPersoenlichHandle(idb);
    if (handle) await removeFile(handle, path).catch(() => {});
  } catch {
    /* ignore */
  }
}
