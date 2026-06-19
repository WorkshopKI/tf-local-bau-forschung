/**
 * Leseschicht: sammelt die Vereinigung aller Pro-Nutzer-Dateien (gemeinsam +
 * persönlicher Fallback), parst JSONL (defekte/verbotene Zeilen übersprungen) und
 * aggregiert. Das Ergebnis wird im IDB-`kv`-Store gecacht (Pitfall #29); die
 * Invalidierung läuft über `invalidateAggregateCache` (nach Write + beim Sync) —
 * kein synchroner Vollscan bei jedem Render.
 */
import type { StorageService } from '@/core/services/storage';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { listFilesWithBackupInfo, readText } from '@/core/services/infrastructure/atomic-write';
import { getDatenShareHandle, getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { aggregate, type SkillAggregat, type SkillAggregatMap } from './aggregate';
import { AGGREGATE_CACHE_KEY } from './cache';
import { sanitizeEvent } from './guard';
import { personalSignalDir, sharedSignalDir, type SignalKind } from './layout';
import type { SkillSignalEvent } from './types';

const KINDS: readonly SignalKind[] = ['feedback', 'usage'];

/**
 * Parst JSONL-Text zu gesäuberten Events. Jede Zeile wird erneut durch den
 * DSGVO-Guard geschickt (Defense-in-Depth); defekte/verbotene Zeilen entfallen,
 * statt den ganzen Scan zu kippen.
 */
export function parseJsonlEvents(text: string): SkillSignalEvent[] {
  const out: SkillSignalEvent[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const ev = sanitizeEvent(raw);
    if (ev) out.push(ev);
  }
  return out;
}

async function readDirEvents(
  root: FileSystemDirectoryHandle,
  dir: string,
): Promise<SkillSignalEvent[]> {
  const files = await listFilesWithBackupInfo(root, dir);
  const events: SkillSignalEvent[] = [];
  for (const f of files) {
    if (!f.name.endsWith('.jsonl')) continue;
    const text = await readText(root, `${dir}/${f.name}`);
    if (text) events.push(...parseJsonlEvents(text));
  }
  return events;
}

/**
 * Sammelt alle Events aus dem gemeinsamen Verzeichnis UND der persönlichen
 * Fallback-Ablage (Vereinigung). Fehlende Verzeichnisse/Handles → leer.
 */
export async function collectAllEvents(storage: StorageService): Promise<SkillSignalEvent[]> {
  const share = await getDatenShareHandle(storage.idb);
  const pers = await getPersoenlichHandle(storage.idb);
  const events: SkillSignalEvent[] = [];
  for (const kind of KINDS) {
    if (share) events.push(...(await readDirEvents(share, sharedSignalDir(kind))));
    if (pers) events.push(...(await readDirEvents(pers, personalSignalDir(kind))));
  }
  return events;
}

async function cacheAggregate(idb: IDBStore, map: SkillAggregatMap): Promise<void> {
  try {
    await idb.set(AGGREGATE_CACHE_KEY, Object.fromEntries(map));
  } catch (err) {
    console.warn('[skill-feedback] aggregate cache write failed:', err);
  }
}

/**
 * Liefert das Aggregat über alle Nutzer-Dateien. Cache-Hit aus dem `kv`-Store
 * (kein Datei-Scan); bei Miss frisch gerechnet und gecacht. Cache wird über
 * `invalidateAggregateCache` (Write + Sync) verworfen.
 */
export async function readAggregate(storage: StorageService): Promise<SkillAggregatMap> {
  const cached = await storage.idb.get<Record<string, SkillAggregat>>(AGGREGATE_CACHE_KEY);
  if (cached) return new Map(Object.entries(cached));
  const map = aggregate(await collectAllEvents(storage));
  await cacheAggregate(storage.idb, map);
  return map;
}
