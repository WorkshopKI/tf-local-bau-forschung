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
import { resolveVb } from '@/plugins/antraege/kurzfassung/vbDokument';
import { normId } from '@/core/components/dokumentAufnahmeFkz';

export { resolveVb, type VbAufloesung } from '@/plugins/antraege/kurzfassung/vbDokument';

/** Dateiname/Titel matcht „Anlage 5" (Varianten mit Space/Underscore/Punkt/Bindestrich). */
const ANLAGE5_RE = /anlage[\s_.-]*5(?!\d)/i;

/**
 * Ordnet einen Dateinamen dem Teilvorhaben zu, dessen Aktenzeichen (normalisiert)
 * als Substring im Dateinamen steckt. Matcht NUR gegen TV-Aktenzeichen (nicht gegen
 * die Verbund-ID) — so gewinnt bei „Verbund- UND TV-FKZ im Namen" das TV. Bei
 * Präfix-Kollision (ein Az ist Präfix eines anderen) gewinnt das längste. Rein.
 */
export function matchTvAusDateiname(filename: string, tvAzListe: string[]): string | null {
  const hay = normId(filename);
  let best: string | null = null;
  for (const az of tvAzListe) {
    const n = normId(az);
    if (n.length > 0 && hay.includes(n) && (best === null || n.length > normId(best).length)) best = az;
  }
  return best;
}

export interface AnlageAufloesung {
  markdown: string;
  herkunft: 'idb' | 'ordner';
  quelleName: string;
}

/** Tag, mit dem der Uploader ein Marketing-/Verwertungskonzept klassifiziert. */
const MARKETING_TAG = 'marketingkonzept';

/**
 * IDB: Dokumente mit FKZ-Tag, die als Anlage 5 zählen — per Typ-Tag `'arbeitsplan'`
 * (vom Uploader klassifiziert) ODER per Dateiname-Muster (Fallback für unklassifizierte
 * Uploads); jüngstes gewinnt.
 */
