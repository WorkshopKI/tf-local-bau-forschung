/**
 * Der Textbaustein-Katalog als Hierarchie: Bereich → Überkategorie → Thema →
 * Baustein.
 *
 * Die Struktur steckt bereits im Datensatz (`artefaktTyp`, `kategorie`,
 * `thema`) — sie war nur unsichtbar, weil die Verwaltung eine flache Liste
 * zeigte. Hier wird sie abgeleitet, nicht erfunden: **Gruppenknoten sind
 * berechnet, nur Bausteine sind Datensätze**.
 *
 * **IDs sind unantastbar.** Sie stehen in versandten NF-Dokumenten und kodieren
 * den Scope (`G…` Gesamtvorhaben, `T…` Teilvorhaben). Verschieben ändert
 * ausschließlich `thema`, nie die Id — und nur innerhalb derselben
 * Überkategorie, weil die Überkategorie im Bestand am ID-Stamm hängt
 * (`G`→Gesamtvorhaben, `T1`→Entwicklung, `T2`→Aufträge & Personal,
 * `T3`→Kosten & Verwertung). Ein Zug darüber hinweg ließe Id und Beschriftung
 * auseinanderlaufen und wäre eine fachliche Scope-Änderung, kein Umsortieren.
 *
 * Rein und UI-frei.
 */
import type { BausteinArtefaktTyp, TextbausteinRecord } from '@/core/services/skills';
import type { TfTreeItem, TfTreeItems } from '@/components/tree';
import { scopeAusId } from './textbausteinKatalogOps';
import { TYP_LABEL } from './textbausteinLabels';

export const BAUSTEIN_BAUM_ROOT = 'bausteine-root';

/** Reihenfolge der Bereiche — wie in der flachen Liste (`filterBausteine`). */
const TYP_RANG: Record<BausteinArtefaktTyp, number> = { nf: 0, rne: 1, abl: 2 };

/** Fallback-Beschriftung, wo der Datensatz kein Feld gefüllt hat. */
export const OHNE_KATEGORIE = 'Ohne Überkategorie';
export const OHNE_THEMA = 'Ohne Thema';

export const bereichKnotenId = (typ: BausteinArtefaktTyp): string => `typ:${typ}`;
export const kategorieKnotenId = (typ: BausteinArtefaktTyp, kategorie: string): string =>
  `kat:${typ}|${kategorie}`;
export const themaKnotenId = (typ: BausteinArtefaktTyp, kategorie: string, thema: string): string =>
  `thema:${typ}|${kategorie}|${thema}`;
export const bausteinKnotenId = (id: string): string => `baustein:${id}`;

/** Die Gruppen-Koordinate eines Bausteins. */
export interface BausteinGruppe {
  typ: BausteinArtefaktTyp;
  kategorie: string;
  thema: string;
}

/** Nutzlast eines Baumknotens. */
export type BausteinKnoten =
  | { art: 'wurzel' }
  | { art: 'bereich'; typ: BausteinArtefaktTyp; anzahl: number }
  | { art: 'kategorie'; typ: BausteinArtefaktTyp; kategorie: string; anzahl: number }
  | { art: 'thema'; gruppe: BausteinGruppe; anzahl: number }
  | { art: 'baustein'; baustein: TextbausteinRecord };

export interface BausteinBaum {
  items: TfTreeItems<BausteinKnoten>;
  rootId: string;
}

/** Die Gruppen-Koordinate eines Records — mit Fallbacks für leere Felder. */
export function gruppeVon(b: TextbausteinRecord): BausteinGruppe {
  return {
    typ: b.artefaktTyp,
    kategorie: b.kategorie.trim() || OHNE_KATEGORIE,
    thema: b.thema.trim() || OHNE_THEMA,
  };
}

const nachId = (a: TextbausteinRecord, b: TextbausteinRecord): number =>
  a.id.localeCompare(b.id, 'de', { numeric: true });

/**
 * Baut den Baum aus einer (bereits gefilterten) Baustein-Liste.
 *
 * Gruppen erscheinen in der Reihenfolge ihrer **kleinsten Id** — damit steht
 * „Gesamtvorhaben" (G…) vor „Entwicklung" (T1…) und die Ordnung entspricht der
 * fachlichen Nummerierung, nicht dem Alphabet der Beschriftungen.
 */
