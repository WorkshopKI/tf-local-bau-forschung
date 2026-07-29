/**
 * Persönliche Kanban-Einstellung des Feedback-BOARDS: welche Status-Lanes
 * sichtbar sind, wie viele Kartenspalten je Lane, und der Farbmodus der Köpfe.
 *
 * Gerätelokal in localStorage — dasselbe Muster wie die übrigen
 * Ansichts-Einstellungen der Seite (`tf-feedback-board-view-v3`, `-sort-v3`,
 * `-density-v1`). Bewusst NICHT an die Home-Widget-Config gekoppelt: das Board
 * soll sich unabhängig vom (optionalen) Home-Widget einstellen lassen.
 *
 * Rein + node-testbar (kein React) — deshalb defensiv beim Lesen: fremde/kaputte
 * Werte fallen still auf den Default zurück, statt die Seite zu kippen.
 */
import type { FeedbackStatus } from '@/core/types/feedback';
import type { LaneFarbmodus } from '@/components/kanban/laneAccent';
import { FEEDBACK_LANE_STATUS, type FeedbackLane } from './feedbackLanes';

export const BOARD_KANBAN_KEY = 'tf-feedback-board-kanban-v1';

export interface BoardKanbanConfig {
  lanes: FeedbackLane[];
  farbmodus: LaneFarbmodus;
}

/**
 * Default = das Verhalten VOR dieser Einstellung: alle fünf Lanes in
 * Design-Reihenfolge, einspaltig, bunt. Wer nichts einstellt, sieht das
 * gewohnte Board.
 */
export function defaultBoardKanbanConfig(): BoardKanbanConfig {
  return {
    lanes: FEEDBACK_LANE_STATUS.map(status => ({ status, spalten: 1 as const })),
    farbmodus: 'bunt',
  };
}

/** Bekannter Lane-Status? (Pitfall #21 — Prüfung gegen den Katalog, nie gegen
 *  Literale; `archiviert` ist bewusst kein Lane-Kandidat.) */
function istLaneStatus(v: unknown): v is FeedbackStatus {
  return typeof v === 'string' && (FEEDBACK_LANE_STATUS as readonly string[]).includes(v);
}

/** Rohwert → gültige Config (pure, damit ohne localStorage testbar). */
export function parseBoardKanbanConfig(roh: unknown): BoardKanbanConfig {
  const fallback = defaultBoardKanbanConfig();
  if (!roh || typeof roh !== 'object') return fallback;
  const obj = roh as { lanes?: unknown; farbmodus?: unknown };

  const gesehen = new Set<string>();
  const lanes: FeedbackLane[] = Array.isArray(obj.lanes)
    ? obj.lanes.flatMap((l): FeedbackLane[] => {
        if (!l || typeof l !== 'object') return [];
        const { status, spalten } = l as { status?: unknown; spalten?: unknown };
        // Unbekannte/archivierte Status und Dubletten verwerfen.
        if (!istLaneStatus(status) || gesehen.has(status)) return [];
        gesehen.add(status);
        return [{ status, spalten: spalten === 2 ? 2 : 1 }];
      })
    : [];

  return {
    // Leere Lane-Liste wäre ein leeres Board → lieber der Default.
    lanes: lanes.length > 0 ? lanes : fallback.lanes,
    farbmodus: obj.farbmodus === 'monochrom' ? 'monochrom' : 'bunt',
  };
}

export function loadBoardKanbanConfig(): BoardKanbanConfig {
  try {
    const roh = localStorage.getItem(BOARD_KANBAN_KEY);
    if (!roh) return defaultBoardKanbanConfig();
    return parseBoardKanbanConfig(JSON.parse(roh));
  } catch {
    return defaultBoardKanbanConfig();
  }
}

export function saveBoardKanbanConfig(cfg: BoardKanbanConfig): void {
  try {
    localStorage.setItem(BOARD_KANBAN_KEY, JSON.stringify(cfg));
  } catch { /* ignore — Einstellung ist Komfort, kein Datenverlust */ }
}
