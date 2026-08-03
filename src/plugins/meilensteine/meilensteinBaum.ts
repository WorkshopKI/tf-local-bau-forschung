/**
 * Der Meilenstein-Plan als `TfTree`-Knoten.
 *
 * Nur die Umhängung — Struktur und Regeln liegen in `core/meilensteine`
 * (`kinderVon`, `darfUmhaengen`, `haengeKnotenUm`). Hier steht bewusst keine
 * zweite Sortier- oder Nummerierungslogik: die Anzeige-Nummer folgt aus der
 * Baumposition, nicht aus der Oberfläche.
 */
import { kinderVon, type MeilensteinKnoten } from '@/core/meilensteine';
import type { TfTreeItem, TfTreeItems } from '@/components/tree';

export const MEILENSTEIN_BAUM_ROOT = 'mst-wurzel';

/** Nutzlast eines Knotens. Die Wurzel wird nie gerendert, braucht aber eine. */
export type MeilensteinBaumKnoten =
  | { art: 'wurzel' }
  | { art: 'meilenstein'; knoten: MeilensteinKnoten };

export interface MeilensteinBaum {
  items: TfTreeItems<MeilensteinBaumKnoten>;
  rootId: string;
}

export function baueMeilensteinBaum(knoten: readonly MeilensteinKnoten[]): MeilensteinBaum {
  const items: Record<string, TfTreeItem<MeilensteinBaumKnoten>> = {};
  const gesehen = new Set<string>();

  const lauf = (elternId: string | null): string[] => kinderVon(knoten, elternId).flatMap(k => {
    // Waise oder Zyklus: einmal einhängen, nicht endlos absteigen.
    if (gesehen.has(k.id)) return [];
    gesehen.add(k.id);
    items[k.id] = {
      id: k.id,
      // Die Nummer gehört zur Beschriftung, sonst hiessen zwei
      // „Zwischenbescheid"-Knoten im Typeahead gleich.
      name: k.nummer ? `${k.nummer} ${k.label}` : k.label,
      // Auch ein blattloser Meilenstein ist ein Ordner: er nimmt
      // Unter-Meilensteine auf und ist damit ein gültiges Drop-Ziel.
      isFolder: true,
      children: lauf(k.id),
      data: { art: 'meilenstein', knoten: k },
    };
    return [k.id];
  });

  const wurzelKinder = lauf(null);
  // Waisen (Elternteil gelöscht) hängen an der Wurzel statt zu verschwinden —
  // dieselbe Zusage wie in `sortiereKnoten`.
  for (const k of knoten) {
    if (gesehen.has(k.id)) continue;
    gesehen.add(k.id);
    items[k.id] = {
      id: k.id,
      name: k.nummer ? `${k.nummer} ${k.label}` : k.label,
      isFolder: true,
      children: [],
      data: { art: 'meilenstein', knoten: k },
    };
    wurzelKinder.push(k.id);
  }

  items[MEILENSTEIN_BAUM_ROOT] = {
    id: MEILENSTEIN_BAUM_ROOT, name: 'Meilensteine', isFolder: true,
    children: wurzelKinder, data: { art: 'wurzel' },
  };
  return { items, rootId: MEILENSTEIN_BAUM_ROOT };
}
