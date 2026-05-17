import type { AntragListItem } from '@/core/services/csv/types';
import { getStatusCategory } from '@/core/utils/status-canonical';
import {
  extractNetzwerkId,
  isNetzwerkLead,
  collectPhases,
  formatNetzwerkLabel,
  resolveNetzwerkName,
} from './netzwerk';

/**
 * Gruppierungs-Modus für die Antragsliste.
 * - `verbund`: Cluster nach `verbund_id` (Legacy, weiterhin im Code für
 *   bestehende Aufrufer/Tests; nicht mehr in der UI-Toolbar wählbar — siehe
 *   GROUPING_OPTIONS in sort.ts).
 * - `netzwerk`: Cluster nach 4-Ziffer-Netzwerk-ID aus dem 16KN-FKZ. Cluster-
 *   Reihenfolge folgt dem ersten Auftreten in der primär-sortierten Eingabe
 *   (= User-Sort steuert auch die Supergruppen-Position). Anträge ohne
 *   16KN-Präfix landen als Solo-Gruppe.
 * - `netzwerk-by-size`: Wie `netzwerk`, aber die Supergruppen werden nach
 *   Mitglieder-Zahl absteigend sortiert (Tie-Break: Netzwerk-ID asc), Solos
 *   wandern ans Ende. Praktisch um „große" Netzwerke schnell zu sehen.
 * - `status`: Flache Solo-Gruppen, sortiert nach Phase (Offen → Nachforderung
 *   → Bewilligt → Begleitung → Abgeschlossen → Sonstige). Jede Gruppe trägt
 *   `statusPhaseLabel` für Header-Rendering in der Listendarstellung.
 * - `none`: Flache Liste, jeder TV ist eine eigene Gruppe.
 */
export type GroupingMode = 'verbund' | 'netzwerk' | 'netzwerk-by-size' | 'status' | 'none';

/**
 * Phasen-Reihenfolge für `mode='status'` (entspricht Bearbeitungs-Lifecycle).
 * Mapping `StatusCategory` → Phase-Label aus `STATUS_QUICK_CHIPS` (Single
 * Source of Truth in `filter/statusQuickChips.ts`).
 */
const STATUS_PHASE_ORDER = [
  'Offen',
  'Nachforderung',
  'Bewilligt',
  'Begleitung',
  'Abgeschlossen',
  'Sonstige',
] as const;
export type StatusPhaseLabel = (typeof STATUS_PHASE_ORDER)[number];

function statusPhaseForAntrag(a: AntragListItem): StatusPhaseLabel {
  const cat = getStatusCategory(a.status);
  switch (cat) {
    case 'offen':
    case 'in_pruefung':
    case 'entscheidung':
      return 'Offen';
    case 'nachforderung':
      return 'Nachforderung';
    case 'bewilligt':
      return 'Bewilligt';
    case 'begleitung':
      return 'Begleitung';
    case 'abgeschlossen':
    case 'abgelehnt':
      return 'Abgeschlossen';
    default:
      return 'Sonstige';
  }
}

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
  /** Nur bei `mode='status'` gesetzt: Phase-Label des head-TVs (Offen /
   *  Nachforderung / Bewilligt / Begleitung / Abgeschlossen / Sonstige). Der
   *  Renderer (GroupedList) rendert einen Section-Header zwischen aufeinander-
   *  folgenden Gruppen mit unterschiedlichem Label. */
  statusPhaseLabel?: StatusPhaseLabel;
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
 * Section für `mode='status'`: ein Phase-Label + die zugehörigen Antrags-
 * Gruppen. Renderer nutzen das, um zwischen Sektionen einen Header zu
 * zeichnen.
 */
export interface StatusPhaseSection {
  label: StatusPhaseLabel;
  groups: AntragGroup[];
}

/**
 * Teilt eine Status-gruppierte Gruppen-Liste in zusammenhängende Sektionen
 * pro Phase. Reihenfolge bleibt erhalten (= Lifecycle-Reihenfolge aus
 * `buildAntragGroups`). Leere Phasen werden nicht ausgegeben.
 * Wenn keine Gruppe ein `statusPhaseLabel` hat, returnt das Array eine einzige
 * Sektion mit `label='Sonstige'` (defensiv — sollte nie passieren, weil der
 * Aufrufer nur mit `mode='status'` aufgerufen wird).
 */
export function splitByStatusPhase(groups: AntragGroup[]): StatusPhaseSection[] {
  const sections: StatusPhaseSection[] = [];
  let current: StatusPhaseSection | null = null;
  for (const g of groups) {
    const label = g.statusPhaseLabel ?? 'Sonstige';
    if (!current || current.label !== label) {
      current = { label, groups: [] };
      sections.push(current);
    }
    current.groups.push(g);
  }
  return sections;
}

/**
 * Pagination auf Gruppen-Ebene: gibt komplette Gruppen aus `allGroups`
 * zurück, bis die kumulierte TV-Zahl `targetVisibleTvs` erreicht. Boundary-
 * Gruppen werden vollständig mitgenommen (Overshoot akzeptiert), damit
 * Cluster nie zerschnitten werden. Mindestens eine Gruppe wird immer
 * zurückgegeben, sofern verfügbar.
 */
