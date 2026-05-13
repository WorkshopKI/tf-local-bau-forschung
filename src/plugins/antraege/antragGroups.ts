import type { AntragListItem } from '@/core/services/csv/types';
import {
  extractNetzwerkId,
  compareNetzwerkOrder,
  collectPhases,
  formatNetzwerkLabel,
} from './netzwerk';

/**
 * Gruppierungs-Modus für die Antragsliste.
 * - `verbund`: Cluster nach `verbund_id` (Default; aktuelles Verhalten).
 * - `netzwerk`: Cluster nach 4-Ziffer-Netzwerk-ID aus dem 16KN-FKZ. Anträge
 *   ohne 16KN-Präfix landen als Solo-Gruppe.
 * - `none`: Flache Liste, jeder TV ist eine eigene Gruppe.
 */
export type GroupingMode = 'verbund' | 'netzwerk' | 'none';

/**
 * Gruppe von Anträgen für die kompakte Listendarstellung. Eine Gruppe ist
 * entweder ein Verbund (gemeinsame `verbund_id`), ein Netzwerk (gemeinsame
 * 4-Ziffer-Netzwerk-ID im 16KN-FKZ) oder ein Einzelantrag. In allen Fällen
 * rendert die Liste eine Header-Zeile + 1..N TV-Zeilen unter einer
 * gemeinsamen Card.
 */
export interface AntragGroup {
  /** Bei Verbund-Cluster die `verbund_id`, sonst null. */
  verbundId: string | null;
  /** Bei Netzwerk-Cluster die 4-Ziffer-ID (z. B. `"1062"`), sonst null. */
  netzwerkId: string | null;
  /** Vorgefertigtes Label für Netzwerk-Gruppen (`"Netzwerk 1062 · Phase 1 + 2"`), sonst null. */
  netzwerkLabel: string | null;
  /** Mind. 1 TV. Innerhalb der Gruppe bei Verbund nach Aktenzeichen sortiert,
   *  bei Netzwerk Leads (Suffix 01/02 + vb_phase 1/2) zuerst, dann nach Aktenzeichen. */
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

function soloGroup(a: AntragListItem): AntragGroup {
  return {
    verbundId: null,
    netzwerkId: null,
    netzwerkLabel: null,
    tvs: [a],
    fkzRange: a.aktenzeichen,
  };
}

/**
 * Bildet aus der bereits primär-sortierten Antragsliste Gruppen für die
 * kompakte Listenansicht. Verhalten je `mode`:
 *
 * - `verbund` (Default): Einzelanträge (kein/leerer `verbund_id`) → eigene
 *   Gruppe mit 1 TV. TVs gleicher `verbund_id` → eine Gruppe; Cluster-Position
 *   folgt dem **ersten** Vorkommen in der Eingabe. Innerhalb der Gruppe wird
 *   nach Aktenzeichen aufsteigend sortiert.
 *
 * - `netzwerk`: 16KN-Anträge gleicher 4-Ziffer-Netzwerk-ID werden geclustert.
 *   Cluster-Position folgt dem ersten Vorkommen. Innerhalb der Gruppe: Leads
 *   (Suffix `01`/`02` + vb_phase 1/2) zuerst, dann andere nach Aktenzeichen.
 *   Anträge ohne 16KN-Präfix → eigene Solo-Gruppe.
 *
 * - `none`: Jeder TV → eigene Solo-Gruppe. Wird vom Antragsteller-Sort genutzt,
 *   damit Anträge desselben Antragstellers direkt nebeneinander stehen, statt
 *   unter ihrem Verbund-Header zu verschwinden.
 *
 * Eingabe muss bereits primär sortiert sein — die Funktion ändert keine
 * Positionen zwischen verschiedenen Gruppen.
 */
export function buildAntragGroups(
  antraege: AntragListItem[],
  opts?: { mode?: GroupingMode } | { flat?: boolean },
): AntragGroup[] {
  // Backward-kompatibler `flat`-Schalter — bestehende Aufrufer (Tests)
  // verwenden { flat: true } gleichbedeutend mit mode='none'.
  const mode: GroupingMode = (() => {
    if (!opts) return 'verbund';
    if ('mode' in opts && opts.mode) return opts.mode;
    if ('flat' in opts && opts.flat) return 'none';
    return 'verbund';
  })();

  if (mode === 'none') {
    return antraege.map(a => soloGroup(a));
  }

  if (mode === 'netzwerk') {
    const placed = new Set<string>();
    const out: AntragGroup[] = [];
    for (const a of antraege) {
      const nid = extractNetzwerkId(a.aktenzeichen);
      if (nid === null) {
        out.push(soloGroup(a));
        continue;
      }
      if (placed.has(nid)) continue;
      placed.add(nid);
      const tvs = antraege
        .filter(x => extractNetzwerkId(x.aktenzeichen) === nid)
        .sort(compareNetzwerkOrder);
      const phases = collectPhases(tvs);
      out.push({
        verbundId: null,
        netzwerkId: nid,
        netzwerkLabel: formatNetzwerkLabel(nid, phases),
        tvs,
        fkzRange: formatFkzRange(tvs),
      });
    }
    return out;
  }

  // mode === 'verbund'
  const placed = new Set<string>();
  const out: AntragGroup[] = [];
  for (const a of antraege) {
    const vid = a.verbund_id;
    if (typeof vid !== 'string' || vid.length === 0) {
      out.push(soloGroup(a));
      continue;
    }
    if (placed.has(vid)) continue;
    placed.add(vid);

    const tvs = antraege
      .filter(x => x.verbund_id === vid)
      .sort((x, y) => x.aktenzeichen.localeCompare(y.aktenzeichen));
    out.push({
      verbundId: vid,
      netzwerkId: null,
      netzwerkLabel: null,
      tvs,
      fkzRange: formatFkzRange(tvs),
    });
  }

  return out;
}
