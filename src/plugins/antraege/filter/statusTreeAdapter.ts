/**
 * Der Status-Filter als Baum: Phase (Ordner) → Status (Blatt).
 *
 * Rein und UI-frei — die Abbildung zwischen Baum und Filter-Store ist die
 * Stelle, an der man sich vertut, nicht das Rendern.
 *
 * **Ein Blatt ist nicht ein Wert.** Derselbe Status steht im Export mal
 * ausgeschrieben, mal abgekürzt; `GroupedItem.schreibweisen` bündelt das
 * (siehe `statusGroups.ts`). Ein Häkchen setzt deshalb ALLE Schreibweisen, und
 * ein gespeicherter Filter mit nur einer davon zählt als gesetzt.
 *
 * **Fremde Werte überleben.** Ein gespeichertes Preset kann Status führen, die
 * im aktuellen Bestand gar nicht vorkommen und deshalb in keinem Blatt stehen.
 * `filterAusChecked` lässt sie unangetastet — sonst wischte ein beliebiger
 * Klick im Baum still fremde Filterwerte weg.
 */
import type { TfTreeItem, TfTreeItems } from '@/components/tree';
import type { GroupedItem, GroupedPhase, PhaseId } from './statusGroups';

export const STATUS_BAUM_ROOT = 'status-root';

export const phaseKnotenId = (id: PhaseId): string => `phase:${id}`;
export const statusKnotenId = (value: string): string => `status:${value}`;

/** Nutzlast eines Baumknotens. Die Wurzel wird nie gerendert, braucht aber eine. */
export type StatusKnoten =
  | { art: 'wurzel' }
  | { art: 'phase'; phase: GroupedPhase }
  | { art: 'status'; item: GroupedItem; phaseId: PhaseId };

export interface StatusBaum {
  items: TfTreeItems<StatusKnoten>;
  rootId: string;
}

/**
 * Baut den Baum aus den bereits gruppierten Phasen. Reihenfolge, Zählung und
 * die „auch mit count 0 zeigen"-Regel kommen unverändert aus `groupStatusValues`
 * — hier wird nur umgehängt, nicht neu entschieden.
 *
 * Leere Phasen fallen weg: eine Gruppe ohne Einträge wäre ein Ordner, den man
 * aufklappt und der leer ist.
 */
export function baueStatusBaum(phasen: readonly GroupedPhase[]): StatusBaum {
  const items: Record<string, TfTreeItem<StatusKnoten>> = {};
  const wurzelKinder: string[] = [];

  for (const phase of phasen) {
    if (phase.items.length === 0) continue;
    const phaseId = phaseKnotenId(phase.id);
    const kinder: string[] = [];

    for (const item of phase.items) {
      const id = statusKnotenId(item.value);
      // Zwei Einträge mit identischer Anzeige-Schreibweise wären ein Katalog-
      // Fehler; still doppelte Baum-Ids wären schlimmer als der erste sichtbar.
      if (items[id]) continue;
      items[id] = {
        id, name: item.value, isFolder: false,
        data: { art: 'status', item, phaseId: phase.id },
      };
      kinder.push(id);
    }

    items[phaseId] = {
      id: phaseId, name: phase.label, isFolder: true, children: kinder,
      data: { art: 'phase', phase },
    };
    wurzelKinder.push(phaseId);
  }

  items[STATUS_BAUM_ROOT] = {
    id: STATUS_BAUM_ROOT, name: 'Status', isFolder: true, children: wurzelKinder,
    data: { art: 'wurzel' },
  };

  return { items, rootId: STATUS_BAUM_ROOT };
}

/** Gilt das Blatt als gesetzt? Sobald IRGENDEINE seiner Schreibweisen im Filter steht. */
export function istGesetzt(item: GroupedItem, selected: ReadonlySet<string>): boolean {
  return item.schreibweisen.some(s => selected.has(s));
}

