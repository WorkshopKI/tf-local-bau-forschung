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
