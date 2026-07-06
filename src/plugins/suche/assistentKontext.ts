/**
 * Reine Helfer für den Kontext, den das Assistenten-Panel (Suche, Phase 4) an
 * den Chat anheftet: aus den obersten Suchtreffern wird ein Kontext-Block über
 * den bestehenden `extraContext`-Pfad des Chats gebaut (kein `setConversationFkz`
 * — das ist single-FKZ). Bewusst ohne React/IDB, damit unter `environment:'node'`
 * unit-testbar.
 */
import type { UnifiedSearchResult } from '@/core/types/search-result';

/** Wie viele Top-Treffer maximal in den Kontext-Block wandern. */
export const KONTEXT_MAX_TREFFER = 8;
/** Zeichen-Cap pro Treffer-Snippet, damit der Prompt nicht explodiert. */
const SNIPPET_MAX = 300;

/**
 * Baut den angehefteten Kontext-Block aus den obersten Suchtreffern.
 * Leeres Ergebnis → Leerstring (nichts anheften). Jeder Treffer:
 * „N. Titel (FKZ)\nSnippet".
 */
export function buildTrefferKontext(
  results: UnifiedSearchResult[],
  limit = KONTEXT_MAX_TREFFER,
): string {
  const top = results.slice(0, Math.max(0, limit));
  if (top.length === 0) return '';
  const parts = top.map((r, i) => {
    const fkzTeil = r.fkz ? ` (${r.fkz})` : '';
    const snippet = (r.snippet ?? '').replace(/\s+/g, ' ').trim().slice(0, SNIPPET_MAX);
    return `${i + 1}. ${r.title}${fkzTeil}${snippet ? `\n${snippet}` : ''}`;
  });
  return [
    '\n\n--- Aktuelle Suchtreffer (Kontext) ---',
    ...parts,
    '--- Ende Suchtreffer ---',
    'Beziehe dich bei Bedarf auf diese Treffer.',
  ].join('\n\n');
}

/** Chip-Label über dem Thread. „Suchtreffer" ist im Deutschen numerus-invariant. */
export function kontextChipLabel(n: number): string {
  return `Kontext: ${n} ${n === 1 ? 'Suchtreffer' : 'Suchtreffer'}`;
}
