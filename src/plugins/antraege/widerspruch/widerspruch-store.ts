/**
 * Persistenz des Widerspruchs-Abgleichs im `kv`-Store unter `widerspruch:<verbund-az>`
 * — Profil des Werkbank-/Kurzfassung-Stores (Exact-Key, kein Object-Store/Version-Bump).
 * Rein gerätelokaler Arbeitszustand (kein Share/Mirror), wie die Werkbank-Punkte.
 */
import type { IDBStore } from '@/core/services/storage';
import type { WiderspruchPunkt, WiderspruchRecord } from './types';

const keyFor = (verbundAz: string): string => `widerspruch:${verbundAz}`;

function normalize(raw: unknown, verbundAz: string): WiderspruchRecord {
  const leer: WiderspruchRecord = { verbundAz, punkte: [], schemaVersion: 1 };
  if (typeof raw !== 'object' || raw === null) return leer;
  const r = raw as Record<string, unknown>;
  const punkte = Array.isArray(r.punkte)
    ? r.punkte.filter((p): p is WiderspruchPunkt => typeof p === 'object' && p !== null && typeof (p as WiderspruchPunkt).punktKey === 'string')
    : [];
  const rec: WiderspruchRecord = { verbundAz, punkte, schemaVersion: 1 };
  if (typeof r.stellungnahmeDocId === 'string' && r.stellungnahmeDocId) rec.stellungnahmeDocId = r.stellungnahmeDocId;
  return rec;
}

export async function ladeWiderspruch(idb: IDBStore, verbundAz: string): Promise<WiderspruchRecord> {
  return normalize(await idb.get(keyFor(verbundAz)), verbundAz);
}

export async function speichereWiderspruch(idb: IDBStore, record: WiderspruchRecord): Promise<void> {
  await idb.set(keyFor(record.verbundAz), record);
}