/** Filter-Werte → angehakte Blatt-Ids. */
export function checkedAusFilter(
  phasen: readonly GroupedPhase[], selected: readonly string[],
): string[] {
  const gesetzt = new Set(selected);
  const ids: string[] = [];
  for (const phase of phasen) {
    for (const item of phase.items) {
      if (istGesetzt(item, gesetzt)) ids.push(statusKnotenId(item.value));
    }
  }
  return ids;
}

/**
 * Angehakte Blatt-Ids → Filter-Werte. `selected` wird gebraucht, um Werte zu
 * erhalten, die zu keinem Blatt gehören (siehe Modulkopf), und um die bisherige
 * Reihenfolge nicht zu würfeln.
 */
export function filterAusChecked(
  phasen: readonly GroupedPhase[], checked: readonly string[], selected: readonly string[],
): string[] {
  const gehakt = new Set(checked);
  const imBaum = new Set<string>();
  const gewuenscht = new Set<string>();

  for (const phase of phasen) {
    for (const item of phase.items) {
      const an = gehakt.has(statusKnotenId(item.value));
      for (const s of item.schreibweisen) {
        imBaum.add(s);
        if (an) gewuenscht.add(s);
      }
    }
  }

  const raus: string[] = [];
  const gesehen = new Set<string>();
  for (const v of selected) {
    if (gesehen.has(v)) continue;
    // Nicht im Baum ⇒ fremd ⇒ unangetastet. Im Baum ⇒ nur behalten, wenn gehakt.
    if (!imBaum.has(v) || gewuenscht.has(v)) { raus.push(v); gesehen.add(v); }
  }
  for (const v of gewuenscht) {
    if (!gesehen.has(v)) { raus.push(v); gesehen.add(v); }
  }
  return raus;
}

/** Was der Tooltip eines Status-Blattes zeigt. */
export interface StatusHoverDaten {
  /** Gruppe, in der der Status hängt (ZAH-Phase, Marker oder „Nicht im Katalog"). */
  gruppe: string;
  /** Aktuelle Anzahl im gefilterten Bestand. */
  anzahl: number;
  /** Herkunft — die eigentliche Aussage: kennt der Katalog den Wert? */
  herkunft: 'kuratiert' | 'nicht im Katalog';
  /** Weitere Schreibweisen desselben Codes (ohne die angezeigte). */
  weitereSchreibweisen: readonly string[];
}

/**
 * Der Tooltip-Inhalt eines Status-Blattes — rein, damit er ohne DOM prüfbar
 * bleibt und leicht austauschbar ist.
 *
 * `designed: false` heißt **im Export gesehen, im Katalog nicht geführt**. Das
 * ist keine Randnotiz, sondern der Kuratier-Hinweis an die PL; deshalb steht er
 * im Tooltip und nicht nur in der Gruppenüberschrift.
 */
export function statusHoverDaten(item: GroupedItem, gruppenLabel: string): StatusHoverDaten {
  return {
    gruppe: gruppenLabel,
    anzahl: item.count,
    herkunft: item.designed ? 'kuratiert' : 'nicht im Katalog',
    weitereSchreibweisen: item.schreibweisen.filter(s => s !== item.value),
  };
}

/**
 * Such-Filter über die Phasen. Gesucht wird über **alle** Schreibweisen — wer
 * „Rücknahmeempf." eintippt (so steht es im Export), soll den Eintrag finden.
 *
 * Leere Suche gibt die **identische Referenz** zurück, nicht eine gleiche Kopie:
 * daran hängen `useMemo` und ein Effekt, die sonst bei jedem Render neu liefen.
 */
export function filtereStatusPhasen(
  phasen: GroupedPhase[], query: string,
): GroupedPhase[] {
  const q = query.trim().toLowerCase();
  if (!q) return phasen;
  return phasen
    .map(p => ({ ...p, items: p.items.filter(it => it.schreibweisen.some(s => s.toLowerCase().includes(q))) }))
    .filter(p => p.items.length > 0);
}
