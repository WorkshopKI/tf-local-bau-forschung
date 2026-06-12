/**
 * Reiner Diff-Helfer für den Vorfassungs-Vergleich (testbar ohne React/IDB —
 * gleiches Muster wie kurzfassung-verlauf.ts). Kapselt `diff-match-patch`
 * (bereits Dependency, `file://`-tauglich — siehe [src/ui/DiffView.tsx]).
 *
 * Konvention der Op-Codes (diff-match-patch):
 *   -1 = nur in `alt` (Löschung), 0 = unverändert, +1 = nur in `neu` (Einfügung).
 * Die „aktuelle"-Spalte rendert `op !== -1` (Gleiches + Einfügungen), die
 * „Vorfassungs"-Spalte `op !== 1` (Gleiches + Löschungen) — so steht links die
 * aktuelle Fassung mit hervorgehobenen Neuerungen, rechts die gewählte
 * Vorfassung mit hervorgehobenen Entfernungen.
 */
import DiffMatchPatch from 'diff-match-patch';

export type DiffOp = [number, string];

const dmp = new DiffMatchPatch();

/**
 * Diff zwischen einer früheren (`alt`) und der aktuellen (`neu`) Fassung.
 * `diff_cleanupSemantic` macht die Segmente lesbar (Wort-/Satz-nah statt
 * zeichenweise zerhackt).
 */
export function computeFinalerTextDiff(alt: string, neu: string): DiffOp[] {
  const diffs = dmp.diff_main(alt, neu);
  dmp.diff_cleanupSemantic(diffs);
  return diffs as DiffOp[];
}

/** Anzahl hinzugefügter / entfernter Zeichen (für die Diff-Legende). */
export function diffStats(diffs: DiffOp[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const [op, text] of diffs) {
    if (op === 1) added += text.length;
    else if (op === -1) removed += text.length;
  }
  return { added, removed };
}
