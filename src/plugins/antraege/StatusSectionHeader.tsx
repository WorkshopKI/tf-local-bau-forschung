import { ChevronDown, ChevronRight } from 'lucide-react';
import { statusSectionLabel, type StatusSectionId } from './antragGroups';
import { useStatusSectionCollapsed } from './useStatusSectionCollapsed';

/**
 * Section-Header für `Gruppiert: Status`. Wird in den Listen-Renderern
 * (CardGrid, GroupedList) gerendert, sobald der Modus aktiv ist.
 *
 * Klick auf den gesamten Row-Bereich (button-rolled) toggelt den Collapsed-
 * State im persistenten Store (`useStatusSectionCollapsed`). Chevron rotiert
 * passend (Down=expanded, Right=collapsed). Cards/Tiles werden im Caller
 * konditional ausgeblendet, wenn `useStatusSectionCollapsed.isCollapsed(id)`
 * true ist.
 *
 * Gekeyt wird ueber die **Id**, angezeigt die abgeleitete Beschriftung — seit
 * v2.409 sind das zwei verschiedene Dinge.
 */
interface Props {
  id: StatusSectionId;
  count: number;
}

export function StatusSectionHeader({ id, count }: Props): React.ReactElement {
  const label = statusSectionLabel(id);
  const collapsed = useStatusSectionCollapsed(s => s.collapsed.has(id));
  const toggle = useStatusSectionCollapsed(s => s.toggle);
  const Icon = collapsed ? ChevronRight : ChevronDown;

  return (
    <button
      type="button"
      onClick={() => toggle(id)}
      aria-expanded={!collapsed}
      aria-label={`${label} ${collapsed ? 'ausklappen' : 'einklappen'}`}
      className="w-full flex items-center gap-2 mb-1.5 mt-1 first:mt-0 cursor-pointer bg-transparent border-0 p-0 text-left hover:opacity-80 transition-opacity"
    >
      <Icon size={12} className="text-[var(--tf-text-tertiary)] shrink-0" />
      <span className="text-[11px] tracking-[0.08em] uppercase font-medium text-[var(--tf-text-tertiary)]">
        {label}
      </span>
      <span className="text-[10.5px] font-mono text-[var(--tf-text-tertiary)]">
        {count.toLocaleString('de-DE')}
      </span>
      <div className="flex-1 h-px bg-[var(--tf-border)]" />
    </button>
  );
}
