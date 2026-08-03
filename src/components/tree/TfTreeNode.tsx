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
import type { TfTreeNodeRenderProps, TfTreeSlots } from './tf-tree-types';

const CHEVRON = 14;

export interface TfTreeNodeProps<T> {
  node: TfTreeNodeRenderProps<T>;
  slots?: TfTreeSlots<T>;
  /** Pixel je Ebene. */
  indent: number;
  /** Capture-Phase, vor der Baum-Reaktion (siehe `TfTreeCallbacks`). */
  onZeilenKlick?: (e: React.MouseEvent) => void;
}

export function TfTreeNode<T>({ node, slots, indent, onZeilenKlick }: TfTreeNodeProps<T>): React.ReactElement {
  const { zeilenProps, level, isFolder, isExpanded, isFocused, checked, name } = node;

  return (
    <div
      {...zeilenProps}
      onClickCapture={onZeilenKlick}
      className={`flex items-center gap-1.5 rounded-sm cursor-pointer select-none outline-none
        hover:bg-[var(--tf-hover)] focus-visible:ring-1 focus-visible:ring-[var(--tf-primary)]
        ${isFocused ? 'bg-[var(--tf-hover)]' : ''}`}
      style={{
        paddingTop: 4, paddingBottom: 4, paddingRight: 6, paddingLeft: 6 + level * indent,
        ...slots?.zeilenStil?.(node),
      }}
    >
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

      {slots?.icon?.(node)}

      {slots?.label
        ? slots.label(node)
        : <span className="flex-1 min-w-0 truncate text-[12.5px] text-[var(--tf-text)]">{name}</span>}

      {slots?.trailing?.(node)}
    </div>
  );
}
