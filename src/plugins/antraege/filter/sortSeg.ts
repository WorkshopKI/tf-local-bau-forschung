/**
 * Reines Modell der „Sortiert nach"-Pille: aus (Sicht, aktiver Sortierung)
 * werden die anzuzeigenden Seg-Einträge, das aktuelle Label und das Label, bei
 * dem die Pille kollabiert.
 *
 * Getrennt von [QuickfilterToolbar](QuickfilterToolbar.tsx), weil genau hier der
 * Defekt saß, den die Toolbar nicht sichtbar machte: sie führte eine zweite,
 * kürzere Options-Liste. Stand die Sicht auf einem Schlüssel, den diese Liste
 * nicht kannte (`bewilligt_jahr` → `bewilligung_desc`), fiel die Anzeige stumm
 * auf „Neueste zuerst" zurück — die Pille nannte eine andere Sortierung als die
 * wirksame, und der wirksame Schlüssel war nicht mehr anwählbar.
 *
 * Beide Funktionen hier sind rein und ohne DOM testbar (node-only Suite).
 */
import type { ViewKey } from '../views';
import { DEFAULT_SORT_BY_VIEW, getSortOption, getSortOptionsForView, type SortKey } from '../sort';
import type { CollapsibleSegItem } from './CollapsibleSeg';

export interface SortSegModell {
  items: CollapsibleSegItem[];
  /** Muss exakt einem `items[].label` entsprechen — sonst wirkt kein Eintrag aktiv. */
  aktuellesLabel: string;
  /** Label der Sicht-Vorgabe; `CollapsibleSeg` kollabiert bei diesem Wert. */
  defaultLabel: string;
}

export function sortSegModell(view: ViewKey, sortKey: SortKey): SortSegModell {
  const optionen = getSortOptionsForView(view);
  const items = optionen.map(o => ({ label: o.label, title: o.hinweis }));
  // Der wirksame Schlüssel kommt aus `getEffectiveSortKey` und ist damit für
  // die Sicht bereits validiert — der Fallback greift nur bei einem Schlüssel,
  // den `getSortOptionsForView` herausfiltert, und zeigt dann lieber die
  // Sicht-Vorgabe als eine erfundene Beschriftung.
  const treffer = optionen.find(o => o.key === sortKey);
  const defaultLabel = getSortOption(DEFAULT_SORT_BY_VIEW[view]).label;
  return {
    items,
    aktuellesLabel: treffer?.label ?? defaultLabel,
    defaultLabel,
  };
}

/** Rückweg Label → Schlüssel, auf die Sicht beschränkt. `null`, wenn das Label
 *  nicht zur Sicht gehört (dann bleibt die Sortierung, wie sie war). */
export function sortKeyFuerLabel(view: ViewKey, label: string): SortKey | null {
  return getSortOptionsForView(view).find(o => o.label === label)?.key ?? null;
}