async function findeAnlage5Idb(idb: IDBStore, fkz: string): Promise<DocumentFull | null> {
  const keys = await idb.keys('doc:');
  const treffer: DocumentFull[] = [];
  for (const key of keys) {
    const doc = await idb.get<DocumentFull>(key);
    if (!doc) continue;
    const tags = Array.isArray(doc.tags) ? doc.tags : [];
    if (tags.includes(fkz) && (tags.includes('arbeitsplan') || ANLAGE5_RE.test(doc.filename ?? ''))) treffer.push(doc);
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

/** Ergebnis der Multi-Auflösung: Anlage 5 je TV + nicht zuordenbare Dokumente. */
export interface AnlagenProTvErgebnis {
  proTv: Map<string, AnlageAufloesung>;
  /** Dateinamen von Anlage-5-Dokumenten ohne erkennbares TV-FKZ. */
  unzugeordnet: string[];
}

/**
 * Löst pro Teilvorhaben die (jüngste) Anlage 5 aus dem IDB-Dokumentenspeicher auf.
 * Ein `doc:`-Scan; Kandidat = mit `verbundKey` getaggt UND (Tag `'arbeitsplan'` ODER
 * Dateiname matcht `ANLAGE5_RE`); Zuordnung per `matchTvAusDateiname`. IDB-only
 * (Verbund-Intake läuft über die Inline-Aufnahme); der persönliche Ordner-Fallback
 * bleibt dem Solo-`resolveAnlage5` vorbehalten.
 */
export async function resolveAnlagenProTv(
  idb: IDBStore, verbundKey: string, tvAzListe: string[],
): Promise<AnlagenProTvErgebnis> {
  const keys = await idb.keys('doc:');
  const juengste = new Map<string, DocumentFull>();
  const unzugeordnet: string[] = [];
  for (const key of keys) {
    const doc = await idb.get<DocumentFull>(key);
    if (!doc) continue;
    const tags = Array.isArray(doc.tags) ? doc.tags : [];
    if (!tags.includes(verbundKey)) continue;
    const istAnlage = tags.includes('arbeitsplan') || ANLAGE5_RE.test(doc.filename ?? '');
    if (!istAnlage) continue;
    const tv = matchTvAusDateiname(doc.filename ?? '', tvAzListe);
    if (!tv) { unzugeordnet.push(doc.filename); continue; }
    const bisher = juengste.get(tv);
    if (!bisher || (doc.created ?? '').localeCompare(bisher.created ?? '') > 0) juengste.set(tv, doc);
  }
  const proTv = new Map<string, AnlageAufloesung>();
  for (const [tv, doc] of juengste) {
    proTv.set(tv, { markdown: doc.markdown, herkunft: 'idb', quelleName: doc.filename });
  }
  return { proTv, unzugeordnet };
}

/** Ein Dokument im narrativen Aufbereitungs-Korpus (Name + Volltext). */
export interface KorpusDok {
  name: string;
  markdown: string;
}

/** Aufgelöster Korpus: VB (Präfix) + narrative Zusatzdokumente + der zusammengeführte Text. */
export interface KorpusAufloesung {
  vb: KorpusDok;
  narrative: KorpusDok[];
  /** VB-Markdown, gefolgt von quellenmarkierten narrativen Abschnitten. */
  markdown: string;
}

/**
 * IDB: alle FKZ-getaggten Dokumente, die der Uploader als Marketing-/Verwertungs-
 * konzept (`'marketingkonzept'`) klassifiziert hat — chronologisch (stabiler Korpus).
 */
export async function resolveNarrativeDocs(
  idb: IDBStore, ctx: { key: string },
): Promise<KorpusDok[]> {
  const keys = await idb.keys('doc:');
  const treffer: DocumentFull[] = [];
  for (const key of keys) {
    const doc = await idb.get<DocumentFull>(key);
    if (!doc) continue;
    const tags = Array.isArray(doc.tags) ? doc.tags : [];
    if (tags.includes(ctx.key) && tags.includes(MARKETING_TAG)) treffer.push(doc);
  }
  treffer.sort((a, b) =>
    (a.created ?? '').localeCompare(b.created ?? '') || (a.filename ?? '').localeCompare(b.filename ?? ''));
  return treffer.map(d => ({ name: d.filename, markdown: d.markdown }));
}

/**
 * Reine Zusammenführung: VB (Präfix — dadurch bleiben alle VB-Sektions-Offsets/-IDs
 * identisch) + je narrativem Dokument ein quellenmarkierter, per `---` getrennter
 * Abschnitt. Ohne narrative Dokumente byte-identisch zum VB-Markdown.
 */
export function baueKorpus(vb: KorpusDok, narrative: KorpusDok[]): string {
  if (narrative.length === 0) return vb.markdown;
  let out = vb.markdown;
  for (const d of narrative) out += `\n\n---\n\n## [Quelle: ${d.name}]\n\n${d.markdown}`;
  return out;
}

/**
 * Korpus auflösen: VB (Pflicht — ohne VB null, wie `resolveVb`) + narrative
 * Zusatzdokumente. Die freitextlichen LLM-Bausteine + der Lesemodus arbeiten auf
 * `markdown` (VB + Marketing als EINE Einheit) — so ist das Ergebnis unabhängig
 * davon, ob ein Inhalt in der VB oder in einem Extra-Dokument steht.
 */
export async function resolveKorpus(
  idb: IDBStore, ctx: { key: string; knownIds: string[] },
): Promise<KorpusAufloesung | null> {
  const vbA = await resolveVb(idb, ctx);
  if (!vbA) return null;
  const vb: KorpusDok = {
    name: vbA.quelleName ?? vbA.dokument?.filename ?? 'Vorhabensbeschreibung',
    markdown: vbA.markdown,
  };
  const narrative = await resolveNarrativeDocs(idb, ctx);
  return { vb, narrative, markdown: baueKorpus(vb, narrative) };
}
