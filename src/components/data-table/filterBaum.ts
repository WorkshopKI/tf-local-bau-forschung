/**
 * Der Spaltenfilter als Baum: Gruppe (Ordner) → Wert (Blatt).
 *
 * Rein und UI-frei — wie beim Status-Filter ist die Abbildung zwischen Baum und
 * Wertmenge die Stelle, an der man sich vertut, nicht das Rendern.
 *
 * **Der Baum entscheidet nichts über die Reihenfolge.** Gruppen entstehen in der
 * Reihenfolge ihres ersten Auftretens in `candidates`, Blätter in der
 * Reihenfolge der Kandidaten. Sortiert wird also weiterhin allein über
 * `SortableColumn.filterSort` in `deriveFilterCandidates` — sonst gäbe es zwei
 * Stellen, die dasselbe behaupten.
 *
 * **Werte außerhalb der Kandidaten überleben.** Die Suche im Dropdown verkleinert
 * die Kandidatenliste, die Auswahl bleibt aber die volle. `werteAusChecked`
 * bekommt deshalb den bisherigen Stand und fasst nur an, was gerade im Baum
 * steht — sonst löschte ein Klick bei aktiver Suche still alles Ausgeblendete.
 *
 * **Die Zahl steht im Knoten, nicht im Slot.** Ein Ordner kennt seine Kinder im
 * Render nicht mehr; die Summe müsste dort bei jeder Zeile neu über alle
 * Kandidaten laufen. Hier fällt sie in der Schleife an, die ohnehin läuft — und
 * ist so ohne Komponenten-Test prüfbar. Weil der Baum aus der DURCHSUCHTEN
 * Kandidatenliste gebaut wird, ist die Ordner-Zahl die Summe der gerade
 * sichtbaren Kinder und schrumpft beim Tippen mit: sie soll zu dem passen, was
 * unter ihr steht (genau wie das Ordner-Häkchen).
 */
import type { TfTreeItem, TfTreeItems } from '@/components/tree';

export const FILTER_BAUM_ROOT = 'filter-root';

export const gruppenKnotenId = (key: string): string => `gruppe:${key}`;
export const wertKnotenId = (value: string): string => `wert:${value}`;

/** Nutzlast eines Knotens. Die Wurzel wird nie gerendert, braucht aber eine.
 *  `anzahl` bleibt `undefined`, wenn der Aufrufer keine Zahlen mitgibt — der
 *  Slot rendert dann nichts. */
export type FilterKnoten =
  | { art: 'wurzel' }
  | { art: 'gruppe'; key: string; anzahl?: number }
  | { art: 'wert'; value: string; anzahl?: number };

export interface FilterBaum {
  items: TfTreeItems<FilterKnoten>;
  rootId: string;
}

/**
 * Baut den Baum aus der (bereits sortierten) Kandidatenliste.
 *
 * Werte, für die `groupOf` `null` liefert, hängen als Blätter direkt an der
 * Wurzel — und zwar HINTER den Ordnern. Das betrifft in der Praxis den
 * `(leer)`-Sentinel, der weder ein Jahr hat noch eines vortäuschen soll.
 */
export function baueFilterBaum(
  candidates: readonly string[],
  groupOf: (value: string) => string | null,
  formatLabel: (value: string) => string,
  counts?: ReadonlyMap<string, number>,
): FilterBaum {
  const items: Record<string, TfTreeItem<FilterKnoten>> = {};
  const gruppenReihenfolge: string[] = [];
  const kinderJeGruppe = new Map<string, string[]>();
  const summeJeGruppe = new Map<string, number>();
  const ohneGruppe: string[] = [];

  for (const value of candidates) {
    const id = wertKnotenId(value);
    // Ein doppelter Kandidat wäre ein Fehler weiter oben; stille doppelte
    // Baum-Ids wären schlimmer als der erste sichtbare Ausreißer.
    if (items[id]) continue;
    const anzahl = counts ? counts.get(value) ?? 0 : undefined;
    items[id] = {
      id, name: formatLabel(value), isFolder: false,
      data: { art: 'wert', value, anzahl },
    };

    const key = groupOf(value);
    if (key === null) {
      ohneGruppe.push(id);
      continue;
    }
    let kinder = kinderJeGruppe.get(key);
    if (!kinder) {
      kinder = [];
      kinderJeGruppe.set(key, kinder);
      gruppenReihenfolge.push(key);
    }
    kinder.push(id);
    if (anzahl !== undefined) summeJeGruppe.set(key, (summeJeGruppe.get(key) ?? 0) + anzahl);
  }

  const wurzelKinder: string[] = [];
  for (const key of gruppenReihenfolge) {
    const id = gruppenKnotenId(key);
    items[id] = {
      id, name: key, isFolder: true, children: kinderJeGruppe.get(key) ?? [],
      data: { art: 'gruppe', key, anzahl: counts ? summeJeGruppe.get(key) ?? 0 : undefined },
    };
    wurzelKinder.push(id);
  }
  wurzelKinder.push(...ohneGruppe);

  items[FILTER_BAUM_ROOT] = {
    id: FILTER_BAUM_ROOT, name: 'Filter', isFolder: true, children: wurzelKinder,
    data: { art: 'wurzel' },
  };

  return { items, rootId: FILTER_BAUM_ROOT };
}

/** Ausgewählte Werte → angehakte Blatt-Ids (nur für Werte, die im Baum stehen). */
export function checkedAusWerten(
  candidates: readonly string[], selected: ReadonlySet<string>,
): string[] {
  const ids: string[] = [];
  for (const v of candidates) {
    if (selected.has(v)) ids.push(wertKnotenId(v));
  }
  return ids;
}

/**
 * Angehakte Blatt-Ids → Wertmenge. `bisher` wird gebraucht, um Werte zu
 * erhalten, die gerade nicht im Baum stehen (siehe Modulkopf).
 *
 * Ordner-Ids in `checked` sind hier ohne Bedeutung: der Baum propagiert das
 * Ordner-Häkchen ohnehin auf alle Blätter darunter, und nur die zählen.
 */
export function werteAusChecked(
  candidates: readonly string[], checked: readonly string[], bisher: ReadonlySet<string>,
): Set<string> {
  const gehakt = new Set(checked);
  const raus = new Set(bisher);
  for (const v of candidates) {
    if (gehakt.has(wertKnotenId(v))) raus.add(v); else raus.delete(v);
  }
  return raus;
}
