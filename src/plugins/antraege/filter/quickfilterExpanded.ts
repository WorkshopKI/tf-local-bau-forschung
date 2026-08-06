/**
 * Persistenz + Reducer für das **Quickfilter-Akkordeon** der Förderanträge-Liste.
 *
 * Die Toolbar zeigt mehrere Filter-Pillen (Status / Antragstyp / PreCheck /
 * Sortiert-nach) in EINER Zeile. Es ist immer höchstens **eine** Pille
 * aufgeklappt — die „nie zwei offen"-Invariante ist strukturell garantiert,
 * weil der Zustand ein einzelner `QuickfilterSegId | null` ist.
 *
 * Persistenz pro View (`teamflow_antraege_quickfilter_expanded_{viewId}`), Muster
 * 1:1 aus `useAntraegeColumnsStore.ts` (try/parse/validate/Default). Reines
 * Modul (kein React/Store-Import) → testbar.
 */

/** Die aufklappbaren Segmente der Quickfilter-Zeile. */
export type QuickfilterSegId = 'status' | 'antragstyp' | 'projektart' | 'precheck' | 'sort';

const VALID_SEGS: ReadonlySet<QuickfilterSegId> = new Set<QuickfilterSegId>([
  'status',
  'antragstyp',
  'projektart',
  'precheck',
  'sort',
]);

/** Erstnutzung: Status-Segment offen (Design-Vorgabe). */
export const DEFAULT_EXPANDED_SEG: QuickfilterSegId = 'status';

const KEY_PREFIX = 'teamflow_antraege_quickfilter_expanded_';

/** Sentinel im Storage für „alle Segmente zugeklappt" (bewusst vom User). */
const NONE_SENTINEL = '';

function storageKey(viewId: string): string {
  return `${KEY_PREFIX}${viewId}`;
}

function isSeg(v: unknown): v is QuickfilterSegId {
  return typeof v === 'string' && VALID_SEGS.has(v as QuickfilterSegId);
}

/**
 * Liest das offene Segment für eine View.
 * - Schlüssel fehlt (Erstnutzung) → `DEFAULT_EXPANDED_SEG` (`'status'`).
 * - Schlüssel = `''` (User hat alles zugeklappt) → `null`.
 * - Gültige Seg-ID → diese.
 * - Ungültig/kaputt → Default.
 */
export function loadExpandedSeg(viewId: string): QuickfilterSegId | null {
  try {
    const raw = localStorage.getItem(storageKey(viewId));
    if (raw === null) return DEFAULT_EXPANDED_SEG;
    if (raw === NONE_SENTINEL) return null;
    return isSeg(raw) ? raw : DEFAULT_EXPANDED_SEG;
  } catch {
    return DEFAULT_EXPANDED_SEG;
  }
}

/** Persistiert das offene Segment (bzw. `null` = alles zu). */
export function saveExpandedSeg(viewId: string, seg: QuickfilterSegId | null): void {
  try {
    localStorage.setItem(storageKey(viewId), seg ?? NONE_SENTINEL);
  } catch {
    /* ignore */
  }
}

/**
 * Akkordeon-Reducer: Klick auf ein Segment.
 * - Klick auf das bereits offene Segment → zuklappen (`null`).
 * - Klick auf ein anderes Segment → dieses öffnen (schließt das vorherige
 *   implizit, weil der Zustand ein Einzelwert ist).
 */
export function toggleExpandedSeg(
  current: QuickfilterSegId | null,
  clicked: QuickfilterSegId,
): QuickfilterSegId | null {
  return current === clicked ? null : clicked;
}
