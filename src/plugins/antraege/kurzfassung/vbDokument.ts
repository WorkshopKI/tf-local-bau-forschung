/**
 * Findet die Vorhabensbeschreibung (VB) eines Antrags über die FKZ-Tag-Relation
 * im Dokumente-Store. Die VB wird von der Dokumenten-Aufnahmefläche mit
 * `tags:[fkz, 'vorhabensbeschreibung']` abgelegt.
 *
 * Der Tag-Scan selbst liegt im Dokumente-Store (`listDocsByTag`) — er besitzt den
 * `doc:`-Keyspace und teilt die Implementierung mit der Aufnahmefläche.
 */
import type { IDBStore } from '@/core/services/storage';
import { listDocsByTag, type DocumentFull } from '@/plugins/dokumente/store';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { readVbAusOrdner, type OrdnerVb } from '@/core/services/personal-storage/antraege-eingang';
import { vbAuswahlPath } from '@/core/services/personal-storage/personal-layout';
import {
  mirrorJsonToPersonal, hydrateJsonFromPersonal, removePersonalMirror,
} from '@/core/services/personal-storage/state-mirror';
import type { KurzfassungContext } from './types';

const VB_TAG = 'vorhabensbeschreibung';

/** Alle Dokumente, die über den FKZ-/Verbund-Tag zu diesem Antrag gehören. */
export async function listDocsByFkz(idb: IDBStore, fkz: string): Promise<DocumentFull[]> {
  return listDocsByTag(idb, fkz);
}

/** Die VB-getaggten Dokumente des Antrags — je nach Upload-Historie mehrere. */
export async function listVbKandidaten(idb: IDBStore, fkz: string): Promise<DocumentFull[]> {
  return (await listDocsByFkz(idb, fkz)).filter(d => d.tags.includes(VB_TAG));
}

/**
 * Welche VB gilt? REIN, damit die Regel testbar ist (sie entscheidet, welcher Text
 * ins Gutachten geht).
 *
 * Der explizite Pick des Bearbeiters gewinnt, aber nur wenn das Dokument noch
 * existiert UND noch VB-getaggt ist — sonst (gelöscht, umgetaggt) still auf
 * „jüngstes" zurück, nie ein Fehler.
 *
 * Ohne Pick: jüngstes zuerst. Sekundär nach Dateiname, weil `created` bei
 * gleichzeitig aufgenommenen Dateien millisekundengleich sein kann und die
 * Reihenfolge dann Engine-Sache wäre — in einer Förderprüfung ist ein
 * nichtdeterministisch gewähltes Quelldokument der schlechtere Zustand.
 */
export function pickAktiveVb(
  vbKandidaten: readonly DocumentFull[], gewaehlteDocId: string | null,
): DocumentFull | null {
  if (vbKandidaten.length === 0) return null;
  if (gewaehlteDocId) {
    const gewaehlt = vbKandidaten.find(d => d.id === gewaehlteDocId);
    if (gewaehlt) return gewaehlt;
  }
  const sortiert = [...vbKandidaten].sort((a, b) =>
    (b.created ?? '').localeCompare(a.created ?? '') || (a.filename ?? '').localeCompare(b.filename ?? ''));
  return sortiert[0] ?? null;
}

/** Persistierte Wahl der maßgeblichen VB — Verbund-Ebene, von allen Artefakten geteilt. */
export interface VbAuswahlRecord {
  key: string;
  docId: string;
  geaendert_am: string;
}

export const vbAuswahlKey = (key: string): string => `vb-auswahl:${key}`;

// IDB primär + JSON-Spiegel im persönlichen Ordner (Profil des Workflow-Stores):
// Exact-Key-Lookup im `kv`, KEIN eigener Object-Store/Version-Bump (Pitfall #29).
export async function getVbAuswahl(idb: IDBStore, key: string): Promise<VbAuswahlRecord | null> {
  const fromIdb = await idb.get<VbAuswahlRecord>(vbAuswahlKey(key));
  if (fromIdb) return fromIdb;
  const fromDisk = await hydrateJsonFromPersonal<VbAuswahlRecord>(idb, vbAuswahlPath(key));
  if (fromDisk) {
    await idb.set(vbAuswahlKey(key), fromDisk); // IDB seeden → nur 1× Disk-Read
    return fromDisk;
  }
  return null;
}

export async function setVbAuswahl(idb: IDBStore, key: string, docId: string): Promise<void> {
  const record: VbAuswahlRecord = { key, docId, geaendert_am: new Date().toISOString() };
  await idb.set(vbAuswahlKey(key), record);
  await mirrorJsonToPersonal(idb, vbAuswahlPath(key), record);
}

export async function clearVbAuswahl(idb: IDBStore, key: string): Promise<void> {
  await idb.delete(vbAuswahlKey(key));
  await removePersonalMirror(idb, vbAuswahlPath(key));
}

/**
 * Liefert die maßgebliche VB des Antrags oder null: expliziter Pick des Bearbeiters,
 * sonst die zuletzt aufgenommene. Signatur unverändert — alle Konsumenten (Gutachten,
 * Kurzfassung, NF, Batch, Aufbereitung, SkillTestlauf) erben den Pick ohne Änderung.
 */
export async function findVorhabensbeschreibung(idb: IDBStore, fkz: string): Promise<DocumentFull | null> {
  const [kandidaten, auswahl] = await Promise.all([listVbKandidaten(idb, fkz), getVbAuswahl(idb, fkz)]);
  return pickAktiveVb(kandidaten, auswahl?.docId ?? null);
}

/** Aufgelöste VB mit Herkunft (IDB-Index ODER persönlicher Ordner, Teil A). */
export interface VbAufloesung {
  markdown: string;
  herkunft: 'idb' | 'ordner';
  /** Nur bei `herkunft: 'idb'` gesetzt (für UI, die den IDB-Doc-Record braucht). */
  dokument: DocumentFull | null;
  /** Originaldateiname bei `herkunft: 'ordner'`. */
  quelleName?: string;
}

/**
 * Reine Auswahlregel: IDB hat VORRANG, Ordner ist Fallback. Byte-identisch zum
 * bisherigen Verhalten, wenn ein IDB-Treffer existiert.
 */
export function pickVb(idbDoc: DocumentFull | null, ordnerVb: OrdnerVb | null): VbAufloesung | null {
  if (idbDoc) return { markdown: idbDoc.markdown, herkunft: 'idb', dokument: idbDoc };
  if (ordnerVb) return { markdown: ordnerVb.markdown, herkunft: 'ordner', dokument: null, quelleName: ordnerVb.quelle };
  return null;
}

/**
 * VB-Auflösung mit IDB-VORRANG + Ordner-Fallback (A4). Scannt bei IDB-Miss den
 * persönlichen Ordner über alle `ctx.knownIds`. Für Nutzer mit indexierter VB
 * byte-identisch (der Fallback feuert nur bei IDB=null).
 */
export async function resolveVb(
  idb: IDBStore,
  ctx: Pick<KurzfassungContext, 'key' | 'knownIds'>,
): Promise<VbAufloesung | null> {
  const idbDoc = await findVorhabensbeschreibung(idb, ctx.key);
  if (idbDoc) return pickVb(idbDoc, null);
  const persHandle = await getPersoenlichHandle(idb).catch(() => null);
  const ordnerVb = persHandle ? await readVbAusOrdner(persHandle, ctx.knownIds) : null;
  return pickVb(null, ordnerVb);
}
