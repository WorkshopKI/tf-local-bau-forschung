/**
 * Die gemeinsame Tree-Basis der App — dünner Wrapper um `@headless-tree`.
 *
 * **Der einzige Ort, der `@headless-tree/*` importieren darf** (Guard
 * `no-headless-tree-outside-wrapper`). Verbraucher reichen einen flachen
 * Knoten-Bestand herein und bekommen Aufklappen, Tastaturnavigation, Auswahl
 * und Tri-State-Checkboxen — statt das je Modul erneut nachzubauen.
 *
 * **Controlled by default.** Jeder Zustand, für den ein `on…`-Callback gesetzt
 * ist, gehört dem Verbraucher; alles andere hält der Baum selbst. So bleibt der
 * Filter-Store bzw. der Katalog-Entwurf die Quelle der Wahrheit und es entsteht
 * keine zweite Kopie daneben.
 *
 * **Zeilen-Klick auf einem Blatt schaltet das Häkchen** (nur mit `checkboxes`).
 * Ordner behalten Auf-/Zuklappen — das ist das Verhalten aus dem Bestand und
 * das, was man aus dem Datei-Explorer kennt.
 */
import { Fragment, useCallback, useMemo, useState } from 'react';
import {
  CheckedState,
  checkboxesFeature,
  hotkeysCoreFeature,
  selectionFeature,
  syncDataLoaderFeature,
  type FeatureImplementation,
  type ItemInstance,
  type SetStateFn,
} from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import { TfTreeNode } from './TfTreeNode';
import type {
  TfTreeCallbacks, TfTreeCheckState, TfTreeFeatureFlags, TfTreeItem, TfTreeItems,
  TfTreeNodeRenderProps, TfTreeSlots,
} from './tf-tree-types';

/** Pixel je Ebene, wenn nichts anderes gesagt wird. */
const STANDARD_EINZUG = 18;

export interface TfTreeProps<T> extends TfTreeCallbacks<T> {
  items: TfTreeItems<T>;
  rootId: string;
  /** `aria-label` des Baums — für Screenreader Pflicht, deshalb kein Optional. */
  label: string;
  features?: TfTreeFeatureFlags;
  slots?: TfTreeSlots<T>;
  /** Ersatz für die Standard-Zeile. Ohne dieses Prop rendert `TfTreeNode`. */
  renderNode?: (p: TfTreeNodeRenderProps<T>, indent: number) => React.ReactNode;
  /** Aufgeklappte Ordner. Ohne `onExpandedChange` hält der Baum sie selbst. */
  expandedItems?: string[];
  onExpandedChange?: (ids: string[]) => void;
  /** Angehakte Blätter (nur mit `features.checkboxes`). */
  checkedItems?: string[];
  onCheckedChange?: (ids: string[]) => void;
  /** Ausgewählte Knoten (nur mit `features.selection`). */
  selectedItems?: string[];
  onSelectedChange?: (ids: string[]) => void;
  indent?: number;
  className?: string;
}

const CHECK_STATE: Record<CheckedState, TfTreeCheckState> = {
  [CheckedState.Checked]: 'checked',
  [CheckedState.Unchecked]: 'unchecked',
  [CheckedState.Indeterminate]: 'indeterminate',
};

/** Notnagel für Ids, die im selben Frame schon aus `items` verschwunden sind. */
const PLATZHALTER = <T,>(id: string): TfTreeItem<T> =>
  ({ id, name: '', isFolder: false, data: undefined as T });

/** Macht aus „aktueller Wert + Setzer" die `SetStateFn` der Bibliothek. */
function alsSetzer<S>(wert: S, aendern: (s: S) => void): SetStateFn<S> {
  return u => { aendern(typeof u === 'function' ? (u as (alt: S) => S)(wert) : u); };
}

