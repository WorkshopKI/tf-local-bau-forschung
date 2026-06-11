/**
 * Findet die Vorhabensbeschreibung (VB) eines Antrags über die FKZ-Tag-Relation
 * im Dokumente-Store. Die VB wird von der Dokumenten-Aufnahmefläche mit
 * `tags:[fkz, 'vorhabensbeschreibung']` abgelegt.
 *
 * Scan über alle `doc:*`-Keys — akzeptabel, weil pro Antrag nur wenige Dokumente
 * vom Gutachter aufgenommen werden (kein 13k-Massendatensatz). Eine spätere
 * Generalisierung könnte einen Tag-Index ziehen.
 */
import type { IDBStore } from '@/core/services/storage';
import type { DocumentFull } from '@/plugins/dokumente/store';

const VB_TAG = 'vorhabensbeschreibung';

async function listDocsByFkz(idb: IDBStore, fkz: string): Promise<DocumentFull[]> {
  const keys = await idb.keys('doc:');
  const out: DocumentFull[] = [];
  for (const key of keys) {
    const doc = await idb.get<DocumentFull>(key);
    if (!doc) continue;
    const tags = Array.isArray(doc.tags) ? doc.tags : [];
    if (tags.includes(fkz)) out.push(doc);
  }
  return out;
}

/** Liefert die zuletzt aufgenommene VB des Antrags oder null. */
export async function findVorhabensbeschreibung(idb: IDBStore, fkz: string): Promise<DocumentFull | null> {
  const docs = (await listDocsByFkz(idb, fkz)).filter(d => d.tags.includes(VB_TAG));
  if (docs.length === 0) return null;
  docs.sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''));
  return docs[0] ?? null;
}
