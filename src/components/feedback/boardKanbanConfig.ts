/**
 * Persönliche Kanban-Einstellung des Feedback-BOARDS: welche Status-Lanes in
 * welcher REIHENFOLGE stehen, welche davon sichtbar sind, wie viele
 * Kartenspalten je Lane, und der Farbmodus der Köpfe.
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
import { leseSpalten } from '@/components/kanban/tfBoardBahn';
import { FEEDBACK_LANE_STATUS, type FeedbackLane } from './feedbackLanes';

// Key-Bump `_v2` (v3.12): die Default-Lane-Liste hat mit `rueckfrage` eine Spalte
// mehr und Abgelehnt ist ans Ende gewandert. Ein persistierter `_v1`-Wert schlägt
// jeden Code-Default — ohne Bump sähe niemand mit gespeicherter Einstellung die
// neue Spalte, und die Rückfrage-Tickets wären unsichtbar statt bloß unsortiert.
export const BOARD_KANBAN_KEY = 'tf-feedback-board-kanban-v2';

/**
 * Eine Lane des BOARDS: die geteilte `FeedbackLane` plus die Frage, ob der
 * Nutzer sie sehen will.
 *
 * Ausgeblendet wird per Flag, nicht durch Entfernen aus der Liste (v3.41): die
 * Liste IST die Spaltenfolge, und wer eine Lane herausnimmt, verliert ihren
 * Platz. Bis v3.40 hängte das Wiedereinblenden sie hinten an — so stand
 * „Geplant" plötzlich rechts von „Abgelehnt", und das Einstell-Popover zeigte
 * trotzdem die Katalogfolge.
 */
export interface BoardLane extends FeedbackLane {
  sichtbar: boolean;
}

export interface BoardKanbanConfig {
  /** ALLE Lanes des Katalogs in der Reihenfolge des Boards — auch die
   *  ausgeblendeten, damit sie ihren Platz behalten. */
  lanes: BoardLane[];
  farbmodus: LaneFarbmodus;
}

/**
 * Default = alle Lanes des Katalogs in Design-Reihenfolge, sichtbar,
 * einspaltig, bunt. Wer nichts einstellt, sieht das vollständige Board.
 */
export function defaultBoardKanbanConfig(): BoardKanbanConfig {
  return {
    lanes: FEEDBACK_LANE_STATUS.map(status => ({ status, spalten: 1 as const, sichtbar: true })),
    farbmodus: 'bunt',
  };
}

/** Was das Board zeichnet: die sichtbaren Lanes in ihrer Reihenfolge. */
export function sichtbareLanes(cfg: BoardKanbanConfig): FeedbackLane[] {
  return cfg.lanes.filter(l => l.sichtbar).map(({ status, spalten }) => ({ status, spalten }));
}

/**
 * Eine Lane um einen Platz verschieben (−1 = nach vorn, +1 = nach hinten).
 *
 * Getauscht wird mit der NACHBARZEILE, auch wenn die ausgeblendet ist: das
 * Popover zeigt alle Lanes in dieser Reihenfolge, und ein Klick, der dort nichts
 * bewegt, sähe kaputt aus. Am Rand bleibt die Liste unverändert (gleiche
 * Referenz — der Aufrufer kann den Schreibvorgang sparen).
 */
export function verschiebeLane(
  lanes: BoardLane[],
  status: FeedbackStatus,
  richtung: -1 | 1,
): BoardLane[] {
  const i = lanes.findIndex(l => l.status === status);
  const ziel = i + richtung;
  if (i < 0 || ziel < 0 || ziel >= lanes.length) return lanes;
  const next = [...lanes];
  const [bewegt] = next.splice(i, 1);
  if (!bewegt) return lanes;
  next.splice(ziel, 0, bewegt);
  return next;
}

/** Bekannter Lane-Status? (Pitfall #21 — Prüfung gegen den Katalog, nie gegen
 *  Literale; `archiviert` ist bewusst kein Lane-Kandidat.) */
function istLaneStatus(v: unknown): v is FeedbackStatus {
  return typeof v === 'string' && (FEEDBACK_LANE_STATUS as readonly string[]).includes(v);
}

/**
 * Rohwert → gültige Config (pure, damit ohne localStorage testbar).
 *
 * Zieht den Alt-Stand ohne Key-Bump mit: bis v3.40 hieß „steht in der Liste" =
 * sichtbar, und eine ausgeblendete Lane FEHLTE. Fehlende Lanes kommen deshalb
 * ausgeblendet hinten dazu — die eingestellte Reihenfolge der übrigen bleibt,
 * und wer damals etwas ausgeblendet hatte, sieht es weiterhin nicht.
 */
export function parseBoardKanbanConfig(roh: unknown): BoardKanbanConfig {
  const fallback = defaultBoardKanbanConfig();
  if (!roh || typeof roh !== 'object') return fallback;
  const obj = roh as { lanes?: unknown; farbmodus?: unknown };

  const gesehen = new Set<string>();
  const lanes: BoardLane[] = Array.isArray(obj.lanes)
    ? obj.lanes.flatMap((l): BoardLane[] => {
        if (!l || typeof l !== 'object') return [];
        const { status, spalten, sichtbar } = l as {
          status?: unknown; spalten?: unknown; sichtbar?: unknown;
        };
        // Unbekannte/archivierte Status und Dubletten verwerfen.
        if (!istLaneStatus(status) || gesehen.has(status)) return [];
        gesehen.add(status);
        // Nur ein ausdrückliches `false` blendet aus — ein Alt-Eintrag ohne das
        // Feld ist eine sichtbare Lane, kein unentschiedener Zustand.
        return [{ status, spalten: leseSpalten(spalten), sichtbar: sichtbar !== false }];
      })
    : [];

  // Der Katalog ist vollständig, die gespeicherte Liste muss es nicht sein.
  for (const status of FEEDBACK_LANE_STATUS) {
    if (!gesehen.has(status)) lanes.push({ status, spalten: 1, sichtbar: false });
  }

  return {
    // Ein Board ohne einzige sichtbare Lane wäre eine leere Fläche, deren Grund
    // nur im Popover steht — kaputter Wert oder nicht, lieber alles zeigen.
    lanes: lanes.some(l => l.sichtbar) ? lanes : fallback.lanes,
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
