/**
 * useCollapsedSection — persistenter Auf-/Zugeklappt-Flag für eine UI-Sektion.
 *
 * Speichert den Zustand pro `key` in localStorage (`'0'` = offen, `'1'` = zu),
 * Default offen. localStorage ist unter `file://` verfügbar und laut CLAUDE.md
 * für einfache UI-Flags explizit erlaubt (selbe Klasse wie `teamflow_tour_completed`).
 *
 * Semantik 1:1 wie StatistikSection
 * (`src/plugins/auslastung/views/uebersicht/StatistikSection.tsx`).
 */
import { useEffect, useState } from 'react';

export function useCollapsedSection(key: string): [boolean, () => void] {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(key) !== '1';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, open ? '0' : '1');
    } catch {
      // localStorage nicht verfügbar (privater Tab o.Ä.) — silently ignorieren.
    }
  }, [key, open]);

  const toggle = (): void => setOpen(v => !v);
  return [open, toggle];
}
