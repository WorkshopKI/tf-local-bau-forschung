/**
 * Öffentliche Typen der Tree-Basis.
 *
 * Bewusst **ohne** Typen aus `@headless-tree/*`: Verbraucher beschreiben ihren
 * Baum in diesen Begriffen, der Wrapper übersetzt. Damit bleibt der Guard
 * `no-headless-tree-outside-wrapper` haltbar, und ein Bibliothekswechsel wäre
 * eine Änderung an genau einer Stelle statt in jedem Verbraucher.
 */
import type { ReactNode } from 'react';

/** Ein Knoten. `data` ist die Nutzlast des Verbrauchers. */
export interface TfTreeItem<T> {
  id: string;
  /** Beschriftung — zugleich Grundlage für Typeahead und Umbenennen. */
  name: string;
  isFolder: boolean;
  data: T;
  /** Kind-Ids in Anzeige-Reihenfolge. Blätter lassen das Feld weg. */
  children?: readonly string[];
}

/** Der flache Knoten-Bestand: Id → Knoten. */
export type TfTreeItems<T> = Readonly<Record<string, TfTreeItem<T>>>;

/**
 * Welche Fähigkeiten der Baum haben soll. Tastaturnavigation (Pfeile, Home/End,
 * Typeahead) ist **default an** — sie ist der Grund für die gemeinsame Basis.
 *
 * Hier steht nur, was auch verdrahtet ist. Ein Flag, das nichts tut, wäre eine
 * Falle für den nächsten Verbraucher.
 */
export interface TfTreeFeatureFlags {
  /** Tri-State-Checkboxen; das Ordner-Häkchen wirkt auf alle Blätter darunter. */
  checkboxes?: boolean;
  /** Auswahl einzelner Knoten (Klick, Strg-/Shift-Klick). */
  selection?: boolean;
  /** Pfeiltasten, Home/End, Typeahead. Default: an. */
  hotkeys?: boolean;
}

/** Häkchen-Zustand eines Knotens. */
export type TfTreeCheckState = 'checked' | 'unchecked' | 'indeterminate';

/** Was eine Zeile beim Rendern bekommt. */
export interface TfTreeNodeRenderProps<T> {
  id: string;
  name: string;
  data: T;
  /** 0 = oberste Ebene unter der Wurzel. */
  level: number;
  isFolder: boolean;
  isExpanded: boolean;
  isFocused: boolean;
  isSelected: boolean;
  /** `null`, wenn der Baum ohne Checkboxen läuft. */
  checked: TfTreeCheckState | null;
  /** Auf das Zeilen-Element spreaden — enthält `ref`, ARIA, Tastatur, Klick. */
  zeilenProps: Record<string, unknown>;
  /** Häkchen umschalten (No-op ohne `checkboxes`). */
  toggleChecked: () => void;
}

/**
 * Optionale Bausteine je Zeile — der Regelfall, statt `renderNode` zu ersetzen.
 * Jeder Slot bekommt dieselben Render-Props wie die Zeile selbst.
 */
export interface TfTreeSlots<T> {
  icon?: (p: TfTreeNodeRenderProps<T>) => ReactNode;
  /** Ersetzt die Standard-Beschriftung (`name`). */
  label?: (p: TfTreeNodeRenderProps<T>) => ReactNode;
  /** Rechtsbündig: Zähler, Badges, Aktionen. */
  trailing?: (p: TfTreeNodeRenderProps<T>) => ReactNode;
  /**
   * Zusatz-Styles der Zeile — für Zustands-Akzente (z. B. eine linke Kante an
   * aktiven Ordnern). Wird über den Grundstil gelegt; Einzug und Polsterung
   * bleiben Sache der Zeile.
   */
  zeilenStil?: (p: TfTreeNodeRenderProps<T>) => React.CSSProperties | undefined;
}

/** Rückmeldungen des Baums — bewusst in Ids statt in Lib-Instanzen. */
export interface TfTreeCallbacks<T> {
  /** Enter bzw. Klick auf eine Zeile. Bei Ordnern läuft zusätzlich auf/zu. */
  onPrimaryAction?: (id: string, data: T) => void;
  /**
   * Läuft in der Capture-Phase, also VOR der Reaktion des Baums.
   * `e.stopPropagation()` unterdrückt sie — der Weg für Modifier-Kürzel
   * (Shift-Klick o. Ä.), ohne dass der Wrapper sie kennen muss.
   */
  onZeilenKlick?: (id: string, data: T, e: React.MouseEvent) => void;
}
