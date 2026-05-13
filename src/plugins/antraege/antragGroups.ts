import type { AntragListItem } from '@/core/services/csv/types';

/**
 * Gruppe von Anträgen für die kompakte Listendarstellung. Eine Gruppe ist
 * entweder ein Verbund (1+ TVs mit gleicher `verbund_id`) oder ein
 * Einzelantrag (kein `verbund_id`). In beiden Fällen rendert die Liste
 * eine Header-Zeile + 1..N TV-Zeilen unter einer gemeinsamen Card.
 */
export interface AntragGroup {
  /** Bei Verbund-Cluster die `verbund_id`, sonst null. */
  verbundId: string | null;
  /** Mind. 1 TV. Bei Verbund nach `aktenzeichen` aufsteigend sortiert. */
  tvs: AntragListItem[];
  /** "16KN110645–16KN110646" bei mehreren TVs, sonst einzelnes Aktenzeichen. */
  fkzRange: string;
}

const EN_DASH = '–';

/**
 * Formatiert das Aktenzeichen-Range für die Header-Zeile. Bei mehreren
 * TVs `min–max` (En-Dash), bei einem TV das einzelne Aktenzeichen.
 * Eingabe muss nicht sortiert sein — wir lesen min/max via localeCompare.
 */
export function formatFkzRange(tvs: AntragListItem[]): string {
  if (tvs.length === 0) return '';
  if (tvs.length === 1) return tvs[0]!.aktenzeichen;
  let min = tvs[0]!.aktenzeichen;
  let max = tvs[0]!.aktenzeichen;
  for (let i = 1; i < tvs.length; i++) {
    const az = tvs[i]!.aktenzeichen;
    if (az.localeCompare(min) < 0) min = az;
    if (az.localeCompare(max) > 0) max = az;
  }
  return `${min}${EN_DASH}${max}`;
}

/**
 * Hält Verbund-TVs in der sortierten Liste als Cluster zusammen — gibt eine
 * flache Liste in Cluster-Reihenfolge zurück. Wird vor dem Pagination-Slice
 * benötigt, damit `slice(0, visibleRows)` keine Cluster mitten zerteilt.
 */
export function applyVerbundClustering(antraege: AntragListItem[]): AntragListItem[] {
  const placed = new Set<string>();
  const out: AntragListItem[] = [];
  for (const a of antraege) {
    const vid = a.verbund_id;
    if (typeof vid !== 'string' || vid.length === 0) {
      out.push(a);
      continue;
    }
    if (placed.has(vid)) continue;
    placed.add(vid);
    const tvs = antraege
      .filter(x => x.verbund_id === vid)
      .sort((x, y) => x.aktenzeichen.localeCompare(y.aktenzeichen));
    out.push(...tvs);
  }
  return out;
}

/**
 * Bildet aus der bereits primär-sortierten Antragsliste Gruppen für die
 * kompakte Listenansicht.
 *
 * Algorithmus:
 * - Einzelanträge (kein/leerer `verbund_id`) → eigene Gruppe mit 1 TV.
 * - TVs gleicher `verbund_id` → eine Gruppe; Cluster-Position folgt dem
 *   **ersten** Vorkommen in der Eingabe. Innerhalb der Gruppe wird nach
 *   Aktenzeichen aufsteigend sortiert.
 *
 * Eingabe muss bereits primär sortiert sein — die Funktion ändert keine
 * Positionen zwischen verschiedenen Gruppen.
 *
 * `opts.flat=true` deaktiviert die Verbund-Gruppierung komplett — jeder TV
 * wird zu einer eigenen Einzel-Gruppe. Wird vom Antragsteller-Sort genutzt,
 * damit Anträge desselben Antragstellers direkt nebeneinander stehen, statt
 * unter ihrem Verbund-Header zu verschwinden.
 */
export function buildAntragGroups(
  antraege: AntragListItem[],
  opts?: { flat?: boolean },
): AntragGroup[] {
  if (opts?.flat) {
    return antraege.map(a => ({
      verbundId: null,
      tvs: [a],
      fkzRange: a.aktenzeichen,
    }));
  }
  const placed = new Set<string>();
  const out: AntragGroup[] = [];

  for (const a of antraege) {
    const vid = a.verbund_id;
    if (typeof vid !== 'string' || vid.length === 0) {
      out.push({
        verbundId: null,
        tvs: [a],
        fkzRange: a.aktenzeichen,
      });
      continue;
    }
    if (placed.has(vid)) continue;
    placed.add(vid);

    const tvs = antraege
      .filter(x => x.verbund_id === vid)
      .sort((x, y) => x.aktenzeichen.localeCompare(y.aktenzeichen));
    out.push({
      verbundId: vid,
      tvs,
      fkzRange: formatFkzRange(tvs),
    });
  }

  return out;
}
