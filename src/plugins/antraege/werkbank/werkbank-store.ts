/**
 * Persistenz der Werkbank-Punkte im generischen `kv`-Store unter
 * `werkbank-punkte:<verbund-az>` — Profil des Kurzfassung-/Workflow-Stores:
 * Exact-Key-Lookup, KEIN dedizierter Object-Store/Version-Bump (ein Bump triggert
 * unter `file://` mit parallel offenen Varianten ein `onblocked`-Upgrade).
 *
 * Rein gerätelokaler Arbeitszustand — kein Share-/Snapshot-/Personal-Mirror-Write.
 * Die Punkte sind der offene Arbeitsvorrat EINES Prüfers; sie gehören nicht in die
 * team-weit geteilten Daten.
 */
import type { IDBStore } from '@/core/services/storage';
import type { WerkbankPunkt, WerkbankRecord } from './types';

const keyFor = (verbundAz: string): string => `werkbank-punkte:${verbundAz}`;

/** Tolerantes Lesen (fremde/kaputte Einträge → leer statt Fehler). */
function normalize(raw: unknown, verbundAz: string): WerkbankRecord {
  const leer: WerkbankRecord = { verbundAz, punkte: [], schemaVersion: 1 };
  if (typeof raw !== 'object' || raw === null) return leer;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.punkte)) return leer;
  const punkte = r.punkte.filter((p): p is WerkbankPunkt =>
    typeof p === 'object' && p !== null
    && typeof (p as WerkbankPunkt).key === 'string'
    && typeof (p as WerkbankPunkt).text === 'string');
  return { verbundAz, punkte, schemaVersion: 1 };
}

export async function ladeWerkbank(idb: IDBStore, verbundAz: string): Promise<WerkbankRecord> {
  return normalize(await idb.get(keyFor(verbundAz)), verbundAz);
}

export async function speichereWerkbank(idb: IDBStore, record: WerkbankRecord): Promise<void> {
  await idb.set(keyFor(record.verbundAz), record);
}
