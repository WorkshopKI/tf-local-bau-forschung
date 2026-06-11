/**
 * Wandelt rohe Orama-Suchtreffer in strukturierte ChatSource-Records, die auf
 * der Assistant-Antwort gespeichert werden (Quellen-Chips, Kontext-Panel,
 * [n]-Zitate, Slide-over). FKZ wird best-effort aus dem Dateinamen geparst.
 */
import type { OramaSearchResult } from '@/core/services/search/orama-store';
import { extractFkz, isValidFkz } from '@/phase2/matcher/fkz-extractor';
import type { ChatSource } from '../types';
import { buildSnippet } from './snippet';

function relevancePercent(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score * 100)));
}

function fkzFromSource(sourcePath: string): string | undefined {
  const hit = extractFkz(sourcePath);
  return hit && isValidFkz(hit.fkz) ? hit.fkz : undefined;
}

/** Häufigster FKZ unter den Quellen (für die Auto-Verknüpfung Konversation↔Antrag). */
export function dominantFkz(sources: ChatSource[]): string | undefined {
  const counts = new Map<string, number>();
  for (const s of sources) {
    if (s.antragFkz) counts.set(s.antragFkz, (counts.get(s.antragFkz) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestN = 0;
  for (const [fkz, n] of counts) {
    if (n > bestN) { best = fkz; bestN = n; }
  }
  return best;
}

export function buildChatSources(results: OramaSearchResult[], query: string): ChatSource[] {
  return results.map((r, i) => {
    const { snippet, contextLine } = buildSnippet(r.text, query);
    const antragFkz = fkzFromSource(r.source);
    return {
      n: i + 1,
      title: r.title || r.source,
      sourcePath: r.source,
      relevance: relevancePercent(r.score),
      method: r.method,
      type: r.type,
      contextLine,
      snippet,
      ...(antragFkz ? { antragFkz } : {}),
    };
  });
}
