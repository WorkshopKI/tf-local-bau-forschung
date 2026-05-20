/**
 * Sammelt alle Deskriptor-Werte + ZT-Klartexte eines Antrags als
 * such-/embedding-fertigen Text.
 *
 * Drei Quellen, ge-joined zu einem einzigen String:
 *  1. **TECHN_/BRANCHE_/ANWEND_-Werte** — sind selbst Labels (z.B.
 *     "Bauindustrie", "Leichtbau"). Aus `readAntragDeskriptoren` gesammelt.
 *  2. **ZT-Boolean-Flags** — 44 Spalten (`zt_*_tv` / `zt_*_vb`). Wenn `true`,
 *     kommt der zugehoerige Klartext aus `ZUKUNFTSTECHNOLOGIE_FELDER` rein
 *     (z.B. "Leichtbautechnologien", "Kuenstliche Intelligenz (KI)").
 *  3. Joined per ` • ` als Separator — gut sichtbar in Snippet-Previews
 *     und fuer Embeddings irrelevant (Tokenizer ignoriert Bullet).
 *
 * Reuses bestehende Infrastruktur:
 * - `readAntragDeskriptoren` aus `profil-aggregator.ts`
 * - `ZUKUNFTSTECHNOLOGIE_FELDER` aus `default-labels.ts`
 *
 * Foyer-CSVs speichern Boolean-Spalten heterogen: echtes `true`, `"X"`,
 * `"1"`, `"Ja"` etc. — wir matchen konservativ nur die bekannten
 * Wahr-Varianten. Alle anderen Werte (leer, `"0"`, `"-"`, `false`) gelten
 * als false.
 */
import type { Antrag } from '@/core/services/csv/types';
import { ZUKUNFTSTECHNOLOGIE_FELDER } from '@/plugins/auslastung/services/default-labels';
import { readAntragDeskriptoren } from '@/plugins/auslastung/services/profil-aggregator';

/** Heuristisch erkannte „wahr"-Varianten in Foyer-CSV-Exporten. */
function isTruthyFlag(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (typeof v !== 'string') return false;
  const trimmed = v.trim();
  if (trimmed.length === 0) return false;
  const upper = trimmed.toUpperCase();
  return upper === 'X' || upper === '1' || upper === 'TRUE' || upper === 'JA' || upper === 'Y';
}

export function buildDescriptorsText(antrag: Antrag): string {
  const parts: string[] = [];
  // Kategoriale Werte (TECHN/BRANCHE/ANWEND).
  parts.push(...readAntragDeskriptoren(antrag));
  // ZT-Boolean-Flags → Klartext.
  const rec = antrag as unknown as Record<string, unknown>;
  for (const zt of ZUKUNFTSTECHNOLOGIE_FELDER) {
    if (isTruthyFlag(rec[zt.customField])) parts.push(zt.klartext);
  }
  return parts.join(' • ');
}
