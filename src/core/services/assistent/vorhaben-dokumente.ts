/**
 * Baut die dem Vorhaben (Verbund) zugeordneten Dokument-Zusammenfassungen für den
 * Assistenten-Kontext — REIN & node-testbar. Der Controller lädt die rohen Dokumente
 * (IDB-Scan über die Tag-Relation), diese Funktion filtert/formatiert deterministisch.
 *
 * So „kennt" der Assistent die Antragsdokumente **entitäts-scoped** (über den
 * Verbund-ID-Tag), nicht nur per zufälligem globalem Volltext-Treffer — das setzt das
 * Prinzip „einmal hochladen → überall verfügbar" auch im Assistenten um.
 */
import type { AntragDokumentTyp } from '@/core/services/csv/types';
import type { OramaSearchResult } from '@/core/services/search/orama-store';
import { classifyFkz, typAusTags, typLabelFuerDokument } from '@/core/components/dokumentAufnahmeFkz';
import type { VorhabenDokument } from './kontext/types';

/** Zeichen-Cap je Dokument-Auszug (Prompt-Explosion vermeiden). */
export const VORHABEN_DOK_AUSZUG_MAX = 500;
/** Höchstzahl gelisteter Dokumente (wenige pro Vorhaben; Aufrufer sortiert newest-first). */
export const VORHABEN_DOK_MAX = 12;

export interface RohDokument {
  filename: string;
  markdown: string;
  tags: ReadonlyArray<string>;
}

/** Entfernt einen führenden YAML-Frontmatter-Block (`---\n…\n---`) — pur, kein Plugin-Import. */
function ohneFrontmatter(md: string): string {
  return md.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n+/, '').trim();
}

/**
 * Rohe Dokumente → `VorhabenDokument[]` (nur die mit `verbundId`-Tag). Typ-Label aus der
 * Tag-Relation, Auszug frontmatter-frei + gekappt. Reihenfolge = Eingabereihenfolge
 * (der Aufrufer sortiert newest-first), gekappt auf `VORHABEN_DOK_MAX`.
 */
export function baueVorhabenDokumente(
  docs: ReadonlyArray<RohDokument>, verbundId: string,
): VorhabenDokument[] {
  const out: VorhabenDokument[] = [];
  for (const d of docs) {
    if (!Array.isArray(d.tags) || !d.tags.includes(verbundId)) continue;
    const typ: AntragDokumentTyp = typAusTags(d.tags);
    out.push({
      typLabel: typLabelFuerDokument(typ),
      name: d.filename,
      auszug: ohneFrontmatter(d.markdown).slice(0, VORHABEN_DOK_AUSZUG_MAX),
    });
    if (out.length >= VORHABEN_DOK_MAX) break;
  }
  return out;
}

/** Trägt ein Dokument über seine Tags eine der Kennungen des Vorhabens? */
export function traegtKennung(tags: ReadonlyArray<string>, kennungen: ReadonlyArray<string>): boolean {
  return kennungen.some(k => k.trim().length > 0 && tags.includes(k));
}

/**
 * Nur die Suchtreffer, die zum Vorhaben gehören. Die Volltextsuche selbst kennt
 * keinen Vorgang. Bei „Was ist bei CALYPSO zu tun?" lieferte sie deshalb einen
 * Chunk aus der Anlage 4 von KITED, und der Prompt bot ihn als Beleg `[1]` an.
 *
 * Nach den Tags des Treffers lässt sich nicht filtern: Der Indexlauf schreibt dort
 * `topic_tags`, der DMS-Scan nur das Verzeichnis. Ein Treffer gehört deshalb zum
 * Vorhaben, wenn
 * 1. sein Chunk zu einem über den Tag zugeordneten Dokument gehört (Chunk-Ids sind
 *    `${docId}-…`, der Ablage-Pfad legt die reine `docId` ab), oder
 * 2. sein Dateiname eine der Kennungen trägt. Das ist dieselbe Regel wie in der
 *    Aufnahmefläche (`classifyFkz`) und deckt die DMS-Dateien `16KN… - Datum-Anlage …`.
 */
export function trefferGehoertZumVorhaben(
  treffer: Pick<OramaSearchResult, 'id' | 'source'>,
  kennungen: ReadonlyArray<string>,
  docIds: ReadonlyArray<string>,
): boolean {
  return docIds.some(d => treffer.id === d || treffer.id.startsWith(`${d}-`))
    || classifyFkz(treffer.source ?? '', [...kennungen]).matchedId !== null;
}

/** `trefferGehoertZumVorhaben` über eine Trefferliste — die Reihenfolge der Suche bleibt. */
export function trefferDesVorhabens(
  treffer: ReadonlyArray<OramaSearchResult>,
  kennungen: ReadonlyArray<string>,
  docIds: ReadonlyArray<string>,
): OramaSearchResult[] {
  return treffer.filter(t => trefferGehoertZumVorhaben(t, kennungen, docIds));
}
