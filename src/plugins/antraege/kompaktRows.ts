/**
 * Pure Logik für den Kompakt-Listenmodus (Journey-Paket 2 Phase 8).
 *
 * Wenn ein Detail geöffnet ist, schrumpft die Antrags-Liste auf eine schmale
 * (~230px) Kompakt-Spalte neben dem Detail (Mockup `split-kompaktliste.png`).
 * Diese Datei hält die datenagnostische, React-freie Logik (Label-Ableitung,
 * clientseitiger Sicht-Filter, Zeilen-VM) — bewusst ausgelagert für
 * `environment: 'node'`-Unit-Tests (vgl. `listCollapse.ts`, `fristAnzeige.ts`).
 *
 * **Abgrenzung:** Der Kompakt-Filter filtert NUR die bereits sichtbare Liste
 * (`filtered` aus `useFilteredAntraege`) clientseitig — er greift NICHT in
 * Facetten, Sidebar-Filter, Hybrid-Suche oder Sortierung ein. Reihenfolge +
 * Umfang bleiben die der Vollansicht.
 */

import type { AntragListItem } from '@/core/services/csv/types';
import { fristAnzeige, type FristAnzeige } from './fristAnzeige';
import { buildAntragGroups } from './antragGroups';

/** Minimal-Shape für Label + Filter — erfüllt von `AntragListItem`. */
export type KompaktItem = Pick<
  AntragListItem,
  'aktenzeichen' | 'akronym' | 'status' | 'antragsdatum' | 'vn_eingang_datum' | 'verbund_id'
>;

/** Anzeige-VM einer Kompakt-Zeile: Label (Akronym/Aktenzeichen) + relative
 *  Frist (`null` = terminal/fristlos → leerer rechter Slot). */
export interface KompaktRowVM {
  aktenzeichen: string;
  /** Verbund des Antrags (falls gesetzt) — für die Aktiv-Markierung, wenn ein
   *  Verbund (statt eines einzelnen TV) selektiert ist. */
  verbundId: string | null;
  label: string;
  frist: FristAnzeige | null;
}

/** Sichtbares Label: Akronym (getrimmt), sonst Aktenzeichen als Fallback. */
export function kompaktLabel(item: Pick<AntragListItem, 'akronym' | 'aktenzeichen'>): string {
  const ak = typeof item.akronym === 'string' ? item.akronym.trim() : '';
  return ak.length > 0 ? ak : item.aktenzeichen;
}

/**
 * Clientseitiger Sicht-Filter: Substring (case-insensitiv) auf Label
 * (Akronym → Fallback Aktenzeichen) UND Aktenzeichen. Leere Query = alles.
 */
export function matchesKompaktFilter(
  item: Pick<AntragListItem, 'akronym' | 'aktenzeichen'>,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return true;
  if (kompaktLabel(item).toLowerCase().includes(q)) return true;
  return item.aktenzeichen.toLowerCase().includes(q);
}

/** Filtert die sichtbare Liste clientseitig (stabile Reihenfolge, keine Sortierung). */
export function filterKompaktItems<T extends Pick<AntragListItem, 'akronym' | 'aktenzeichen'>>(
  items: readonly T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return items.slice();
  return items.filter(i => matchesKompaktFilter(i, q));
}

/**
 * Zeilen-VM: Label + relative Frist. Terminale/fristlose Anträge → `frist:
 * null` (leerer rechter Slot, wie in der Frist-Spalte). `nowMs` injizierbar
 * für deterministische Tests.
 */
export function buildKompaktRow(item: KompaktItem, nowMs?: number): KompaktRowVM {
  return {
    aktenzeichen: item.aktenzeichen,
    verbundId: typeof item.verbund_id === 'string' && item.verbund_id.length > 0 ? item.verbund_id : null,
    label: kompaktLabel(item),
    frist: fristAnzeige(item, nowMs),
  };
}

/**
 * Anzeige-VM einer nach Verbund geclusterten Kompakt-Zeile: EIN Eintrag pro
 * Verbund (statt einer Zeile je TV). Solo-Anträge (ohne `verbund_id`) bleiben je
 * eine eigene Gruppe.
 */
export interface KompaktGroupVM {
  /** React-Key + Auto-Scroll-Ziel: Aktenzeichen des Lead-TV. */
  key: string;
  /** Verbund des Clusters (`null` = Solo-Antrag → als Einzelantrag öffnen). */
  verbundId: string | null;
  /** Lead-Aktenzeichen (Solo-Öffnen + Fallback-Label). */
  leadAktenzeichen: string;
  /** Aktenzeichen aller TVs im Cluster — für die Aktiv-Markierung, wenn ein
   *  einzelner TV (statt des Verbundes) selektiert ist. */
  memberAktenzeichen: string[];
  /** Anzeige-Label (Lead-Akronym, sonst Aktenzeichen). */
  label: string;
  /** Anzahl Teilvorhaben im Cluster (`> 1` ⇒ Verbund). */
  tvCount: number;
  /** Relative Frist des Clusters (Lead-TV; terminal/fristlos → `null`). */
  frist: FristAnzeige | null;
}

/**
 * Baut aus der sichtbaren (bereits gefilterten + sortierten) Antragsliste die
 * nach Verbund geclusterten Zeilen-VMs für den Kompakt-Modus: EIN Eintrag pro
 * Verbund — ein Klick öffnet den Verbund, dessen TVs stehen dann im Detail.
 * Reihenfolge folgt der Vollansicht (erstes Vorkommen des Verbundes), Clustering
 * über den geteilten `buildAntragGroups`-Pfad (kein eigener Verbund-Bucketing-
 * Nachbau). `nowMs` injizierbar für deterministische Tests.
 */
export function buildKompaktGroups(items: AntragListItem[], nowMs?: number): KompaktGroupVM[] {
  return buildAntragGroups(items, { mode: 'verbund' }).map(g => {
    const lead = g.tvs[0]!;
    return {
      key: lead.aktenzeichen,
      verbundId: g.verbundId,
      leadAktenzeichen: lead.aktenzeichen,
      memberAktenzeichen: g.tvs.map(t => t.aktenzeichen),
      label: kompaktLabel(lead),
      tvCount: g.tvs.length,
      frist: fristAnzeige(lead, nowMs),
    };
  });
}

/**
 * Clientseitiger Sicht-Filter auf Gruppen: Treffer, wenn die Query im Label
 * (Lead-Akronym) ODER in einem Mitglieds-Aktenzeichen steckt. Leere Query =
 * alle (neue Referenz, stabile Reihenfolge).
 */
export function filterKompaktGroups(groups: readonly KompaktGroupVM[], query: string): KompaktGroupVM[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return groups.slice();
  return groups.filter(g =>
    g.label.toLowerCase().includes(q) ||
    g.memberAktenzeichen.some(az => az.toLowerCase().includes(q)),
  );
}