export function TfTree<T>({
  items, rootId, label, features, slots, renderNode,
  expandedItems, onExpandedChange,
  checkedItems, onCheckedChange,
  selectedItems, onSelectedChange,
  onPrimaryAction, onZeilenKlick,
  indent = STANDARD_EINZUG,
  className,
}: TfTreeProps<T>): React.ReactElement {
  const mitCheckboxen = features?.checkboxes === true;
  const mitAuswahl = features?.selection === true;

  // Unkontrollierte Rückfallebene je Achse — greift nur, wo der Verbraucher
  // keinen Callback gesetzt hat.
  const [eigenOffen, setEigenOffen] = useState<string[]>([]);
  const [eigenGehakt, setEigenGehakt] = useState<string[]>([]);
  const [eigenGewaehlt, setEigenGewaehlt] = useState<string[]>([]);

  const offen = expandedItems ?? eigenOffen;
  const gehakt = checkedItems ?? eigenGehakt;
  const gewaehlt = selectedItems ?? eigenGewaehlt;

  const featureListe = useMemo<FeatureImplementation[]>(() => {
    const f: FeatureImplementation[] = [syncDataLoaderFeature];
    if (mitAuswahl) f.push(selectionFeature);
    if (mitCheckboxen) f.push(checkboxesFeature);
    if (features?.hotkeys !== false) f.push(hotkeysCoreFeature);
    return f;
  }, [mitAuswahl, mitCheckboxen, features?.hotkeys]);

  const tree = useTree<TfTreeItem<T>>({
    rootItemId: rootId,
    getItemName: item => item.getItemData()?.name ?? '',
    isItemFolder: item => item.getItemData()?.isFolder === true,
    dataLoader: {
      // Ändert sich `items`, rendert React einmal mit der NEUEN Menge, während
      // die Bibliothek noch die alte Zeilenliste hält — dann wird nach Ids
      // gefragt, die es nicht mehr gibt. Der Platzhalter hält diesen einen
      // Frame aus; gerendert wird er nicht (siehe Render-Schleife unten).
      getItem: id => items[id] ?? PLATZHALTER(id),
      getChildren: id => [...(items[id]?.children ?? [])],
    },
    indent,
    state: {
      expandedItems: offen,
      ...(mitCheckboxen ? { checkedItems: gehakt } : {}),
      ...(mitAuswahl ? { selectedItems: gewaehlt } : {}),
    },
    setExpandedItems: alsSetzer(offen, onExpandedChange ?? setEigenOffen),
    ...(mitCheckboxen
      ? { setCheckedItems: alsSetzer(gehakt, onCheckedChange ?? setEigenGehakt), propagateCheckedState: true }
      : {}),
    ...(mitAuswahl
      ? { setSelectedItems: alsSetzer(gewaehlt, onSelectedChange ?? setEigenGewaehlt) }
      : {}),
    onPrimaryAction: item => {
      // Blatt in einem Checkbox-Baum: die Zeile IST die Checkbox. Ordner
      // behalten Auf-/Zuklappen (das erledigt `getProps().onClick`).
      if (mitCheckboxen && !item.isFolder()) void item.toggleCheckedState();
      onPrimaryAction?.(item.getId(), item.getItemData()?.data);
    },
    features: featureListe,
  });

  const baueProps = useCallback((item: ItemInstance<TfTreeItem<T>>): TfTreeNodeRenderProps<T> => {
    const daten = item.getItemData();
    return {
      id: item.getId(),
      name: daten?.name ?? '',
      data: daten?.data as T,
      level: item.getItemMeta().level,
      isFolder: item.isFolder(),
      isExpanded: item.isExpanded(),
      isFocused: item.isFocused(),
      isSelected: mitAuswahl ? item.isSelected() : false,
      checked: mitCheckboxen ? CHECK_STATE[item.getCheckedState()] : null,
      zeilenProps: item.getProps(),
      toggleChecked: () => { if (mitCheckboxen) void item.toggleCheckedState(); },
    };
  }, [mitAuswahl, mitCheckboxen]);

  return (
    // Zwischen `role="tree"` und den `role="treeitem"`-Zeilen darf KEIN
    // Wrapper-Element stehen — deshalb `Fragment` statt eines Schlüssel-Divs.
    <div {...tree.getContainerProps(label)} className={className}>
      {tree.getItems().map(item => {
        // Zeile aus der noch nicht neu gebauten Liste: `data` wäre der
        // Platzhalter und jeder Slot, der darauf zugreift, würde werfen.
        if (!items[item.getId()]) return null;
        const p = baueProps(item);
        return (
          <Fragment key={item.getKey()}>
            {renderNode ? renderNode(p, indent) : (
              <TfTreeNode
                node={p}
                slots={slots}
                indent={indent}
                {...(onZeilenKlick ? { onZeilenKlick: (e: React.MouseEvent) => onZeilenKlick(p.id, p.data, e) } : {})}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
