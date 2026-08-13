/**
 * Eine CSV-Quelle entfernen — mitsamt dem, was sie am Bestand hinterlässt.
 *
 * `removeSchema` löscht nur den IDB-Record. Direkt nach dem Klick stimmt die
 * Zusage des Dialogs („Re-Import-Konfiguration geht verloren. Importierte
 * Anträge bleiben.") — die Row-Hashes der Quelle bleiben aber als Waisen
 * liegen, und beim nächsten regulären Import einer ANDEREN Quelle baut
 * `recomputeAntragIntoBatch` jeden BERÜHRTEN Antrag komplett aus den
 * verbliebenen Schemas neu auf und streicht dabei die Felder der gelöschten
 * Quelle. Bei genau diesen Anträgen — bei den unberührten nicht.
 *
 * Dasselbe Feld ist danach bei einem Teil der Anträge gefüllt und beim Rest
 * leer, und der Riss wandert mit jedem Nacht-Export weiter; publiziert wird er
 * mit. Der Programm-Lösch-Pfad macht es seit je richtig (Hashes löschen +
 * recomputen) — nur der Quellen-Lösch-Pfad nicht.
 *
 * Aufgeräumt wird nach derselben Löschregel wie beim Import
 * ([loeschregel.ts](../../../core/services/csv/loeschregel.ts)): ein Antrag
 * verschwindet nur, wenn ihn keine verbliebene Quelle mehr trägt.
 */

import type { IDBStore } from '@/core/services/storage/idb-store';
import type { CsvSchema } from '@/core/services/csv/types';
import { removeSchema } from '@/core/services/csv';
import {
  deleteRowHashes, getRowHashesForSchema, listSchemasByProgramm,
} from '@/core/services/csv/idb-csv';
import { teileNachAbdeckung } from '@/core/services/csv/loeschregel';
import { recomputeMultipleBatched } from '@/core/services/csv/merger/batched';
import { removeCsvSourceHandle } from '../csv-source-handle';

export interface QuellenAbraeumung {
  /** Anträge, die es ohne diese Quelle nicht mehr gibt. */
  geloescht: number;
  /** Anträge, die eine andere Quelle weiterträgt — neu zusammengebaut. */
  neuGebaut: number;
}

export async function entferneQuelle(
  idb: IDBStore,
  schema: CsvSchema,
): Promise<QuellenAbraeumung> {
  const hashes = await getRowHashesForSchema(idb, schema.id);
  const az = hashes.map(h => h.join_value);

  await removeSchema(idb, schema.id);
  if (az.length > 0) await deleteRowHashes(idb, schema.id, az);
  await removeCsvSourceHandle(idb, schema.id);

  if (az.length === 0) return { geloescht: 0, neuGebaut: 0 };

  const verbliebene = await listSchemasByProgramm(idb, schema.programm_id);
  const { zuLoeschen, gehalten } = await teileNachAbdeckung(idb, verbliebene, az);
  await recomputeMultipleBatched(idb, schema.programm_id, {
    touchedAz: gehalten,
    removedAz: zuLoeschen,
  });
  return { geloescht: zuLoeschen.length, neuGebaut: gehalten.length };
}
