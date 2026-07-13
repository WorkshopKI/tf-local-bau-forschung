/**
 * Tests für die Feedback-Quelle des Kanban-Widgets (Phase 0 v1.1): Lane-
 * Ableitung aus FEEDBACK_STATUS (Lob raus, Kappung, leere Lanes, Sortierung),
 * Akzent-Auflösung (Token-only + Mono-Zyklus), Quellenwechsel-Reset und die
 * Koexistenz zweier Kanban-Instanzen (Anträge + Feedback).
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import {
  buildFeedbackKanbanLanes,
  defaultFeedbackKanbanLanes,
  feedbackLaneAccent,
  wechsleKanbanQuelle,
} from '../feedbackKanbanLanes';
import { buildAntragKanbanLanes, defaultAntragKanbanLanes } from '../kanbanLanes';
import type {
  AntragKanbanWidgetConfig,
  FeedbackKanbanLane,
  FeedbackKanbanWidgetConfig,
} from '../types';

function fb(
  partial: Partial<FeedbackItem> & { id: string; kurator_status: FeedbackStatus },
): FeedbackItem {
  return { created_at: '2026-01-01T00:00:00.000Z', user_id: 'u1', text: `Ticket ${partial.id}`, ...partial } as FeedbackItem;
}

const LANES: FeedbackKanbanLane[] = [
  { status: 'neu', spalten: 1 },
  { status: 'in_bearbeitung', spalten: 2 },
  { status: 'umgesetzt', spalten: 1 },
];

describe('buildFeedbackKanbanLanes', () => {
  it('bucketet nach kurator_status, schließt Lob aus, behält leere Lanes', () => {
    const { lanes, gesamt } = buildFeedbackKanbanLanes([
      fb({ id: 'A', kurator_status: 'neu', category: 'problem' }),
      fb({ id: 'B', kurator_status: 'in_bearbeitung', category: 'idea' }),
      fb({ id: 'LOB', kurator_status: 'neu', category: 'praise' }), // Lob → raus
    ], LANES, 4);
    expect(lanes.map(l => l.status)).toEqual(['neu', 'in_bearbeitung', 'umgesetzt']);
    expect(lanes[0]!.karten.map(k => k.id)).toEqual(['A']);
    expect(lanes[1]!.karten.map(k => k.id)).toEqual(['B']);
    expect(lanes[2]!.karten).toEqual([]); // leere Lane bleibt (Schmalschiene)
    expect(lanes[2]!.gesamt).toBe(0);
    expect(gesamt).toBe(2);
  });

  it('sortiert neueste zuerst und kappt auf maxKartenProLane (gesamt bleibt voll)', () => {
    const { lanes } = buildFeedbackKanbanLanes([
      fb({ id: 'ALT', kurator_status: 'neu', created_at: '2026-01-01T00:00:00.000Z' }),
      fb({ id: 'NEU', kurator_status: 'neu', created_at: '2026-03-01T00:00:00.000Z' }),
      fb({ id: 'MITTE', kurator_status: 'neu', created_at: '2026-02-01T00:00:00.000Z' }),
    ], LANES, 2);
    const neu = lanes[0]!;
    expect(neu.gesamt).toBe(3);
    expect(neu.karten.map(k => k.id)).toEqual(['NEU', 'MITTE']); // neueste zuerst, gekappt
  });

  it('überträgt Stimmenzahl + Autor in die Karte', () => {
    const { lanes } = buildFeedbackKanbanLanes([
      fb({ id: 'A', kurator_status: 'neu', votes: [{ user_id: 'x', created_at: '' }, { user_id: 'y', created_at: '' }], user_display_name: 'THU' }),
    ], LANES, 4);
    const karte = lanes[0]!.karten[0]!;
    expect(karte.stimmen).toBe(2);
    expect(karte.autor).toBe('THU');
  });

  it('reicht spalten (1|2) durch', () => {
    const { lanes } = buildFeedbackKanbanLanes([], LANES, 4);
    expect(lanes.map(l => l.spalten)).toEqual([1, 2, 1]);
  });
});

describe('feedbackLaneAccent — Token-only', () => {
  it('bunt: Status-Token', () => {
    expect(feedbackLaneAccent('bunt', 'neu', 0)).toMatch(/^var\(--tf-[a-z-]+\)$/);
    expect(feedbackLaneAccent('bunt', 'umgesetzt', 3)).toMatch(/^var\(--tf-[a-z-]+\)$/);
  });

  it('monochrom: zyklische Primär-Hue nach Lane-Index (geteilt mit Anträgen)', () => {
    expect(feedbackLaneAccent('monochrom', 'neu', 0)).toBe('var(--tf-kanban-mono-1)');
    expect(feedbackLaneAccent('monochrom', 'umgesetzt', 1)).toBe('var(--tf-kanban-mono-2)');
    expect(feedbackLaneAccent('monochrom', 'geplant', 3)).toBe('var(--tf-kanban-mono-1)');
  });
});

describe('wechsleKanbanQuelle — Lanes auf Quell-Default zurücksetzen', () => {
  const antrag: AntragKanbanWidgetConfig = {
    art: 'kanban', quelle: 'antraege', lanes: defaultAntragKanbanLanes(),
    farbmodus: 'monochrom', maxKartenProLane: 7,
  };

  it('antraege → feedback: Feedback-Default-Lanes, Farbmodus/Kappung erhalten, kein Preset', () => {
    const next = wechsleKanbanQuelle(antrag, 'feedback') as FeedbackKanbanWidgetConfig;
    expect(next.quelle).toBe('feedback');
    expect(next.lanes).toEqual(defaultFeedbackKanbanLanes());
    expect(next.farbmodus).toBe('monochrom');
    expect(next.maxKartenProLane).toBe(7);
    expect('presetId' in next).toBe(false);
  });

  it('feedback → antraege: Anträge-Default-Lanes', () => {
    const feedback = wechsleKanbanQuelle(antrag, 'feedback');
    const back = wechsleKanbanQuelle(feedback, 'antraege') as AntragKanbanWidgetConfig;
    expect(back.quelle).toBe('antraege');
    expect(back.lanes).toEqual(defaultAntragKanbanLanes());
  });

  it('gleiche Quelle → identische Referenz (no-op-Guard)', () => {
    expect(wechsleKanbanQuelle(antrag, 'antraege')).toBe(antrag);
  });
});

describe('Zwei Kanban-Instanzen parallel (eine je Quelle)', () => {
  it('Anträge- und Feedback-Builder liefern beide Lanes unabhängig', () => {
    const feedbackErgebnis = buildFeedbackKanbanLanes(
      [fb({ id: 'F', kurator_status: 'neu' })], defaultFeedbackKanbanLanes(), 4,
    );
    const antragErgebnis = buildAntragKanbanLanes(
      [{ aktenzeichen: 'A1', status: 'beantragt', programm_id: 'p' } as never],
      defaultAntragKanbanLanes(), 4, Date.parse('2026-07-12T00:00:00.000Z'),
    );
    expect(feedbackErgebnis.gesamt).toBe(1);
    expect(antragErgebnis.gesamt).toBe(1);
  });
});