export function baueBausteinBaum(bausteine: readonly TextbausteinRecord[]): BausteinBaum {
  const sortiert = [...bausteine].sort(nachId);
  const items: Record<string, TfTreeItem<BausteinKnoten>> = {};

  /** Einfügereihenfolge je Elternknoten — die kleinste Id kommt zuerst an. */
  const kinder = new Map<string, string[]>();
  const anhaengen = (elternId: string, kindId: string): void => {
    const liste = kinder.get(elternId) ?? [];
    if (!liste.includes(kindId)) liste.push(kindId);
    kinder.set(elternId, liste);
  };
  const zaehler = new Map<string, number>();
  const zaehlen = (id: string): void => { zaehler.set(id, (zaehler.get(id) ?? 0) + 1); };

  for (const b of sortiert) {
    const g = gruppeVon(b);
    const bereichId = bereichKnotenId(g.typ);
    const katId = kategorieKnotenId(g.typ, g.kategorie);
    const themaId = themaKnotenId(g.typ, g.kategorie, g.thema);

    anhaengen(BAUSTEIN_BAUM_ROOT, bereichId);
    anhaengen(bereichId, katId);
    anhaengen(katId, themaId);
    anhaengen(themaId, bausteinKnotenId(b.id));
    zaehlen(bereichId); zaehlen(katId); zaehlen(themaId);

    items[bausteinKnotenId(b.id)] = {
      id: bausteinKnotenId(b.id), name: b.id, isFolder: false,
      data: { art: 'baustein', baustein: b },
    };
    items[themaId] ??= {
      id: themaId, name: g.thema, isFolder: true, children: [],
      data: { art: 'thema', gruppe: g, anzahl: 0 },
    };
    items[katId] ??= {
      id: katId, name: g.kategorie, isFolder: true, children: [],
      data: { art: 'kategorie', typ: g.typ, kategorie: g.kategorie, anzahl: 0 },
    };
    items[bereichId] ??= {
      id: bereichId, name: TYP_LABEL[g.typ], isFolder: true, children: [],
      data: { art: 'bereich', typ: g.typ, anzahl: 0 },
    };
  }

  // Bereiche folgen dem festen Rang, alles darunter der Id-Reihenfolge.
  const wurzelKinder = (kinder.get(BAUSTEIN_BAUM_ROOT) ?? [])
    .sort((a, b) => TYP_RANG[typAusBereichId(a)] - TYP_RANG[typAusBereichId(b)]);

  for (const [elternId, liste] of kinder) {
    if (elternId === BAUSTEIN_BAUM_ROOT) continue;
    const knoten = items[elternId];
    if (knoten) {
      items[elternId] = { ...knoten, children: liste, data: mitAnzahl(knoten.data, zaehler.get(elternId) ?? 0) };
    }
  }

  items[BAUSTEIN_BAUM_ROOT] = {
    id: BAUSTEIN_BAUM_ROOT, name: 'Textbausteine', isFolder: true,
    children: wurzelKinder, data: { art: 'wurzel' },
  };
  return { items, rootId: BAUSTEIN_BAUM_ROOT };
}

function typAusBereichId(id: string): BausteinArtefaktTyp {
  return id.slice('typ:'.length) as BausteinArtefaktTyp;
}

function mitAnzahl(d: BausteinKnoten, anzahl: number): BausteinKnoten {
  return d.art === 'bereich' || d.art === 'kategorie' || d.art === 'thema' ? { ...d, anzahl } : d;
}

/**
 * Darf `quelle` unter das Thema `ziel` gezogen werden?
 *
 * Gesperrt: anderer Bereich, andere Überkategorie, anderer Scope-Ast (G↔T) und
 * das Thema, in dem der Baustein schon liegt. Alles davon wäre keine
 * Umsortierung, sondern eine fachliche Umwidmung.
 *
 * `alle` wird gebraucht, um den Scope des ZIELS zu bestimmen — ein Thema hat
 * keinen eigenen, es erbt ihn von seinen Bausteinen. Bewusst als Parameter und
 * nicht als Modul-Merker: die Prüfung bleibt damit rein.
 */
export function darfVerschieben(
  quelle: TextbausteinRecord, ziel: BausteinGruppe, alle: readonly TextbausteinRecord[],
): boolean {
  const g = gruppeVon(quelle);
  if (g.typ !== ziel.typ) return false;
  if (g.kategorie !== ziel.kategorie) return false;
  if (g.thema === ziel.thema) return false;
  // Bei NF hängt der Scope an der Id; er darf sich beim Verschieben nicht
  // ändern. Für den Bestand deckt schon die Überkategorie-Regel das ab (sie
  // folgt dem Id-Stamm) — bei von Hand umkuratierten Kategorien nicht mehr.
  if (g.typ === 'nf') {
    const zielScope = bausteineImThema(alle, ziel).map(b => scopeAusId(b.id)).find(s => s !== undefined);
    if (zielScope !== undefined && zielScope !== scopeAusId(quelle.id)) return false;
  }
  return true;
}

/** Alle Bausteine einer Thema-Gruppe (in Id-Reihenfolge). */
export function bausteineImThema(
  bausteine: readonly TextbausteinRecord[], gruppe: BausteinGruppe,
): TextbausteinRecord[] {
  return bausteine
    .filter(b => {
      const g = gruppeVon(b);
      return g.typ === gruppe.typ && g.kategorie === gruppe.kategorie && g.thema === gruppe.thema;
    })
    .sort(nachId);
}
