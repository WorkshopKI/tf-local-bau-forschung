/**
 * Guard für die Kanban-Spalten-Ableitung (v2.225, Handoff feedback-kanban):
 * Lob (praise) erscheint nie im Board (nur Liste), und die Spalten folgen den
 * KONFIGURIERTEN Lanes. Der Default bleibt die alte feste Design-Reihenfolge
 * Neu → Abgelehnt → Geplant → In Bearbeitung → Umgesetzt, alle einspaltig.
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackItem } from '@/core/types/feedback';
import { FEEDBACK_STATUS } from '@/core/services/feedback';
import { buildBoardColumns } from '../FeedbackKanban';
import { defaultBoardKanbanConfig } from '../boardKanbanConfig';

const DEFAULT_LANES = defaultBoardKanbanConfig().lanes;

function ticket(partial: Partial<FeedbackItem>): FeedbackItem {
  return {
    id: `t-${Math.random().toString(36).slice(2)}`,
    created_at: '2026-07-12T10:00:00Z',
    user_id: 'TH',
    text: '',
    context: {
      route: 'x', page: 'p', device: 'Desktop', viewport: '1x1',
      sessionDuration: 0, errors: [], timestamp: '2026-07-12T10:00:00Z',
    },
    kurator_status: FEEDBACK_STATUS.neu,
    ...partial,
  };
}

describe('buildBoardColumns', () => {
  it('liefert mit den Default-Lanes die feste Design-Reihenfolge (Abgelehnt an Position 2)', () => {
    const cols = buildBoardColumns([], DEFAULT_LANES);
    expect(cols.map(c => c.status)).toEqual([
      FEEDBACK_STATUS.neu,
      FEEDBACK_STATUS.abgelehnt,
      FEEDBACK_STATUS.geplant,
      FEEDBACK_STATUS.in_bearbeitung,
      FEEDBACK_STATUS.umgesetzt,
    ]);
    // Default = das Verhalten vor der Anpassbarkeit: überall eine Kartenspalte.
    expect(cols.every(c => c.spalten === 1)).toBe(true);
  });

  it('sortiert Tickets nach kurator_status in die Spalten', () => {
    const a = ticket({ kurator_status: FEEDBACK_STATUS.geplant });
    const b = ticket({ kurator_status: FEEDBACK_STATUS.geplant });
    const c = ticket({ kurator_status: FEEDBACK_STATUS.abgelehnt });
    const cols = buildBoardColumns([a, b, c], DEFAULT_LANES);
    const byStatus = Object.fromEntries(cols.map(col => [col.status, col.items]));
    expect(byStatus[FEEDBACK_STATUS.geplant]).toEqual([a, b]);
    expect(byStatus[FEEDBACK_STATUS.abgelehnt]).toEqual([c]);
    expect(byStatus[FEEDBACK_STATUS.neu]).toEqual([]);
  });

  it('schließt Lob (praise) unabhängig vom Status aus', () => {
    const lob = ticket({ category: 'praise', kurator_status: FEEDBACK_STATUS.neu });
    const idee = ticket({ category: 'idea', kurator_status: FEEDBACK_STATUS.neu });
    const cols = buildBoardColumns([lob, idee], DEFAULT_LANES);
    const all = cols.flatMap(c => c.items);
    expect(all).toEqual([idee]);
  });

  it('lässt Archiviert-Tickets ohne Spalte stumm fallen (Seite filtert vorab)', () => {
    const cols = buildBoardColumns([ticket({ kurator_status: FEEDBACK_STATUS.archiviert })], DEFAULT_LANES);
    expect(cols.flatMap(c => c.items)).toEqual([]);
  });

  it('folgt der konfigurierten Lane-Auswahl und -Reihenfolge', () => {
    const cols = buildBoardColumns([], [
      { status: FEEDBACK_STATUS.in_bearbeitung, spalten: 1 },
      { status: FEEDBACK_STATUS.neu, spalten: 2 },
    ]);
    expect(cols.map(c => c.status)).toEqual([
      FEEDBACK_STATUS.in_bearbeitung,
      FEEDBACK_STATUS.neu,
    ]);
  });

  it('blendet Tickets abgewählter Lanes aus (sie bleiben in der Listen-Ansicht)', () => {
    const abgelehnt = ticket({ kurator_status: FEEDBACK_STATUS.abgelehnt });
    const neu = ticket({ kurator_status: FEEDBACK_STATUS.neu });
    const cols = buildBoardColumns([abgelehnt, neu], [{ status: FEEDBACK_STATUS.neu, spalten: 1 }]);
    expect(cols.flatMap(c => c.items)).toEqual([neu]);
  });

  it('reicht die Kartenspaltenzahl je Lane durch', () => {
    const cols = buildBoardColumns([], [
      { status: FEEDBACK_STATUS.neu, spalten: 2 },
      { status: FEEDBACK_STATUS.umgesetzt, spalten: 1 },
    ]);
    expect(cols.map(c => c.spalten)).toEqual([2, 1]);
  });
});
