/**
 * useCollapsedSection — persistenter Auf-/Zugeklappt-Flag für eine UI-Sektion.
 *
 * Speichert den Zustand pro `key` in localStorage (`'0'` = offen, `'1'` = zu).
 * localStorage ist unter `file://` verfügbar und laut CLAUDE.md für einfache
 * UI-Flags explizit erlaubt (selbe Klasse wie `teamflow_tour_completed`).
 *
 * Default-Zustand über `opts.defaultOpen` (Default `true` = offen — abwärts-
 * kompatibel). `defaultOpen: false` klappt eine Sektion beim ERSTEN Anzeigen ein
 * (Journey-Paket 2 Phase 7: kompakte Verbund-Detailseite); ein bereits
 * PERSISTIERTER Wert (`'0'`/`'1'`) gewinnt immer über den Default.
 *
 * Semantik 1:1 wie StatistikSection
 * (`src/plugins/auslastung/views/uebersicht/StatistikSection.tsx`).
 */
import { useEffect, useState } from 'react';

export function useCollapsedSection(
  key: string,
  opts?: { defaultOpen?: boolean },
): [boolean, () => void] {
  const defaultOpen = opts?.defaultOpen ?? true;
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return defaultOpen; // kein gespeicherter Wert → Default
      return raw !== '1';
    } catch {
      return defaultOpen;
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
