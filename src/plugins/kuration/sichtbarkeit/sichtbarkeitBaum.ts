/**
 * Der Sichtbarkeits-Katalog als `TfTree`-Knoten.
 *
 * Zwei Ebenen, mehr braucht es nicht: **Seite** → alles, was zu ihr gehört
 * (Reiter, Abschnitte, Karten). Die Seite ist zugleich ein Katalog-Eintrag und
 * ihr eigener Ordner — ihre Zeile trägt deshalb Marken wie jede andere.
 *
 * Bis v4.115 stand hier eine flache Liste aus 192 Zeilen in 21 Kästen; man
 * scrollte an neunzig Zeilen vorbei, um eine zu finden. Zugeklappt sind es
 * jetzt 21 Zeilen.
 *
 * Rein und UI-frei (Muster aus [tree-komponenten.md](../../../../docs/architecture/tree-komponenten.md)):
 * hier steht die Struktur, nicht ihre Darstellung.
 */
import type { TfTreeItem, TfTreeItems } from '@/components/tree';
import type { KatalogEintrag } from '@/core/sichtbarkeit';

export const SICHTBARKEIT_BAUM_ROOT = 'sichtbarkeit-wurzel';

/** Die Startseiten-Widgets stehen unter einem eigenen Knoten (s. u.). */
export const WIDGET_GRUPPE_ID = 'gruppe:startseiten-widgets';

export type SichtbarkeitsKnoten =
  | { art: 'wurzel' }
  | { art: 'gruppe'; titel: string }
  | { art: 'eintrag'; eintrag: KatalogEintrag };

/** Reiter vor Abschnitten — die Reihenfolge liest sich als Weg durch die Seite. */
const ART_RANG: Record<KatalogEintrag['art'], number> = {
  seite: 0, reiter: 1, abschnitt: 2, widget: 3,
};

export interface SichtbarkeitsBaum {
  items: TfTreeItems<SichtbarkeitsKnoten>;
  rootId: string;
  /** Alle Ordner-Ids — für „alles auf-/zuklappen". */
  ordnerIds: string[];
}

/**
 * Baut den Bestand aus dem Katalog.
 *
 * Die Widgets tragen `seite: 'home'`, hängen aber bewusst an einem eigenen
 * Knoten: sie haben eine eigene Verwaltung und eine persönliche Anordnung, und
 * unter „Home" verschwänden sechzehn Zeilen hinter einer.
 */
export function baueSichtbarkeitsBaum(katalog: readonly KatalogEintrag[]): SichtbarkeitsBaum {
  const items: Record<string, TfTreeItem<SichtbarkeitsKnoten>> = {};
  const wurzelKinder: string[] = [];
  const ordnerIds: string[] = [];

  const blatt = (e: KatalogEintrag): void => {
    items[e.id] = { id: e.id, name: e.label, isFolder: false, data: { art: 'eintrag', eintrag: e } };
  };

  for (const seite of katalog.filter(e => e.art === 'seite')) {
    const kinder = katalog
      .filter(e => e.seite === seite.seite && e.art !== 'seite' && e.art !== 'widget')
      .sort((a, b) => ART_RANG[a.art] - ART_RANG[b.art]);
    for (const k of kinder) blatt(k);
    items[seite.id] = {
      id: seite.id,
      name: seite.label,
      // Eine Seite ohne eigene Reiter oder Abschnitte ist KEIN Ordner: ein
      // Chevron, das nichts aufklappt, verspricht etwas, das nicht da ist.
      isFolder: kinder.length > 0,
      ...(kinder.length > 0 ? { children: kinder.map(k => k.id) } : {}),
      data: { art: 'eintrag', eintrag: seite },
    };
    if (kinder.length > 0) ordnerIds.push(seite.id);
    wurzelKinder.push(seite.id);
  }

  const widgets = katalog.filter(e => e.art === 'widget');
  if (widgets.length > 0) {
    for (const w of widgets) blatt(w);
    items[WIDGET_GRUPPE_ID] = {
      id: WIDGET_GRUPPE_ID,
      name: 'Startseiten-Widgets',
      isFolder: true,
      children: widgets.map(w => w.id),
      data: { art: 'gruppe', titel: 'Startseiten-Widgets' },
    };
    ordnerIds.push(WIDGET_GRUPPE_ID);
    wurzelKinder.push(WIDGET_GRUPPE_ID);
  }

  items[SICHTBARKEIT_BAUM_ROOT] = {
    id: SICHTBARKEIT_BAUM_ROOT,
    name: 'Sichtbarkeit',
    isFolder: true,
    children: wurzelKinder,
    data: { art: 'wurzel' },
  };

  return { items, rootId: SICHTBARKEIT_BAUM_ROOT, ordnerIds };
}

/** Die Katalog-Einträge unter einem Ordner — für den Zähler an der zugeklappten Zeile. */
export function kinderEintraege(
  baum: SichtbarkeitsBaum, ordnerId: string,
): KatalogEintrag[] {
  const ids = baum.items[ordnerId]?.children ?? [];
  const raus: KatalogEintrag[] = [];
  for (const id of ids) {
    const daten = baum.items[id]?.data;
    if (daten?.art === 'eintrag') raus.push(daten.eintrag);
  }
  return raus;
}