export function takeGroupsUntil(
  allGroups: AntragGroup[],
  targetVisibleTvs: number,
): AntragGroup[] {
  if (allGroups.length === 0) return [];
  if (targetVisibleTvs <= 0) return [];
  const out: AntragGroup[] = [];
  let tvCount = 0;
  for (const g of allGroups) {
    out.push(g);
    tvCount += g.tvs.length;
    if (tvCount >= targetVisibleTvs) break;
  }
  return out;
}

/**
 * Hält Verbund-TVs in der sortierten Liste als Cluster zusammen — gibt eine
 * flache Liste in Cluster-Reihenfolge zurück. Wird vor dem Pagination-Slice
 * benötigt, damit `slice(0, visibleRows)` keine Cluster mitten zerteilt.
 *
 * TVs innerhalb eines Clusters behalten die Reihenfolge der Eingabe-Liste
 * (= primärer Sort der `useFilteredAntraege`-Pipeline). Kein Re-Sort nach
 * Aktenzeichen, damit „Antragsdatum desc" o.ä. innerhalb des Clusters nicht
 * wieder zu FKZ-asc umsortiert wird.
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
    const tvs = antraege.filter(x => x.verbund_id === vid);
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
    // TVs innerhalb der Sub-Gruppe behalten Input-Order (= primärer Sort),
    // damit User-Sort wie „Antragsdatum desc" auch hier durchgreift.
    const tvs = members.filter(x => x.verbund_id === vid);
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
 *   folgt dem **ersten** Vorkommen in der Eingabe. TVs innerhalb der Gruppe
 *   behalten Input-Order (= primärer Sort der Caller-Pipeline).
 *
 * - `netzwerk`: 16KN-Anträge gleicher 4-Ziffer-Netzwerk-ID werden geclustert.
 *   Cluster-Position folgt dem **ersten** Vorkommen in der Eingabe (User-Sort
 *   steuert mit). Innerhalb der Gruppe: Leads (Suffix `01`/`02` + vb_phase
 *   1/2) zuerst, dann andere nach Aktenzeichen. Anträge ohne 16KN-Präfix
 *   bleiben in ihrer ursprünglichen Reihenfolge.
 *
 * - `netzwerk-by-size`: Wie `netzwerk`, aber Netzwerk-Supergruppen werden
 *   nach **Mitglieder-Zahl absteigend** sortiert (Tie-Break: Netzwerk-ID
 *   aufsteigend), Solo-Gruppen wandern ans Ende, alphabetisch nach FKZ.
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

  if (mode === 'status') {
    // Phasen-Buckets befüllen, Reihenfolge der Antraege innerhalb des Buckets
    // = primärer Sort der Caller-Pipeline (nicht re-sortieren). Buckets selbst
    // in Lifecycle-Reihenfolge ausgeben.
    const buckets = new Map<StatusPhaseLabel, AntragListItem[]>();
    for (const phase of STATUS_PHASE_ORDER) buckets.set(phase, []);
    for (const a of antraege) {
      const phase = statusPhaseForAntrag(a);
      buckets.get(phase)!.push(a);
    }
    const out: AntragGroup[] = [];
    for (const phase of STATUS_PHASE_ORDER) {
      const items = buckets.get(phase)!;
      for (const a of items) {
        const g = soloGroup(a);
        g.statusPhaseLabel = phase;
        out.push(g);
      }
    }
    return out;
  }

  if (mode === 'netzwerk' || mode === 'netzwerk-by-size') {
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
    if (mode === 'netzwerk-by-size') {
      // Netzwerk-Supergruppen nach Mitglieder-Zahl absteigend sortieren —
      // große Netzwerke (mehr TVs sichtbar im aktuellen Programm) stehen oben.
      // Tie-Break: Netzwerk-ID aufsteigend für deterministische Reihenfolge.
      // Solo-Gruppen (Anträge ohne 16KN-Präfix) wandern ans Ende, intern
      // alphabetisch nach Aktenzeichen.
      out.sort((a, b) => {
        const aIsNetzwerk = a.netzwerkId !== null;
        const bIsNetzwerk = b.netzwerkId !== null;
        if (aIsNetzwerk !== bIsNetzwerk) return aIsNetzwerk ? -1 : 1;
        if (aIsNetzwerk && bIsNetzwerk) {
          if (a.tvs.length !== b.tvs.length) return b.tvs.length - a.tvs.length;
          return (a.netzwerkId ?? '').localeCompare(b.netzwerkId ?? '');
        }
        return a.tvs[0]!.aktenzeichen.localeCompare(b.tvs[0]!.aktenzeichen);
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

    // TVs innerhalb des Verbund-Clusters behalten Input-Order (= primärer
    // Sort der useFilteredAntraege-Pipeline). Kein Re-Sort, damit
    // „Antragsdatum desc" o.ä. durchgreift.
    const tvs = antraege.filter(x => x.verbund_id === vid);
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
