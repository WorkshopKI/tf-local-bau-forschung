import type { IDBStore } from '../storage/idb-store';
import {
  listProgramme,
  countAntraegeByProgramm,
  countAntraegeListViewByProgramm,
  forEachAntragByProgramm,
  putAntraegeListView,
  clearAntraegeListView,
} from './idb-csv';
import { toAntragListItem } from './list-view';
import type { AntragListItem } from './types';
import { tfPerfStart } from '@/core/utils/tfPerf';

/**
 * Schema-Version der List-View-Projektion. Bumpen, wenn `toAntragListItem`
 * neue Felder projiziert (v2: + t_hint, d_xtec, d_adv, tib_mail,
 * verbund_titel fuer den Auslastungs-Slim-Cache, v2.63) — der Count-basierte
 * Backfill-Check unten erkennt Feld-Aenderungen NICHT, nur fehlende Records.
 * Marker-Mismatch → einmaliger Voll-Rebuild beim ersten Start nach dem
 * Update (~5 s bei 13k, bestehende Boot-Statuszeile).
 */
export const LIST_VIEW_PROJECTION_VERSION = 2;
const LIST_VIEW_VERSION_KEY = 'list-view-projection-version';

export interface MigrationProgress {
  /** Programm aktuell in Bearbeitung. */
  programmId: string;
  /** Bereits projizierte Antraege im aktuellen Programm. */
  done: number;
  /** Gesamt-Antraege im aktuellen Programm. */
  total: number;
}

/**
 * Projiziert ALLE Antraege eines Programms per Cursor-Stream in den Slim-Store.
 * Haelt nie die vollen Records als Array (nur die Slim-Items, ~0.5–1 KB/Stueck)
 * — der fruehere `listAntraegeByProgramm`-Pfad erzeugte hier den dokumentierten
 * ~470-MB-Array-Peak (volle 461-Feld-Records, OOM-Klasse v2.61.5).
 * Writes ausserhalb der Cursor-TX in 500er-Chunks (onRecord muss synchron
 * bleiben; eine readwrite-TX auf einen anderen Store wuerde den Cursor abbrechen).
 */
async function projectProgrammStreamed(
  idb: IDBStore,
  programmId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const slim: AntragListItem[] = [];
  await forEachAntragByProgramm(idb, programmId, a => { slim.push(toAntragListItem(a)); });
  const CHUNK = 500;
  for (let i = 0; i < slim.length; i += CHUNK) {
    await putAntraegeListView(idb, slim.slice(i, i + CHUNK));
    onProgress?.(Math.min(i + CHUNK, slim.length), slim.length);
  }
  return slim.length;
}

/**
 * Idempotente Bulk-Migration: stellt sicher, dass fuer jedes Programm der
 * `ANTRAEGE_LIST_VIEW`-Store eine Slim-Projektion aller Antraege haelt UND
 * die Projektion dem aktuellen Schema (`LIST_VIEW_PROJECTION_VERSION`)
 * entspricht.
 *
 * Zwei Trigger:
 *  - **Versions-Marker weicht ab** (Update mit neuen Projektion-Feldern oder
 *    Bestand ohne Marker) → Voll-Rebuild; Marker wird erst NACH Erfolg
 *    geschrieben (Crash → naechster Start versucht erneut, crash-safe).
 *  - **Count-Mismatch** (Slim-Spiegel kleiner als der volle Store, z.B. nach
 *    abgebrochenem Erstlauf) → Backfill via Voll-Projektion des Programms.
 *
 * v2.63: Der Check laeuft per billigem Index-`count()` — bis dahin lud dieser
 * Pfad bei JEDEM App-Start alle vollen Records nur fuer den Laengen-Vergleich
 * (Sekunden Deserialize im Boot-Fenster, Teil des Citrix-Cold-Start-Budgets).
 */
export async function ensureListViewProjection(
  idb: IDBStore,
  onProgress?: (p: MigrationProgress) => void,
): Promise<void> {
  const end = tfPerfStart('ensureListViewProjection');

  const marker = (await idb.get<number>(LIST_VIEW_VERSION_KEY).catch(() => null)) ?? null;
  if (marker !== LIST_VIEW_PROJECTION_VERSION) {
    await rebuildAntraegeListView(idb, (done, total, programmId) => {
      onProgress?.({ programmId, done, total });
    });
    await idb.set(LIST_VIEW_VERSION_KEY, LIST_VIEW_PROJECTION_VERSION);
    end(`full rebuild (projection v${marker ?? '∅'} → v${LIST_VIEW_PROJECTION_VERSION})`);
    return;
  }

  const programme = await listProgramme(idb);
  let totalProjected = 0;
  for (const p of programme) {
    const [fullCount, listViewCount] = await Promise.all([
      countAntraegeByProgramm(idb, p.id),
      countAntraegeListViewByProgramm(idb, p.id),
    ]);
    if (fullCount === 0 || listViewCount >= fullCount) continue;
    onProgress?.({ programmId: p.id, done: 0, total: fullCount });
    totalProjected += await projectProgrammStreamed(idb, p.id, (done, total) => {
      onProgress?.({ programmId: p.id, done, total });
    });
  }
  end(`projected=${totalProjected}`);
}

/**
 * VOLLSTÄNDIGER Neuaufbau der List-View-Projektion: leert den Slim-Store und
 * projiziert ALLE Antraege neu. Anders als `ensureListViewProjection` (nur
 * Backfill, wenn der Spiegel zu KLEIN ist) ist das zwingend nach einem
 * Snapshot-Sync, der den `ANTRAEGE`-Store via `replaceStore` komplett ersetzt
 * (clear + put), die List-View aber nicht berührt. Ohne diesen Rebuild liest
 * die Home die alte/leere Projektion und bleibt bis zum nächsten App-Start
 * (= manueller Reload, der `ensureListViewProjection` neu laufen lässt) leer.
 *
 * `onProgress` bekommt zusaetzlich die programmId (3. Arg) — bestehende
 * Zwei-Arg-Caller (snapshot-sync) bleiben kompatibel.
 */
export async function rebuildAntraegeListView(
  idb: IDBStore,
  onProgress?: (done: number, total: number, programmId: string) => void,
): Promise<void> {
  const end = tfPerfStart('rebuildAntraegeListView');
  await clearAntraegeListView(idb);
  const programme = await listProgramme(idb);
  let total = 0;
  for (const p of programme) {
    total += await projectProgrammStreamed(idb, p.id, (done, t) => onProgress?.(done, t, p.id));
  }
  end(`reprojected=${total}`);
}
