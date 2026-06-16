import type { IDBStore } from '../storage/idb-store';
import {
  listProgramme,
  countAntraegeByProgramm,
  countAntraegeListViewByProgramm,
  forEachAntragChunkByProgramm,
  putAntraegeListView,
  clearAntraegeListView,
} from './idb-csv';
import { toAntragListItem } from './list-view';
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

/**
 * Liegt die Slim-Projektion auf der aktuellen Schema-Version? Nur dann darf ein
 * Snapshot-Sync die List-View INKREMENTELL (nur geänderte Records) pflegen —
 * sonst mischte er neue mit alt-projizierten Feldern. Bei Mismatch ist ein
 * Voll-Rebuild nötig (den `ensureListViewProjection` beim App-Start ohnehin
 * fährt, bevor der Sync-Orchestrator läuft).
 */
export async function isListViewProjectionCurrent(idb: IDBStore): Promise<boolean> {
  const marker = (await idb.get<number>(LIST_VIEW_VERSION_KEY).catch(() => null)) ?? null;
  return marker === LIST_VIEW_PROJECTION_VERSION;
}

export interface MigrationProgress {
  /** Programm aktuell in Bearbeitung. */
  programmId: string;
  /** Bereits projizierte Antraege im aktuellen Programm. */
  done: number;
  /** Gesamt-Antraege im aktuellen Programm. */
  total: number;
}

/**
 * Projiziert ALLE Antraege eines Programms in den Slim-Store — per gechunkten
 * Bulk-Reads (v2.63.1: `forEachAntragChunkByProgramm` statt per-Record-Cursor;
 * der Cursor kostete pro Record einen IDB-Roundtrip, ~10+ s bei 14k). Haelt
 * nie alle vollen Records gleichzeitig (Chunk-Peak ~18 MB statt ~470 MB,
 * OOM-Klasse v2.61.5); pro gelesenem Chunk wird direkt projiziert + geschrieben.
 */
async function projectProgrammStreamed(
  idb: IDBStore,
  programmId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const total = await countAntraegeByProgramm(idb, programmId);
  let done = 0;
  await forEachAntragChunkByProgramm(idb, programmId, async records => {
    await putAntraegeListView(idb, records.map(toAntragListItem));
    done += records.length;
    onProgress?.(done, total);
  });
  return done;
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
