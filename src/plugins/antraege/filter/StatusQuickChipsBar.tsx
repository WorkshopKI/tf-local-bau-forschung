/**
 * Status-Quickfilter-Chips-Bar: rechts in der Antrags-Toolbar.
 *
 * Liest und schreibt direkt den `system-status`-Filter aus `useFilterState`
 * (Single Source of Truth — keine parallele Quick-Filter-State-Persistenz).
 * Wenn der User in der Filter-Sidebar Status manuell wählt, spiegelt sich das
 * in den Chips; und umgekehrt.
 *
 * Click auf Chip: toggelt diese Bucket. Shift-Click oder Doppelklick: solo-mode
 * (nur dieser Chip aktiv).
 */
import type { ActiveFilter } from '@/core/services/csv';
import { useFilterState } from './useFilterState';
import {
  STATUS_QUICK_CHIPS,
  deriveChipState,
  computeFilterValue,
  soloChipState,
  type StatusQuickChipId,
  type ChipState,
} from './statusQuickChips';

const STATUS_FILTER_ID = 'system-status';

function readActiveStatusValues(active: ActiveFilter[]): string[] | null {
  const entry = active.find(a => a.filterId === STATUS_FILTER_ID);
  if (!entry) return null;
  if (Array.isArray(entry.value) && entry.value.every(v => typeof v === 'string')) {
    return entry.value as string[];
  }
  return null;
}

export function StatusQuickChipsBar(): React.ReactElement {
  const active = useFilterState(s => s.active);
  const setActiveValue = useFilterState(s => s.setActiveValue);
  const clearFilter = useFilterState(s => s.clearFilter);

  const activeValues = readActiveStatusValues(active);
  const chipState = deriveChipState(activeValues);

  const applyNewState = (next: Record<StatusQuickChipId, ChipState>): void => {
    const value = computeFilterValue(next);
    if (value === null) {
      clearFilter(STATUS_FILTER_ID);
    } else {
      setActiveValue(STATUS_FILTER_ID, value);
    }
  };

  const onChipClick = (id: StatusQuickChipId, e: React.MouseEvent): void => {
    if (e.shiftKey) {
      applyNewState(soloChipState(id));
      return;
    }
    const next: Record<StatusQuickChipId, ChipState> = { ...chipState };
    next[id] = chipState[id] === 'off' ? 'on' : 'off';
    applyNewState(next);
  };

  const onChipDoubleClick = (id: StatusQuickChipId): void => {
    applyNewState(soloChipState(id));
  };

  return (
    <div className="flex items-center gap-1 flex-wrap shrink-0">
      {STATUS_QUICK_CHIPS.map(chip => {
        const state = chipState[chip.id];
        const isOn = state !== 'off';
        const isMixed = state === 'mixed';
        const title = `${chip.label} ${isOn ? 'sichtbar' : 'ausgeblendet'} (Click toggelt, Shift-Click = nur diese)`;
        const baseStyle: React.CSSProperties = {
          padding: '1px 8px',
          borderRadius: '999px',
          fontSize: '11px',
          lineHeight: '16px',
          border: '0.5px solid var(--tf-border)',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'opacity 120ms, background-color 120ms',
        };
        const onStyle: React.CSSProperties = {
          background: 'var(--tf-bg-secondary)',
          color: 'var(--tf-text)',
        };
        const offStyle: React.CSSProperties = {
          background: 'transparent',
          color: 'var(--tf-text-tertiary)',
          opacity: 0.5,
          textDecoration: 'line-through',
        };
        const mixedStyle: React.CSSProperties = isMixed
          ? { borderStyle: 'dashed', borderColor: 'var(--tf-primary)' }
          : {};
        return (
          <button
            key={chip.id}
            type="button"
            onClick={e => onChipClick(chip.id, e)}
            onDoubleClick={() => onChipDoubleClick(chip.id)}
            title={title}
            aria-pressed={isOn}
            style={{
              ...baseStyle,
              ...(isOn ? onStyle : offStyle),
              ...mixedStyle,
            }}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
