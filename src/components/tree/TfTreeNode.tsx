/**
 * Die Standard-Zeile eines `TfTree`: Einzug, Chevron, optionale Checkbox,
 * Icon-Slot, Beschriftung, rechtsbündiger Slot.
 *
 * Die Einrückung sitzt am **Padding der Zeile**, nicht an einem inneren
 * Wrapper — sonst endete der Hover-/Fokus-Hintergrund vor dem linken Rand und
 * die Zeile sähe je Ebene unterschiedlich breit aus.
 *
 * Blätter bekommen einen Chevron-Platzhalter gleicher Breite. Ohne ihn stünden
 * Ordner- und Blatt-Beschriftungen derselben Ebene nicht untereinander.
 */
import { ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';
import { TfTreeHoverCard } from './TfTreeHoverCard';
import type { TfTreeNodeRenderProps, TfTreeSlots } from './tf-tree-types';

const CHEVRON = 14;

export interface TfTreeNodeProps<T> {
  node: TfTreeNodeRenderProps<T>;
  slots?: TfTreeSlots<T>;
  /** Pixel je Ebene. */
  indent: number;
  /** Capture-Phase, vor der Baum-Reaktion (siehe `TfTreeCallbacks`). */
  onZeilenKlick?: (e: React.MouseEvent) => void;
  /** Maus betritt/verlässt die Zeile. Ohne Callback wird nichts gehängt. */
  onZeilenHover?: (ein: boolean) => void;
}

export function TfTreeNode<T>({
  node, slots, indent, onZeilenKlick, onZeilenHover,
}: TfTreeNodeProps<T>): React.ReactElement {
  const {
    zeilenProps, level, isFolder, isExpanded, isFocused, checked, name,
    isRenaming, renameProps, isDropZiel,
  } = node;

  /** Icon + Beschriftung — der Teil, der bei Bedarf im HoverCard-Trigger sitzt. */
  const mitte = isRenaming && renameProps ? (
    // Das Eingabefeld nimmt die Breite der Beschriftung ein, damit die Zeile
    // beim Umbenennen nicht springt.
    <input
      {...renameProps}
      className="min-w-0 flex-1 rounded-[3px] border-[0.5px] border-[var(--tf-primary)] bg-[var(--tf-bg)] px-1 py-0 text-[12.5px] text-[var(--tf-text)] outline-none"
      onClick={e => e.stopPropagation()}
    />
  ) : (
    <>
      {slots?.icon?.(node)}
      {slots?.label
        ? slots.label(node)
        : <span className="flex-1 min-w-0 truncate text-[12.5px] text-[var(--tf-text)]">{name}</span>}
    </>
  );

  const menue = slots?.contextMenu?.(node);

  const zeile = (
    <div
      {...zeilenProps}
      onClickCapture={onZeilenKlick}
      {...(onZeilenHover ? {
        onMouseEnter: () => onZeilenHover(true),
        onMouseLeave: () => onZeilenHover(false),
      } : {})}
      onDoubleClick={node.starteUmbenennen}
      className={`flex items-center gap-1.5 rounded-sm cursor-pointer select-none outline-none
        hover:bg-[var(--tf-hover)] focus-visible:ring-1 focus-visible:ring-[var(--tf-primary)]
        ${isFocused ? 'bg-[var(--tf-hover)]' : ''}
        ${isDropZiel ? 'ring-1 ring-[var(--tf-primary)] bg-[var(--tf-primary-soft)]' : ''}`}
      style={{
        paddingTop: 4, paddingBottom: 4, paddingRight: 6, paddingLeft: 6 + level * indent,
        ...slots?.zeilenStil?.(node),
      }}
    >
      {slots?.leading?.(node)}

      {isFolder ? (
        <ChevronRight
          size={12}
          className="shrink-0 text-[var(--tf-text-tertiary)]"
          style={{
            width: CHEVRON,
            transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        />
      ) : (
        <span className="shrink-0" style={{ width: CHEVRON }} aria-hidden="true" />
      )}

      {checked !== null && (
        // Eigener Klick-Bereich: ohne `stopPropagation` liefe der Zeilen-Klick
        // mit und schaltete das Häkchen sofort wieder zurück.
        <span className="flex shrink-0 items-center" onClick={e => e.stopPropagation()}>
          <Checkbox
            checked={checked === 'indeterminate' ? 'indeterminate' : checked === 'checked'}
            onCheckedChange={() => node.toggleChecked()}
            tabIndex={-1}
            aria-label={name}
          />
        </span>
      )}

      {/* Der Slot entscheidet, OB es einen Tooltip gibt; der Inhalt entsteht
          erst beim Öffnen (deshalb die Funktion, nicht der fertige Knoten). */}
      {slots?.hoverContent
        ? <TfTreeHoverCard inhalt={() => slots.hoverContent!(node)}>{mitte}</TfTreeHoverCard>
        : mitte}

      {slots?.trailing?.(node)}
    </div>
  );

  // Ohne Menü-Einträge KEINE Menü-Hülle: der Trigger hängt sich sonst in den
  // Rechtsklick und unterdrückt das Browser-Menü, ohne etwas anzubieten.
  const mitMenue = menue ? (
    <ContextMenu>
      <ContextMenuTrigger asChild>{zeile}</ContextMenuTrigger>
      <ContextMenuContent>{menue}</ContextMenuContent>
    </ContextMenu>
  ) : zeile;

  const koerper = slots?.body?.(node);
  if (!koerper) return mitMenue;
  return (
    <>
      {mitMenue}
      {/* Kein `treeitem`, kein `group` — der Detail-Bereich ist Beiwerk zur
          Zeile und soll den Baum für Screenreader nicht verlängern. */}
      <div role="presentation" style={{ paddingLeft: 6 + (level + 1) * indent }}>
        {koerper}
      </div>
    </>
  );
}
