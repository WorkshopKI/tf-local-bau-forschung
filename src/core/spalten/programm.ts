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
import { ladeTeamSpalten } from './team-store';
import type { EigeneSpalte } from './typen';

/**
 * Alle wirksamen Definitionen — die des Teams und die eigenen.
 *
 * **Team zuerst**: die Reihenfolge entscheidet, in welcher Folge die Spalten im
 * Picker unter ihren Rubriken stehen. Für die Projektion ist sie belanglos —
 * `alleFeldRefs` sortiert, damit die Signatur nicht von der Ladereihenfolge
 * abhängt.
 *
 * Kollisionen gibt es strukturell nicht: die Herkunft steckt in der Id, und
 * beide Ablagen filtern beim Lesen auf ihre eigene (siehe `nurHerkunft`).
 *
 * Getrennt vom Auflösen, weil der Editor dieselbe Liste braucht, aber ohne
 * Schema-Bezug.
 */
export async function ladeAlleEigenenSpalten(idb: IDBStore): Promise<EigeneSpalte[]> {
  if (!isEigeneSpaltenEnabled()) return [];
  const [team, ich] = await Promise.all([
    ladeTeamSpalten(idb).catch(() => []),
    ladePersoenlicheSpalten(idb).catch(() => []),
  ]);
  return [...team, ...ich];
}

/**
 * Die zu projizierenden Felder für ein Programm — aufgelöst gegen dessen
 * Schemas. Leere Liste = nichts zu tun.
 *
 * Wer über MEHRERE Programme läuft, lädt die Definitionen einmal
 * (`ladeAlleEigenenSpalten`) und reicht sie herein: sonst liest jede Runde die
 * Team-Sidecar erneut vom Share.
 */
export async function loeseFreieFelderFuer(
  idb: IDBStore, schemas: readonly CsvSchema[], vorgeladen?: readonly EigeneSpalte[],
): Promise<FreiesFeld[]> {
  const spalten = vorgeladen ?? await ladeAlleEigenenSpalten(idb);
  if (spalten.length === 0) return [];
  return loeseFreieFelder(alleFeldRefs(spalten), schemas);
}
