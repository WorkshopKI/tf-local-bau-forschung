import type { StorageService } from '@/core/services/storage';
import { createOramaDB, insertDoc, saveOramaToDB } from '@/core/services/search/orama-store';
import { getActiveModelId, getModelById } from '@/core/services/search/model-registry';
import { ensureDefaultProgramm } from '@/core/services/csv';
import { listAntraegeByProgramm, deleteAntrag } from '@/core/services/csv/idb-csv';
import { removeSchema } from '@/core/services/csv/schemaRegistry';
import { bauantraegeData } from './bauantraege-data';
import { artefakteData } from './artefakte-data';
import { LEGACY_PRE_V2_AKTENZEICHEN } from './foerderantraege-data';
import { FIXTURE_SCHEMA_IDS, seedFromFixtureCsvs } from './fixture-loader';

export interface SeedResult {
  vorgaenge: number;
  dokumente: number;
  artefakte: number;
}

/**
 * Seed-Flag-Name. Ab v2 (Mai 2026) kommen die Foerderantraege-Seeds aus
 * echten anonymisierten CSVs unter `docs/fixtures/`, nicht mehr aus
 * handgeschriebenen `Antrag`-Objekten. Eine alte IDB mit `seed-complete: true`
 * (v1) seedet beim ersten Start mit der neuen Version trotzdem, weil der
 * v2-Flag fehlt — die alten Pre-v2-Antraege bleiben als Geister liegen, bis
 * der Dev manuell ueber das Kurator-Panel "Seeds zuruecksetzen" macht.
 */
const SEED_COMPLETE_FLAG = 'seed-complete-v2';

export async function seedTestData(
  storage: StorageService,
  onProgress?: (current: number, total: number) => void,
): Promise<SeedResult> {
  const isSeeded = await storage.idb.get<boolean>(SEED_COMPLETE_FLAG);
  if (isSeeded) return { vorgaenge: 0, dokumente: 0, artefakte: 0 };

  const { allDokumente } = await import('./dokumente-data');

  const modelId = await getActiveModelId(storage.idb);
  const model = getModelById(modelId);
  createOramaDB(model.dimensions);

  const emptyVec = new Array(model.dimensions).fill(0) as number[];

  // Bauantraege — save + index
  // Total wird zwei Stages spaeter um die importierten Foerderantraege ergaenzt;
  // hier ein konservativer Initialwert fuer den Progress-Balken.
  const baseTotal = bauantraegeData.length + allDokumente.length + artefakteData.length;
  let current = 0;

  for (const v of bauantraegeData) {
    await storage.saveVorgang(v);
    insertDoc({
      id: v.id, text: `${v.title} ${v.notes} ${v.tags.join(' ')}`,
      title: v.title, source: v.id, tags: v.tags.join(','),
      type: 'bauantrag', embedding: emptyVec,
    });
    onProgress?.(++current, baseTotal);
  }

  // Foerderantraege — kommen jetzt aus echten anonymisierten CSVs in
  // docs/fixtures/. Wenn die CSVs lokal fehlen (frischer Klon), liefert der
  // Loader 0 Antraege und der Seed laeuft graceful weiter.
  //
  // Gate: nur seeden, wenn das Default-Programm leer ist. So vermischen sich
  // die Fixture-„Muster TV Titel"-Antraege nicht mit User-importierten echten
  // CSV-Daten (Issue beim v2-Upgrade auf bestehenden Dev-IDBs).
  const programm = await ensureDefaultProgramm(storage.idb);
  const existing = await listAntraegeByProgramm(storage.idb, programm.id);
  let fixtureResult: { csvsImported: number; missingFilenames: string[] } = {
    csvsImported: 0, missingFilenames: [],
  };
  if (existing.length > 0) {
    console.info(
      `[seed] Foerderantraege-Seed übersprungen: Default-Programm enthält bereits ${existing.length} Antraege (vermutlich manueller CSV-Import).`,
    );
  } else {
    fixtureResult = await seedFromFixtureCsvs(storage, programm.id);
  }
  const importedAntraege = await listAntraegeByProgramm(storage.idb, programm.id);
  const total = baseTotal + importedAntraege.length;

  for (const a of importedAntraege) {
    const tags = Array.isArray(a.tags) ? (a.tags as string[]) : [];
    const notes = typeof a.notes === 'string' ? a.notes : '';
    insertDoc({
      id: a.aktenzeichen,
      text: `${a.titel ?? ''} ${a.akronym ?? ''} ${notes} ${tags.join(' ')}`.trim(),
      title: a.titel ?? a.aktenzeichen,
      source: a.aktenzeichen,
      tags: tags.join(','),
      type: 'antrag',
      embedding: emptyVec,
    });
    onProgress?.(++current, total);
  }

  for (const doc of allDokumente) {
    await storage.idb.set(`doc:${doc.id}`, doc);
    insertDoc({
      id: doc.id, text: doc.markdown, title: doc.filename,
      source: doc.filename, tags: doc.tags.join(','),
      type: 'dokument', embedding: emptyVec,
    });
    onProgress?.(++current, total);
  }

  for (const art of artefakteData) {
    await storage.idb.set(`artifact:${art.id}`, art);
    onProgress?.(++current, total);
  }

  await saveOramaToDB(storage.idb);
  await storage.idb.set(SEED_COMPLETE_FLAG, true);

  if (fixtureResult.csvsImported === 0 && existing.length === 0) {
    console.warn(
      '[seed] Foerderantraege-Seed leer — keine Fixture-CSVs gefunden. ' +
      'Lege anonymisierte CSVs unter docs/fixtures/ ab (siehe README).',
    );
  }

  return {
    vorgaenge: bauantraegeData.length + importedAntraege.length,
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

  // Pre-v2 Seeds: handgeschriebene Foerderantraege mit Aktenzeichen FA-2026-XXX.
  // Sind nur noch in alten IDBs vorhanden, der Cleanup ist auf neuen IDBs No-Op.
  for (const az of LEGACY_PRE_V2_AKTENZEICHEN) {
    await deleteAntrag(storage.idb, az).catch(() => undefined);
  }

  // v2 Seeds: Fixture-Schemas entfernen. Die per Schema importierten Antraege
  // werden vom Merger nicht automatisch geloescht — sie bleiben in IDB, bis
  // der naechste Schema-Loesch-Merge auch sie raeumt. Fuer Dev-Reset reicht
  // das, weil seedTestData() beim naechsten Lauf den Default-Programm-Stand
  // ohnehin neu aufbaut.
  for (const schemaId of FIXTURE_SCHEMA_IDS) {
    await removeSchema(storage.idb, schemaId).catch(() => undefined);
  }

  await storage.idb.delete(SEED_COMPLETE_FLAG);
  // Legacy v1-Flag mitlöschen, falls noch in einer Pre-v2-IDB vorhanden.
  await storage.idb.delete('seed-complete');
  await storage.idb.delete('orama-db');
  await storage.idb.delete('search-index');
  await storage.idb.delete('vector-chunks');
  await storage.idb.delete('index-chunk-count');
}
