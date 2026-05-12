import type { AntragListItem } from '@/core/services/csv/types';

/**
 * Hält Verbund-Teilvorhaben in der sortierten Liste als Cluster zusammen.
 *
 * Algorithmus:
 * - Einzelanträge (kein `verbund_id`) bleiben an ihrer Position.
 * - Verbund-TVs werden zur Position ihres **ersten** Vorkommens in der
 *   eingehenden (bereits sortierten) Liste verschoben. Innerhalb des Clusters
 *   werden alle TVs nach `aktenzeichen` aufsteigend sortiert.
 * - Reihenfolge ist stabil: ein TV der weiter unten in der Eingabe steht, wird
 *   übersprungen, wenn sein Verbund schon platziert wurde.
 *
 * Eingabe muss bereits nach der primären Sort-Order sortiert sein — diese
 * Funktion ändert keine Positionen zwischen verschiedenen Verbünden / Einzeln.
 */
export function applyVerbundClustering(antraege: AntragListItem[]): AntragListItem[] {
  const placedVerbuende = new Set<string>();
  const out: AntragListItem[] = [];

  for (const a of antraege) {
    const vid = a.verbund_id;
    if (typeof vid !== 'string' || vid.length === 0) {
      out.push(a);
      continue;
    }
    if (placedVerbuende.has(vid)) continue;
    placedVerbuende.add(vid);

    // Alle TVs dieses Verbunds sammeln und intern stabil nach Aktenzeichen ordnen.
    const tvs = antraege.filter(x => x.verbund_id === vid);
    tvs.sort((x, y) => x.aktenzeichen.localeCompare(y.aktenzeichen));
    out.push(...tvs);
  }

  return out;
}
