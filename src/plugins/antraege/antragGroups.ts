import type { AntragListItem } from '@/core/services/csv/types';
import {
  extractNetzwerkId,
  isNetzwerkLead,
  collectPhases,
  formatNetzwerkLabel,
  resolveNetzwerkName,
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
 * 4-Ziffer-Netzwerk-ID im 16KN-FKZ) oder ein Einzelantrag.
 *
 * Bei Netzwerk-Gruppen ist das Modell zweistufig: die Top-Level-Gruppe
 * (Netzwerk-Supergruppe) trägt `subGroups[]` mit den enthaltenen Verbund-
 * Clustern und Einzelanträgen. Das Feld `tvs` enthält in dem Fall die
 * **flache** Liste aller TVs über alle Sub-Gruppen hinweg — Renderer, die
 * mit der hierarchischen Struktur nichts anfangen können (Compact-/Card-
 * View), können weiterhin flach iterieren.
 */
export interface AntragGroup {
  /** Bei Verbund-Cluster die `verbund_id`, sonst null. */
  verbundId: string | null;
  /** Bei Netzwerk-Cluster die 4-Ziffer-ID (z. B. `"1062"`), sonst null. */
  netzwerkId: string | null;
  /** Vorgefertigtes Label für Netzwerk-Gruppen (`"Netzwerk 1062 · Phase 1 + 2"`), sonst null. */
  netzwerkLabel: string | null;
  /** Mind. 1 TV. Bei Verbund/Solo: direkt die TVs. Bei Netzwerk-Supergruppe:
   *  die flache Liste aller TVs über `subGroups` hinweg (Lead-first sortiert). */
  tvs: AntragListItem[];
  /** "16KN110645–16KN110646" bei mehreren TVs, sonst einzelnes Aktenzeichen. */
  fkzRange: string;
  /** Nur bei Netzwerk-Supergruppen gesetzt: enthält die Verbund-Cluster und
   *  Einzelanträge innerhalb des Netzwerks. Reihenfolge: Sub-Gruppe mit Lead
   *  zuerst, dann nach erstem-FKZ aufsteigend. */
  subGroups?: AntragGroup[];
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
 * Baut innerhalb eines Netzwerks (oder einer beliebigen Antrags-Untermenge)
 * die Verbund-Cluster + Solo-Einzelanträge auf. Reihenfolge der Sub-Gruppen:
 * Sub-Gruppe mit Lead (Suffix 01/02 + vb_phase 1/2) zuerst, danach restliche
 * Sub-Gruppen aufsteigend nach erstem-Aktenzeichen.
 */
function buildVerbundSubGroups(members: AntragListItem[]): AntragGroup[] {
  const placed = new Set<string>();
  const out: AntragGroup[] = [];
  for (const a of members) {
    const vid = a.verbund_id;
    if (typeof vid !== 'string' || vid.length === 0) {
      out.push(soloGroup(a));
      continue;
    }
    if (placed.has(vid)) continue;
    placed.add(vid);
    const tvs = members
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
  // Sortier-Reihenfolge der Sub-Gruppen innerhalb des Netzwerks:
  // Sub-Gruppen mit Lead zuerst, dann alphabetisch nach erstem Aktenzeichen.
  out.sort((a, b) => {
    const aHasLead = a.tvs.some(t => isNetzwerkLead(t));
    const bHasLead = b.tvs.some(t => isNetzwerkLead(t));
    if (aHasLead !== bHasLead) return aHasLead ? -1 : 1;
    return a.tvs[0]!.aktenzeichen.localeCompare(b.tvs[0]!.aktenzeichen);
  });
  return out;
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
  opts?: {
    mode?: GroupingMode;
    /** Backward-kompatibler Alias zu `mode: 'none'`. */
    flat?: boolean;
    /** Cross-Programm-Index: 4-Ziffer-Netzwerk-ID → Netzwerk-Name. Wenn
     *  gesetzt, schlägt der Index-Wert den lokalen Lead-Akronym-Scan. */
    netzwerkNames?: Map<string, string> | null;
  },
): AntragGroup[] {
  // Backward-kompatibler `flat`-Schalter — bestehende Aufrufer (Tests)
  // verwenden { flat: true } gleichbedeutend mit mode='none'.
  const mode: GroupingMode = (() => {
    if (!opts) return 'verbund';
    if (opts.mode) return opts.mode;
    if (opts.flat) return 'none';
    return 'verbund';
  })();
  const netzwerkNames = opts?.netzwerkNames ?? null;

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
      // Alle Anträge des Netzwerks einsammeln, dann **innerhalb** des Netzwerks
      // erneut nach Verbund (bzw. Einzelantrag) gruppieren. Reihenfolge:
      // Sub-Gruppe mit Lead (Suffix 01/02 + vb_phase 1/2) zuerst, danach
      // restliche Sub-Gruppen aufsteigend nach erstem-Aktenzeichen.
      const members = antraege.filter(x => extractNetzwerkId(x.aktenzeichen) === nid);
      const subGroups = buildVerbundSubGroups(members);
      const flatTvs = subGroups.flatMap(g => g.tvs);
      const phases = collectPhases(flatTvs);
      const name = resolveNetzwerkName(nid, members, netzwerkNames);
      out.push({
        verbundId: null,
        netzwerkId: nid,
        netzwerkLabel: formatNetzwerkLabel(nid, phases, name),
        tvs: flatTvs,
        fkzRange: formatFkzRange(flatTvs),
        subGroups,
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
