/**
 * Helper fuer Parent-Inheritance beim Scan-Pfad-Picker.
 *
 * Logik: ein selektierter Pfad deckt rekursiv alle seine Kinder ab — der
 * Walker ist sowieso rekursiv. Damit die UI nicht doppelte Roots zeigt und
 * der Scanner nicht doppelt traversiert, deduplizieren wir Children, deren
 * Parent in der Liste steht.
 *
 * Sonderfall: '' (leerer String) bedeutet "ganzer Handle" und ist Vorgaenger
 * von allem.
 */

function isAncestor(ancestor: string, path: string): boolean {
  if (ancestor === '') return path !== '';            // '' deckt alles ausser sich selbst
  if (ancestor === path) return false;                 // strikte Vorfahren-Pruefung
  return path.startsWith(ancestor + '/');
}

/**
 * Liefert den ersten in `selected` gefundenen Vorfahr von `path`, oder null.
 * Reine Iteration — bei wenigen ausgewaehlten Pfaden (typisch <20) ist das
 * schneller als Set-Lookups mit String-Manipulation.
 */
export function findCoveringParent(
  path: string,
  selected: Iterable<string>,
): string | null {
  for (const s of selected) {
    if (isAncestor(s, path)) return s;
  }
  return null;
}

/**
 * Pfad ist gedeckt, wenn er selbst oder ein Vorfahr in `selected` liegt.
 */
export function isPathCovered(path: string, selected: Iterable<string>): boolean {
  for (const s of selected) {
    if (s === path) return true;
    if (isAncestor(s, path)) return true;
  }
  return false;
}

/**
 * Entfernt redundante Children: Pfade deren Parent in der Liste steht.
 * Sonderfall: enthaelt die Liste '' (ganzer Handle), wird alles andere
 * verworfen. Trim wird angewendet, exakte Doubletten werden entfernt.
 *
 * Stable-Sort: kuerzeste Pfade zuerst (deterministische Walker-Reihenfolge).
 */
export function dedupeWithInheritance(paths: string[]): string[] {
  const trimmed = paths.map(p => p.trim());
  const unique = Array.from(new Set(trimmed));
  if (unique.includes('')) return [''];

  // Kuerzeste Pfade zuerst — dann sind beim Filtern alle moeglichen Parents
  // schon im result-Array.
  const byDepth = [...unique].sort((a, b) => {
    const da = a.split('/').length;
    const db = b.split('/').length;
    if (da !== db) return da - db;
    return a.localeCompare(b);
  });

  const result: string[] = [];
  for (const p of byDepth) {
    const covered = result.some(r => isAncestor(r, p));
    if (!covered) result.push(p);
  }
  return result;
}
