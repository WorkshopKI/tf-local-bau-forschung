/**
 * Was die Liste GERADE WIRKLICH zeigt — für die Oberflächen, die daneben stehen
 * und es nicht selbst wissen können.
 *
 * **Warum es das braucht.** Die Pipeline in `useFilteredAntraege` endet mit
 * `filtered`. Danach schränkt die Tabelle noch dreimal weiter ein — Spaltenkopf-
 * Trichter (`useColumnFilters`), Beendet-Achse (`partitionArbeitsvorrat`) und
 * Zeilen-Körnung. Wer nur `filtered` liest, sieht diese drei Stufen nicht. Genau
 * daran scheiterten bis v4.121 zwei Zusagen:
 *
 * - die Massenleiste schnitt gegen `filtered` und exportierte 12 359 Zeilen,
 *   während die Tabelle darüber 1 763 zeigte — obwohl ihr eigener Modulkopf
 *   verspricht, „dass nie etwas exportiert wird, das gerade gar nicht dasteht";
 * - der Kopfzeilen-Export tat dasselbe unter dem Titel „die gefilterte Liste".
 *
 * **Die Meldung kommt von der Ansicht selbst**, nicht von einem zweiten Nachbau:
 * jede Ansicht meldet die Schlüssel, die sie zeigt, und beim Verlassen `null`.
 * `null` heisst „keine Ansicht schränkt gerade ein" — dann gilt `filtered`, und
 * das ist der richtige Rückfall (Karten-Ansicht, Leerzustand, erster Render).
 *
 * **Der Schlüssel ist immer ein Teilvorhaben** (`aktenzeichen`) — dieselbe
 * Vereinbarung wie in `useAntraegeAuswahl`: eine verdichtete Verbund-Zeile meldet
 * alle ihre TVs, sonst hinge an der Auswahl eine Bedeutung, die sich beim
 * Umschalten der Ansicht ändert.
 *
 * Die selbst angelegten Spalten liegen aus demselben Grund hier: gebaut werden
 * sie EINMAL in `AntraegeMain` (mit dem dortigen Stichtag und Feld-Vorrat), und
 * der Export soll dieselben Instanzen nehmen — „mit den Spalten der Ansicht"
 * heisst sonst „mit den eingebauten davon".
 */
import { create } from 'zustand';
import type { SortableColumn } from '@/components/data-table/types';
import type { AntragTableRow } from './tableGrouping';

interface TabellenSichtStore {
  /** Aktenzeichen der TV, die die Ansicht gerade zeigt. `null` = keine Meldung. */
  sichtbareTvs: ReadonlySet<string> | null;
  /**
   * Dieselben Schluessel in der REIHENFOLGE der Ansicht (Kopf-Sortierung,
   * Gruppierung, Zeilen-Koernung). `null` = keine eigene Ordnung.
   *
   * Der Export schrieb bis v4.123 die Reihenfolge der Pipeline: wer im
   * Spaltenkopf sortierte und danach exportierte, bekam eine Datei, deren
   * Zeilenfolge nichts mit dem Bildschirm zu tun hatte (v4.124).
   */
  sichtbareReihenfolge: readonly string[] | null;
  /** Selbst angelegte Spalten, wie die Ansicht sie gebaut hat. */
  eigeneSpalten: readonly SortableColumn<AntragTableRow>[];
  meldeSichtbare: (keys: ReadonlySet<string> | null, reihenfolge?: readonly string[] | null) => void;
  meldeEigeneSpalten: (spalten: readonly SortableColumn<AntragTableRow>[]) => void;
}

export const useTabellenSicht = create<TabellenSichtStore>((set, get) => ({
  sichtbareTvs: null,
  sichtbareReihenfolge: null,
  eigeneSpalten: [],

  meldeSichtbare: (keys, reihenfolge = null) => {
    if (get().sichtbareTvs === keys && get().sichtbareReihenfolge === reihenfolge) return;
    set({ sichtbareTvs: keys, sichtbareReihenfolge: reihenfolge });
  },

  meldeEigeneSpalten: (spalten) => {
    if (get().eigeneSpalten === spalten) return;
    set({ eigeneSpalten: spalten });
  },
}));

/**
 * Eine Liste auf das beschneiden, was gerade dasteht. `null` (keine Meldung)
 * lässt sie unverändert — das ist kein Fehler, sondern der Normalfall in
 * Ansichten ohne eigene Einschränkung.
 */
export function beschraenkeAufSichtbare<T extends { aktenzeichen: string }>(
  liste: readonly T[],
  sichtbareTvs: ReadonlySet<string> | null,
  reihenfolge?: readonly string[] | null,
): T[] {
  if (sichtbareTvs === null) return [...liste];
  const gefiltert = liste.filter(a => sichtbareTvs.has(a.aktenzeichen));
  if (!reihenfolge || reihenfolge.length === 0) return gefiltert;
  // In der Ordnung der ANSICHT: Unbekanntes haengt hinten an, statt vorn zu
  // landen (`indexOf` liefert -1).
  const rang = new Map(reihenfolge.map((k, i) => [k, i]));
  const hinten = reihenfolge.length;
  return gefiltert.sort(
    (a, b) => (rang.get(a.aktenzeichen) ?? hinten) - (rang.get(b.aktenzeichen) ?? hinten),
  );
}
