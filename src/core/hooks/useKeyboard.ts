import { useEffect } from 'react';
import { keyboardService } from '@/core/services/keyboard';

export function useKeyboardShortcut(
  combo: string,
  handler: () => void,
  options: { description: string; category?: string },
  deps: unknown[] = [],
): void {
  useEffect(() => {
    keyboardService.register(combo, handler, options);
    return () => keyboardService.unregister(combo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combo, ...deps]);
}
