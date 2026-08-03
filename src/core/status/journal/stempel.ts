/**
 * Der **Stempel** eines Exports — die Idempotenz-Grundlage des Journals.
 *
 * Gehasht werden die **Bytes** der Datei, nicht der dekodierte Text: gleiche
 * Aussage über Gleichheit, ohne einen 50-MB-String durch den Speicher zu
 * schieben. Zwölf Hex-Stellen (48 Bit) reichen: verglichen wird gegen die
 * letzten 400 Stempel, nicht gegen ein globales Universum.
 *
 * Wozu: ein unveränderter Export — Wochenende, zweiter Rechner, erneuter Lauf
 * am selben Tag — hat dieselbe `id`, und der Lauf endet, bevor er anfängt.
 */
import { sha256Hex } from '@/core/services/csv/sha256';
import type { Stempel } from './typen';

/** Wie viele Hex-Stellen die Id trägt. */
export const STEMPEL_LAENGE = 12;

/** ISO-Tag aus einem Zeitstempel in Millisekunden. */
export function alsIsoTag(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Stempel einer Export-Datei.
 *
 * `lastModified` statt „jetzt": das Journal datiert den EXPORT, nicht den
 * Import. Auf einem zweiten Rechner, der die Datei einen Tag später einliest,
 * stünde sonst ein falsches Datum an denselben Änderungen.
 */
export async function berechneStempel(datei: Blob & { lastModified?: number }): Promise<Stempel> {
  const hex = await sha256Hex(datei);
  return {
    id: hex.slice(0, STEMPEL_LAENGE),
    datum: alsIsoTag(datei.lastModified ?? Date.now()),
  };
}
