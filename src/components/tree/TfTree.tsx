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
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckedState,
  checkboxesFeature,
  dragAndDropFeature,
  hotkeysCoreFeature,
  keyboardDragAndDropFeature,
  renamingFeature,
  selectionFeature,
  syncDataLoaderFeature,
  type DragTarget,
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
  canRename, onRename, canDrag, canDrop, onDrop,
  indent = STANDARD_EINZUG,
  className,
}: TfTreeProps<T>): React.ReactElement {
  const mitCheckboxen = features?.checkboxes === true;
  const mitAuswahl = features?.selection === true;
  const mitUmbenennen = features?.renaming === true;
  const mitZiehen = features?.dnd === true;

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
    if (mitUmbenennen) f.push(renamingFeature);
    if (mitZiehen) {
      f.push(dragAndDropFeature);
      // Ziehen NUR mit der Maus wäre für Tastaturnutzer eine geschlossene Tür.
      f.push(keyboardDragAndDropFeature);
    }
    if (features?.hotkeys !== false) f.push(hotkeysCoreFeature);
    return f;
  }, [mitAuswahl, mitCheckboxen, mitUmbenennen, mitZiehen, features?.hotkeys]);

  /** Ziel-Id eines Drop-Vorgangs: der künftige Elternknoten. */
  const zielId = (t: DragTarget<TfTreeItem<T>>): string => t.item.getId();

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
    ...(mitUmbenennen
      ? {
          canRename: item => canRename?.(item.getId(), item.getItemData()?.data) ?? true,
          onRename: (item, wert) => onRename?.(item.getId(), wert, item.getItemData()?.data),
        }
      : {}),
    ...(mitZiehen
      ? {
          canReorder: features?.reorder === true,
          canDrag: items_ => canDrag?.(items_.map(i => i.getId())) ?? true,
          canDrop: (quellen, ziel) =>
            canDrop?.(quellen.map(i => i.getId()), zielId(ziel)) ?? true,
          onDrop: (quellen, ziel) => {
            onDrop?.(
              quellen.map(i => i.getId()),
              zielId(ziel),
              'childIndex' in ziel ? ziel.childIndex : undefined,
            );
          },
        }
      : {}),
    onPrimaryAction: item => {
      // Blatt in einem Checkbox-Baum: die Zeile IST die Checkbox. Ordner
      // behalten Auf-/Zuklappen (das erledigt `getProps().onClick`).
      if (mitCheckboxen && !item.isFolder()) void item.toggleCheckedState();
      onPrimaryAction?.(item.getId(), item.getItemData()?.data);
    },
    features: featureListe,
  });

  /**
   * Ändert sich der Knoten-Bestand, muss die Zeilenliste neu entstehen.
   *
   * Die Bibliothek baut sie sonst nur bei ZUSTANDS-Änderungen neu; ein
   * Umbenennen ändert aber die Daten, nicht den Zustand. Ohne dieses Rebuild
   * blieben nach dem Umbenennen einer Gruppe deren Kinder ohne Elternzeile
   * stehen — sichtbar geworden beim Selbst-Check am Textbaustein-Katalog.
   */
  useEffect(() => { tree.rebuildTree(); }, [items, tree]);

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
      isRenaming: mitUmbenennen ? item.isRenaming() : false,
      isDropZiel: mitZiehen ? item.isDragTarget() : false,
      zeilenProps: item.getProps(),
      renameProps: mitUmbenennen && item.isRenaming() ? item.getRenameInputProps() : null,
      toggleChecked: () => { if (mitCheckboxen) void item.toggleCheckedState(); },
      starteUmbenennen: () => { if (mitUmbenennen && item.canRename()) item.startRenaming(); },
    };
  }, [mitAuswahl, mitCheckboxen, mitUmbenennen, mitZiehen]);

  // Die Einfüge-Marke beim Umsortieren. Position rechnet die Bibliothek, die
  // Farbe kommt von uns — deshalb `getDragLineStyle()` und ein eigener Strich.
  const dragLinie = mitZiehen && features?.reorder === true ? tree.getDragLineStyle() : null;

  return (
    // Zwischen `role="tree"` und den `role="treeitem"`-Zeilen darf KEIN
    // Wrapper-Element stehen — deshalb `Fragment` statt eines Schlüssel-Divs.
    <div
      {...tree.getContainerProps(label)}
      className={className}
      style={mitZiehen ? { position: 'relative' } : undefined}
    >
      {dragLinie && (
        <div
          aria-hidden="true"
          style={{ ...dragLinie, height: 2, background: 'var(--tf-primary)', borderRadius: 1, pointerEvents: 'none' }}
        />
      )}
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
