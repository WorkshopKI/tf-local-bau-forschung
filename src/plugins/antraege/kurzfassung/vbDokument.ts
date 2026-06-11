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
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { readVbAusOrdner, type OrdnerVb } from '@/core/services/personal-storage/antraege-eingang';
import type { KurzfassungContext } from './types';

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
