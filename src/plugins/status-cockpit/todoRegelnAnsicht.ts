/**
 * Das **Ansichts-Modell** der To-do-Kaskade — ohne React, damit es prüfbar ist.
 *
 * Der Regeln-Tab zeigt dieselbe Regel in drei Gestalten (breite Karte, schlanke
 * Zeile, Detail-Spalte). Welche Zustände eine Regel hat und welche Regeln
 * überhaupt in einem Regelsatz stehen, darf deshalb nicht dreimal danebenstehen:
 * jede Kopie wäre eine Driftquelle, und die Auswahl der sichtbaren Regeln hängt
 * an Pitfall #47 (Sperren erscheinen in JEDEM Satz, gewöhnliche Regeln nur im
 * eigenen). Hier steht sie einmal — und ist damit node-testbar.
 */
import {
  regelsatzVon, sperreGiltFuer, REGELSATZ_DEFAULT,
  type PlatzhalterGruppe, type Rolle, type TodoRegel,
} from '@/core/status';

/**
 * Die Warnung, die an jedem Nicht-AB-Regelsatz steht.
 *
 * `status-katalog.json` ist für alle Build-Varianten gleichzeitig live. Eine
 * aktive FB-Regel würde von jeder Installation unter v2.391 in der AB-Kaskade
 * mitgewertet, weil deren Engine das Feld `regelsatz` nicht kennt — und dort
 * eine Aufgabe erzeugen, die es nicht gibt.
 */
export const ROLLOUT_HINWEIS = 'Regelsätze außer AB werden von Installationen unter v2.391 in der '
  + 'AB-Kaskade mitgewertet. Erst aktivieren, wenn alle Varianten aktualisiert sind.';

/** Der Ausschnitt der Cockpit-API, den der Regeln-Tab braucht. */
export interface TodoRegelnApi {
  setTodoRegel: (id: string, patch: Partial<TodoRegel>) => void;
  verschiebeTodoRegel: (id: string, richtung: -1 | 1) => void;
  todoRegelnNachziehen: () => void;
  /** Was die Auslieferung gegenüber der gepflegten Kaskade anders sagt. */
  todoDrift: { neu: string[]; geaendert: string[]; entfallen: string[] };
  /** Eine Regel aus einem Platzhalter erzeugen — stillgelegt, vorbefüllt. */
  todoRegelAusPlatzhalter: (g: PlatzhalterGruppe) => void;
}

/**
 * Die Regeln, die in einem Regelsatz sichtbar sind — in Kaskaden-Reihenfolge.
 *
 * Sperren erscheinen in jedem Satz, in dem sie greifen; eine unsichtbare Sperre
 * wäre genau die stille Leere, die das Board vermeidet.
 */
export function sichtbareRegeln(alle: readonly TodoRegel[], satz: Rolle): TodoRegel[] {
  return alle
    .filter(r => ((r.sperrt?.length ?? 0) > 0 ? sperreGiltFuer(r, satz) : regelsatzVon(r) === satz))
    .sort((a, b) => a.reihenfolge - b.reihenfolge);
}

/** Die gewählte Regel samt Position — oder `null`, wenn sie (nicht mehr) dasteht. */
export interface RegelAuswahl {
  regel: TodoRegel;
  /** 0-basiert, wie der Listen-Index. */
  index: number;
  anzahl: number;
}

/**
 * Die Auswahl **ableiten** statt synchronisieren: verschwindet die Regel (Satz
 * gewechselt, Entwurf verworfen, Fassung neu geladen), liefert das hier `null`
 * und die Detail-Spalte schließt sich von selbst — ohne `useEffect`, der dem
 * Render hinterherräumt.
 */
export function waehleRegel(regeln: readonly TodoRegel[], gewaehlt: string | null): RegelAuswahl | null {
  if (gewaehlt === null) return null;
  const index = regeln.findIndex(r => r.id === gewaehlt);
  const regel = regeln[index];
  if (regel === undefined) return null;
  return { regel, index, anzahl: regeln.length };
}

/** Die vier Zustände, die Karte, Zeile und Detail gleichermaßen anzeigen. */
export interface Zustandsmarker {
  istSperre: boolean;
  /** Gehört die Regel dem gezeigten Satz? Nur dann ist sie verschiebbar. */
  eigen: boolean;
  stillgelegt: boolean;
  /** Sperre ohne `giltFuer` — sie wirkt in jedem Regelsatz. */
  giltFuerAlle: boolean;
  /** Feld-Referenzen, die der Katalog nicht kennt (die Regel träfe nie zu). */
  unbekannte: readonly string[];
}

export function zustandsMarker(
  r: TodoRegel, satz: Rolle, unbekannte: readonly string[],
): Zustandsmarker {
  const istSperre = (r.sperrt?.length ?? 0) > 0;
  // Eine vorgangsweite Sperre erscheint in JEDEM Satz — verschieben lässt sie
  // sich aber nur dort, wo sie zu Hause ist: sonst bewegte ein Klick im FB-Tab
  // eine Regel, die im AB-Tab an anderer Stelle steht.
  const eigen = regelsatzVon(r) === satz;
  return { istSperre, eigen, stillgelegt: !r.aktiv, giltFuerAlle: istSperre && !eigen, unbekannte };
}

/** `Position 5 von 27` — 1-basiert angezeigt über 0-basiertem Index. */
export function positionsText(index: number, anzahl: number): string {
  return `Position ${index + 1} von ${anzahl}`;
}

/**
 * Braucht das Aktivieren eine Rückfrage? Nur das AKTIVIEREN einer Regel außerhalb
 * des AB-Satzes ist die Aktion mit Fernwirkung (siehe `ROLLOUT_HINWEIS`);
 * Stilllegen ist immer harmlos.
 *
 * Rein, damit die Bedingung ohne `window`-Mock prüfbar bleibt — das `confirm`
 * selbst steht in der Komponente.
 */
export function brauchtRolloutRueckfrage(r: TodoRegel, an: boolean): boolean {
  return an && regelsatzVon(r) !== REGELSATZ_DEFAULT;
}
