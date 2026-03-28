import type { StorageService } from '@/core/services/storage';
import { bauantraegeData } from './bauantraege-data';
import { forschungData } from './forschung-data';
import { artefakteData } from './artefakte-data';

export interface SeedResult {
  vorgaenge: number;
  dokumente: number;
  artefakte: number;
}

export async function seedTestData(
  storage: StorageService,
  onProgress?: (current: number, total: number) => void,
): Promise<SeedResult> {
  const isSeeded = await storage.idb.get<boolean>('seed-complete');
  if (isSeeded) return { vorgaenge: 0, dokumente: 0, artefakte: 0 };

  // Dynamic import to keep main bundle smaller
  const { allDokumente } = await import('./dokumente-data');

  const total = bauantraegeData.length + forschungData.length + allDokumente.length + artefakteData.length;
  let current = 0;

  // Bauanträge
  for (const v of bauantraegeData) {
    await storage.saveVorgang(v);
    onProgress?.(++current, total);
  }

  // Forschungsanträge
  for (const v of forschungData) {
    await storage.saveVorgang(v);
    onProgress?.(++current, total);
  }

  // Dokumente
  for (const doc of allDokumente) {
    await storage.idb.set(`doc:${doc.id}`, doc);
    onProgress?.(++current, total);
  }

  // Artefakte
  for (const art of artefakteData) {
    await storage.idb.set(`artifact:${art.id}`, art);
    onProgress?.(++current, total);
  }

  await storage.idb.set('seed-complete', true);

  return {
    vorgaenge: bauantraegeData.length + forschungData.length,
    dokumente: allDokumente.length,
    artefakte: artefakteData.length,
  };
}

export async function clearSeedData(storage: StorageService): Promise<void> {
  const vKeys = await storage.idb.keys('vorgang:');
  for (const k of vKeys) await storage.idb.delete(k);

  const dKeys = await storage.idb.keys('doc:');
  for (const k of dKeys) await storage.idb.delete(k);

  const aKeys = await storage.idb.keys('artifact:');
  for (const k of aKeys) await storage.idb.delete(k);

  await storage.idb.delete('seed-complete');
  await storage.idb.delete('search-index');
}
