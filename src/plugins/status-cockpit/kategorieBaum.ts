/**
 * Der Ordnerbaum des Statuskatalogs als `TfTree`-Knoten.
 *
 * Nur die Umhängung auf das Baum-Format — die Struktur liefert `baumVon`, die
 * Ablege-Regeln liefern `darfAblegen`/`naechsteReihenfolge`. Hier wird keine
 * Regel zum zweiten Mal geschrieben.
 *
 * **Verbund und Teilvorhaben sind getrennte Bäume** (so wie bisher): „Kommunikation"
 * gibt es auf beiden Ebenen mit verschiedenen Codes. Deshalb je Ebene ein eigener
 * Aufruf mit eigener Wurzel; die Wurzel ist zugleich das Drop-Ziel „oberste Ebene".
 */
import { baumVon, type KategorieKnoten, type StatusKategorie } from '@/core/status';
import type { TfTreeItem, TfTreeItems } from '@/components/tree';

export type Ebene = 'verbund' | 'tv';

export const wurzelId = (ebene: Ebene): string => `wurzel:${ebene}`;

/** Nutzlast eines Knotens. Die Wurzel wird nie gerendert, braucht aber eine. */
export type KategorieBaumKnoten =
  | { art: 'wurzel'; ebene: Ebene }
  | { art: 'ordner'; kategorie: StatusKategorie; belegt: number };

export interface KategorieBaum {
  items: TfTreeItems<KategorieBaumKnoten>;
  rootId: string;
}

/**
 * @param belegtJeOrdner Wie viele Felder an einem Ordner hängen — kommt von
 *   aussen, weil es aus dem Feld-Katalog stammt und nicht aus der Ordnerliste.
 */
export function baueKategorieBaum(
  kategorien: readonly StatusKategorie[],
  ebene: Ebene,
  belegtJeOrdner: ReadonlyMap<string, number>,
): KategorieBaum {
  const items: Record<string, TfTreeItem<KategorieBaumKnoten>> = {};

  const lauf = (knoten: readonly KategorieKnoten[]): string[] => knoten.map(n => {
    const k = n.kategorie;
    const kinder = lauf(n.kinder);
    items[k.id] = {
      id: k.id,
      name: k.label,
      // Auch ein leerer Ordner bleibt Ordner: er ist ein gültiges Drop-Ziel,
      // und ein Blatt-Symbol wäre eine Lüge über seine Rolle.
      isFolder: true,
      children: kinder,
      data: { art: 'ordner', kategorie: k, belegt: belegtJeOrdner.get(k.id) ?? 0 },
    };
    return k.id;
  });

  const wurzelKinder = lauf(baumVon(kategorien, ebene));
  const root = wurzelId(ebene);
  items[root] = {
    id: root, name: ebene, isFolder: true, children: wurzelKinder,
    data: { art: 'wurzel', ebene },
  };
  return { items, rootId: root };
}

/** Zählt je Ordner die Felder, die daran hängen. */
export function belegungJeOrdner(
  felder: readonly { kategorieId?: string | null }[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const f of felder) {
    if (!f.kategorieId) continue;
    m.set(f.kategorieId, (m.get(f.kategorieId) ?? 0) + 1);
  }
  return m;
}
