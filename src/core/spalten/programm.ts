/**
 * Die eine Stelle, an der „welche Felder muss dieses Programm projizieren?"
 * beantwortet wird.
 *
 * **Warum sie existiert:** `putAntraegeListView` ist immer ein VOLLERSATZ. Jeder
 * Pfad, der ein Slim-Item schreibt — Voll-Rebuild, Batch-Import, Einzel-Recompute,
 * Snapshot-Sync — muss denselben Beutel mitschreiben, sonst löscht er ihn für die
 * berührten Anträge. Dieselbe Falle ist bei `kat_status` schon zweimal
 * zugeschnappt; deshalb hier ein gemeinsamer Einstieg statt vier Aufrufketten.
 *
 * Ohne den Flag ist das Ergebnis leer — dann trägt die Projektion kein
 * zusätzliches Feld, und die Tabelle verhält sich exakt wie vorher.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { CsvSchema } from '@/core/services/csv/types';
import { isEigeneSpaltenEnabled } from '@/config/feature-flags';
import { alleFeldRefs } from './ableitung';
import { loeseFreieFelder, type FreiesFeld } from './aufloesung';
import { ladePersoenlicheSpalten } from './store';
import type { EigeneSpalte } from './typen';

/**
 * Alle wirksamen Definitionen — persönlich und (ab Stufe C) Team.
 *
 * Getrennt vom Auflösen, weil der Editor dieselbe Liste braucht, aber ohne
 * Schema-Bezug.
 */
export async function ladeAlleEigenenSpalten(idb: IDBStore): Promise<EigeneSpalte[]> {
  if (!isEigeneSpaltenEnabled()) return [];
  return ladePersoenlicheSpalten(idb);
}

/**
 * Die zu projizierenden Felder für ein Programm — aufgelöst gegen dessen
 * Schemas. Leere Liste = nichts zu tun.
 */
export async function loeseFreieFelderFuer(
  idb: IDBStore, schemas: readonly CsvSchema[],
): Promise<FreiesFeld[]> {
  const spalten = await ladeAlleEigenenSpalten(idb);
  if (spalten.length === 0) return [];
  return loeseFreieFelder(alleFeldRefs(spalten), schemas);
}
