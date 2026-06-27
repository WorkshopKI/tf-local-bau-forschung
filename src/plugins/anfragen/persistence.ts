/**
 * Persistenz einer `Anfrage` im generischen `kv`-Store unter `anfrage:<id>` —
 * exakt das Profil des WorkflowRun-/Dokumente-Stores: Exact-Key-Lookup, KEIN
 * dedizierter Object-Store/Version-Bump (ein Bump triggert unter file:// mit
 * parallel offenen Varianten ein `onblocked`-Upgrade, siehe
 * recurring-bug-classes.md §3). Backward-compatible: rein additive Keys, kein
 * Bruch bestehender Stores.
 */
import type { IDBStore } from '@/core/services/storage';
import { uuid } from '@/core/services/id-generator';
import type { Anfrage } from './types';

const KEY_PREFIX = 'anfrage:';
const keyFor = (id: string): string => `${KEY_PREFIX}${id}`;

/** Pflichtfelder bei der Erstaufnahme; alle Folgefelder starten leer/neutral. */
export interface AnfrageInit {
  absenderEmail: string;
  betreff: string;
  hatAnhaenge: number;
  originalMd: string;
}

/** Frische `Anfrage` im Status `aufgenommen`. `now` injizierbar für Tests. */
export function createAnfrage(init: AnfrageInit, now: string = new Date().toISOString()): Anfrage {
  return {
    id: uuid(),
    status: 'aufgenommen',
    absenderEmail: init.absenderEmail,
    betreff: init.betreff,
    hatAnhaenge: init.hatAnhaenge,
    originalMd: init.originalMd,
    anonymisiertMd: '',
    mapping: [],
    verallgemeinerungen: [],
    externeAntwortAnon: '',
    finaleAntwort: '',
    erstelltAm: now,
    geaendertAm: now,
  };
}

/**
 * Macht einen aus dem Store gelesenen Record migrationssicher: rein additive
 * Felder (`verallgemeinerungen`, defensiv `mapping`) defaulten auf `[]`, damit
 * Alt-Records ohne diese Felder beim Lesen nicht crashen.
 */
function normalizeAnfrage(raw: Anfrage): Anfrage {
  return {
    ...raw,
    mapping: raw.mapping ?? [],
    verallgemeinerungen: raw.verallgemeinerungen ?? [],
  };
}

export async function putAnfrage(idb: IDBStore, a: Anfrage): Promise<void> {
  await idb.set(keyFor(a.id), a);
}

export async function getAnfrage(idb: IDBStore, id: string): Promise<Anfrage | null> {
  const raw = await idb.get<Anfrage>(keyFor(id));
  return raw ? normalizeAnfrage(raw) : null;
}

export async function listAnfragen(idb: IDBStore): Promise<Anfrage[]> {
  const entries = await idb.entries(KEY_PREFIX);
  const out: Anfrage[] = [];
  for (const [, value] of entries) {
    if (value && typeof value === 'object') out.push(normalizeAnfrage(value as Anfrage));
  }
  // Neueste zuerst (stabile Sortierung über erstelltAm).
  out.sort((a, b) => (b.erstelltAm ?? '').localeCompare(a.erstelltAm ?? ''));
  return out;
}

export async function deleteAnfrage(idb: IDBStore, id: string): Promise<void> {
  await idb.delete(keyFor(id));
}
