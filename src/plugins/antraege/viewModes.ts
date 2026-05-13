import type { ViewKey } from './views';

/**
 * View-Modus der Antrags-Liste. Orthogonal zur Gruppierung (Verbund/Netzwerk/Keine)
 * und zum Sort: bestimmt nur die visuelle Render-Form.
 *
 * - `list`    — heutige gestapelte Cards mit Header + TV-Zeilen + Akzentbar
 * - `compact` — einzeilig pro TV (~28px Höhe), maximale Anzahl Anträge pro Screen
 * - `cards`   — Tile-Grid (~110×72px), Akronym ist die Hauptinfo, "alle auf einen Blick"
 */
export type ViewMode = 'list' | 'compact' | 'cards';

export const DEFAULT_VIEW_MODE: ViewMode = 'list';

const VALID_VIEW_MODES = new Set<ViewMode>(['list', 'compact', 'cards']);

export function isViewMode(v: unknown): v is ViewMode {
  return typeof v === 'string' && VALID_VIEW_MODES.has(v as ViewMode);
}

export function loadViewModeByTab(storageKey: string): Partial<Record<ViewKey, ViewMode>> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Record<ViewKey, ViewMode>> = {};
    for (const [view, mode] of Object.entries(parsed)) {
      if (isViewMode(mode)) {
        out[view as ViewKey] = mode;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveViewModeByTab(
  storageKey: string,
  map: Partial<Record<ViewKey, ViewMode>>,
): void {
  try { localStorage.setItem(storageKey, JSON.stringify(map)); } catch { /* ignore */ }
}

export function getEffectiveViewMode(
  view: ViewKey,
  overrides: Partial<Record<ViewKey, ViewMode>>,
): ViewMode {
  const override = overrides[view];
  return override ?? DEFAULT_VIEW_MODE;
}
