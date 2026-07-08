/**
 * Quell-Auflösung für die Antrag-Aufbereitung: VB (wiederverwendet) + Anlage 5
 * (neu, analog zum VB-Muster). Beides IDB-Vorrang + persönlicher Ordner-Fallback.
 */
import type { IDBStore } from '@/core/services/storage';
import type { DocumentFull } from '@/plugins/dokumente/store';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { readText, listFilesWithBackupInfo } from '@/core/services/infrastructure/atomic-write';
import { dokumenteDir } from '@/core/services/personal-storage/personal-layout';
import { parseFrontmatter } from '@/plugins/antraege/aufnahme-einfach/frontmatter';

export { resolveVb, type VbAufloesung } from '@/plugins/antraege/kurzfassung/vbDokument';

/** Dateiname/Titel matcht „Anlage 5" (Varianten mit Space/Underscore/Punkt/Bindestrich). */
const ANLAGE5_RE = /anlage[\s_.-]*5(?!\d)/i;

export interface AnlageAufloesung {
  markdown: string;
  herkunft: 'idb' | 'ordner';
  quelleName: string;
}

/** IDB: Dokumente mit FKZ-Tag, deren `filename` auf Anlage 5 matcht (jüngstes gewinnt). */
async function findeAnlage5Idb(idb: IDBStore, fkz: string): Promise<DocumentFull | null> {
  const keys = await idb.keys('doc:');
  const treffer: DocumentFull[] = [];
  for (const key of keys) {
    const doc = await idb.get<DocumentFull>(key);
    if (!doc) continue;
    const tags = Array.isArray(doc.tags) ? doc.tags : [];
    if (tags.includes(fkz) && ANLAGE5_RE.test(doc.filename ?? '')) treffer.push(doc);
  }
  treffer.sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''));
  return treffer[0] ?? null;
}

/** Ordner-Fallback: `.md` in `dokumente/` über alle knownIds, Frontmatter-`quelle` matcht Anlage 5. */
async function leseAnlage5AusOrdner(
  root: FileSystemDirectoryHandle, knownIds: string[],
): Promise<{ markdown: string; quelle: string } | null> {
  for (const id of knownIds) {
    const dir = dokumenteDir(id);
    const namen = (await listFilesWithBackupInfo(root, dir)).map(f => f.name);
    for (const name of namen) {
      if (!name.endsWith('.md')) continue;
      const raw = await readText(root, `${dir}/${name}`);
      if (!raw) continue;
      const parsed = parseFrontmatter(raw);
      if (parsed && ANLAGE5_RE.test(parsed.meta.quelle)) {
        return { markdown: parsed.body, quelle: parsed.meta.quelle };
      }
    }
  }
  return null;
}

/** Anlage 5 auflösen: IDB-Vorrang, dann persönlicher Ordner. */
export async function resolveAnlage5(
  idb: IDBStore, ctx: { key: string; knownIds: string[] },
): Promise<AnlageAufloesung | null> {
  const idbDoc = await findeAnlage5Idb(idb, ctx.key);
  if (idbDoc) return { markdown: idbDoc.markdown, herkunft: 'idb', quelleName: idbDoc.filename };
  const root = await getPersoenlichHandle(idb).catch(() => null);
  const ordner = root ? await leseAnlage5AusOrdner(root, ctx.knownIds) : null;
  if (ordner) return { markdown: ordner.markdown, herkunft: 'ordner', quelleName: ordner.quelle };
  return null;
}
