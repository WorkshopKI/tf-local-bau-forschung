import type { IDBStore } from '../storage/idb-store';
import { listProgramme } from './idb-csv';
import {
  countAntraegeListViewByProgramm,
  listAntraegeByProgramm,
  putAntraegeListView,
} from './idb-csv';
import { toAntragListItem } from './list-view';
import { tfPerfStart } from '@/core/utils/tfPerf';

export interface MigrationProgress {
  /** Programm aktuell in Bearbeitung. */
  programmId: string;
  /** Bereits projizierte Antraege im aktuellen Programm. */
  done: number;
  /** Gesamt-Antraege im aktuellen Programm. */
  total: number;
}

/**
 * Idempotente Bulk-Migration: stellt sicher, dass fuer jedes Programm der
 * `ANTRAEGE_LIST_VIEW`-Store eine Slim-Projektion aller Antraege haelt.
 *
 * Trigger: Programm hat einen non-empty `ANTRAEGE`-Store, aber der zugehoerige
 * Slim-Spiegel ist leer (oder zu klein). Lauft beim ersten App-Start nach dem
 * v8-Schema-Bump; bei Crash wird beim naechsten Start fortgesetzt (gleicher
 * Trigger-Check, fehlende Records werden nachgezogen).
 *
 * Schreib-Strategie: Chunks von ~500 Records via `putAntraegeListView`, damit
 * pro Chunk genau eine IDB-TX laeuft.
 */
export async function ensureListViewProjection(
  idb: IDBStore,
  onProgress?: (p: MigrationProgress) => void,
): Promise<void> {
  const end = tfPerfStart('ensureListViewProjection');
  const programme = await listProgramme(idb);
  let totalProjected = 0;
  for (const p of programme) {
    const listViewCount = await countAntraegeListViewByProgramm(idb, p.id);
    const fullList = await listAntraegeByProgramm(idb, p.id);
    if (fullList.length === 0) continue;
    if (listViewCount >= fullList.length) continue;
    onProgress?.({ programmId: p.id, done: 0, total: fullList.length });
    const CHUNK = 500;
    for (let i = 0; i < fullList.length; i += CHUNK) {
      const slice = fullList.slice(i, i + CHUNK);
      await putAntraegeListView(idb, slice.map(toAntragListItem));
      onProgress?.({
        programmId: p.id,
        done: Math.min(i + CHUNK, fullList.length),
        total: fullList.length,
      });
    }
    totalProjected += fullList.length;
  }
  end(`projected=${totalProjected}`);
}
