/**
 * Schliesst ein Popover/Dropdown wenn der User ausserhalb klickt.
 *
 * Listener wird nur registriert wenn `enabled === true` — verhindert
 * unnoetige Globals-Listener fuer geschlossene Popovers. `pointerdown` statt
 * `mousedown` damit auch Touch-Geraete (Tablet im Plenarsaal) funktionieren.
 */
import { useEffect, type RefObject } from 'react';

export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return;
    function handler(e: PointerEvent): void {
      const el = ref.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      onOutside();
    }
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [ref, onOutside, enabled]);
}
