/**
 * Stufe 4: Merge — keine LLM-Calls.
 *
 * Verbindet Retrieval-Kandidaten (mit Score + AntragListItem) und
 * LLM-Extraktion (dynamische Felder) zu `UnifiedSearchResult[]`.
 */
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { getStatusCategory } from '@/core/utils/status-canonical';
import type { RetrievalCandidate } from './retrieval';
import type { BatchExtractionResult, ExtractionRow } from './batch-extraction';

function makeSnippet(item: RetrievalCandidate['item'], extra: ExtractionRow | undefined): string {
  const parts: string[] = [];
  // Bevorzuge ein extrahiertes Feld (z.B. `foerderzweck`) als Snippet,
  // wenn vorhanden — das ist die LLM-zusammenfassung.
  if (extra) {
    for (const key of ['foerderzweck', 'zusammenfassung', 'kurzbeschreibung', 'beschreibung']) {
      const v = extra.fields[key];
      if (typeof v === 'string' && v.trim().length > 0) {
        return v.length > 300 ? `${v.slice(0, 300)}…` : v;
      }
    }
  }
  if (item.antragsteller) parts.push(item.antragsteller);
  if (item.akronym) parts.push(item.akronym);
  if (item.foerdergeber) parts.push(item.foerdergeber);
  return parts.join(' · ');
}

export function mergeResults(opts: {
  candidates: RetrievalCandidate[];
  extraction: BatchExtractionResult;
  programmNameById: Map<string, string>;
}): UnifiedSearchResult[] {
  const { candidates, extraction, programmNameById } = opts;

  // Dedupe LLM-Rows nach FKZ (LLM koennte einen Antrag in zwei Batches haben).
  const extraByAkz = new Map<string, ExtractionRow>();
  for (const row of extraction.rows) {
    if (!extraByAkz.has(row.aktenzeichen)) extraByAkz.set(row.aktenzeichen, row);
  }

  return candidates.map(c => {
    const extra = extraByAkz.get(c.aktenzeichen);
    const result: UnifiedSearchResult = {
      id: c.aktenzeichen,
      type: 'antrag',
      score: c.score,
      method: 'hybrid',
      title: c.item.titel ?? c.item.akronym ?? c.aktenzeichen,
      snippet: makeSnippet(c.item, extra),
      fkz: c.aktenzeichen,
      programm: programmNameById.get(c.item.programm_id) ?? c.item.programm_id,
      antragsteller: c.item.antragsteller,
      status: c.item.status,
      statusKategorie: c.item.status ? getStatusCategory(c.item.status) : undefined,
      antragsdatum: c.item.antragsdatum,
      kategorie: c.item.branche,
      extraFields: extra?.fields ?? undefined,
    };
    return result;
  });
}
