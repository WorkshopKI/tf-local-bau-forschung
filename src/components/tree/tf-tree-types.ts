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
  /** Pfeiltasten, Home/End. Default: an. */
  hotkeys?: boolean;
  /** Umbenennen per F2 bzw. Doppelklick. Braucht `onRename`. */
  renaming?: boolean;
  /** Ziehen und Ablegen. Braucht `onDrop`; ohne `canDrop` ist alles erlaubt. */
  dnd?: boolean;
  /**
   * Nur mit `dnd`: Ablegen ZWISCHEN Geschwistern (Umsortieren) statt nur
   * hinein. Default aus — wo die Reihenfolge aus den Daten folgt (z. B. nach
   * Id sortiert), wäre eine freie Sortierung eine Lüge über den nächsten
   * Neuaufbau hinweg.
   */
  reorder?: boolean;
  /**
   * Nur mit `dnd`: Gezogen wird an einem eigenen Griff, nicht an der ganzen
   * Zeile. Nötig, sobald die Zeile Eingabefelder trägt — sonst startet der
   * Versuch, eine Zahl zu markieren, einen Drag.
   */
  dragHandle?: boolean;
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
  /** Die Zeile wird gerade umbenannt (nur mit `renaming`). */
  isRenaming: boolean;
  /** Ein Ziehen läuft und DIESE Zeile ist das Ziel (nur mit `dnd`). */
  isDropZiel: boolean;
  /** Auf das Zeilen-Element spreaden — enthält `ref`, ARIA, Tastatur, Klick. */
  zeilenProps: Record<string, unknown>;
  /** Auf das Umbenennen-Eingabefeld spreaden; `null`, wenn nicht umbenannt wird. */
  renameProps: Record<string, unknown> | null;
  /** Auf den Zieh-Griff spreaden; `null` ohne `features.dragHandle`. */
  dragHandleProps: Record<string, unknown> | null;
  /** Häkchen umschalten (No-op ohne `checkboxes`). */
  toggleChecked: () => void;
  /** Umbenennen starten (No-op ohne `renaming` bzw. wenn `canRename` verneint). */
  starteUmbenennen: () => void;
}

/**
 * Optionale Bausteine je Zeile — der Regelfall, statt `renderNode` zu ersetzen.
 * Jeder Slot bekommt dieselben Render-Props wie die Zeile selbst.
 */
export interface TfTreeSlots<T> {
  /** Ganz links, vor dem Chevron — z. B. der Zieh-Griff (`dragHandleProps`). */
  leading?: (p: TfTreeNodeRenderProps<T>) => ReactNode;
  icon?: (p: TfTreeNodeRenderProps<T>) => ReactNode;
  /** Ersetzt die Standard-Beschriftung (`name`). */
  label?: (p: TfTreeNodeRenderProps<T>) => ReactNode;
  /** Rechtsbündig: Zähler, Badges, Aktionen. */
  trailing?: (p: TfTreeNodeRenderProps<T>) => ReactNode;
  /**
   * Aufklappbarer Bereich UNTER der Zeile — für Detail-Editoren, die zu einem
   * Knoten gehören. Wann er erscheint, entscheidet der Verbraucher (`null` =
   * nicht); das Chevron bleibt beim Auf-/Zuklappen der KINDER, sonst hätte eine
   * Zeile zwei Bedeutungen für dasselbe Dreieck.
   */
  body?: (p: TfTreeNodeRenderProps<T>) => ReactNode;
  /**
   * Reicher Tooltip an Icon + Beschriftung. `undefined` für eine Zeile heißt:
   * kein HoverCard-Element — Zeilen ohne Zusatzinfo kosten nichts. Die
   * Checkbox liegt bewusst außerhalb des Triggers, damit der Tooltip sie nicht
   * überdeckt.
   */
  hoverContent?: (p: TfTreeNodeRenderProps<T>) => ReactNode;
  /**
   * Einträge des Rechtsklick-Menüs. `null` für eine Zeile heißt: kein Menü.
   * Der Baum liefert nur die Hülle; die Einträge kommen vom Verbraucher.
   */
  contextMenu?: (p: TfTreeNodeRenderProps<T>) => ReactNode;
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

  /** Darf diese Zeile umbenannt werden? Ohne Angabe: ja (mit `renaming`). */
  canRename?: (id: string, data: T) => boolean;
  /** Umbenennen bestätigt. Der Baum schreibt NICHTS selbst — das tut der Verbraucher. */
  onRename?: (id: string, neuerName: string, data: T) => void;

  /** Darf gezogen werden? Ohne Angabe: ja (mit `dnd`). */
  canDrag?: (ids: string[]) => boolean;
  /** Ist `zielId` als neuer Elternknoten erlaubt? Ohne Angabe: ja. */
  canDrop?: (quellIds: string[], zielId: string) => boolean;
  /**
   * Abgelegt. `index` ist die Einfügeposition unter `zielId` und nur mit
   * `features.reorder` gesetzt; sonst `undefined` („irgendwo hinein").
   */
  onDrop?: (quellIds: string[], zielId: string, index?: number) => void;
}
