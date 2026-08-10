/**
 * Guard für das Bucketing der Board-Spalten. Löst den Test der bisherigen
 * `buildBoardColumns` ab.
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackItem } from '@/core/types/feedback';
import { FEEDBACK_LANE_STATUS, type FeedbackLane } from '@/components/feedback/feedbackLanes';
import { baueSpalten } from '../boardSpalten';

const LANES: FeedbackLane[] = FEEDBACK_LANE_STATUS.map(status => ({ status, spalten: 1 as const }));

function fb(id: string, over: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id,
    created_at: '2026-07-01T10:00:00Z',
    user_id: 'THU',
    text: `Text ${id}`,
    category: 'idea',
    kurator_status: 'neu',
    context: {
      route: 'r', page: 'p', device: 'Desktop', viewport: '1x1',
      sessionDuration: 0, errors: [], timestamp: '2026-07-01T10:00:00Z',
    },
    ...over,
  };
}

describe('baueSpalten', () => {
  it('liefert die Lanes in Konfigurationsreihenfolge, auch die leeren', () => {
    const spalten = baueSpalten([], LANES);
    expect(spalten.map(s => s.status)).toEqual([
      'neu', 'rueckfrage', 'geplant', 'in_bearbeitung', 'umgesetzt', 'abgelehnt',
    ]);
    expect(spalten.every(s => s.tickets.length === 0)).toBe(true);
  });

  it('sortiert Tickets nach kurator_status in ihre Spalte', () => {
    const spalten = baueSpalten([
      fb('A', { kurator_status: 'rueckfrage' }),
      fb('B', { kurator_status: 'neu' }),
      fb('C', { kurator_status: 'rueckfrage' }),
    ], LANES);
    expect(spalten.find(s => s.status === 'rueckfrage')?.tickets.map(t => t.id)).toEqual(['A', 'C']);
    expect(spalten.find(s => s.status === 'neu')?.tickets.map(t => t.id)).toEqual(['B']);
  });

  it('behält die Eingabereihenfolge — sortiert hat die Toolbar, nicht die Spalte', () => {
    const spalten = baueSpalten([fb('Z'), fb('A'), fb('M')], LANES);
    expect(spalten[0]?.tickets.map(t => t.id)).toEqual(['Z', 'A', 'M']);
  });

  // Bis v3.11 filterte das Board `praise` heraus („Lob hat keinen Workflow").
  // Mit der Facetten-Leiste wird daraus eine gebrochene Zusage: die Typ-Facette
  // zählt „3 Lob", und ein Klick zeigte ein leeres Board.
  it('nimmt Lob auf, statt es unsichtbar zu machen', () => {
    const spalten = baueSpalten([fb('L', { category: 'praise' })], LANES);
    expect(spalten[0]?.tickets.map(t => t.id)).toEqual(['L']);
  });

  it('rechnet die Summenzeile je Spalte mit', () => {
    const spalten = baueSpalten([
      fb('A', { effort_estimate: 'M' }),
      fb('B', { effort_estimate: 'XS' }),
      fb('C'),
    ], LANES);
    expect(spalten[0]?.summe).toEqual({ stunden: 10, ungeschaetzt: 1 });
  });

  // Der gemeldete Fehler (v3.39): In der Sicht „Alles offen" meldete die Bahn
  // UMGESETZT ein glattes „0", während drei Tickets in diesem Status lagen. Die
  // Bahn muss unterscheiden können zwischen „hier ist nichts" und „hier KANN
  // nichts sein".
  it('markiert die Bahn, die die aktive Sicht gar nicht füllen kann', () => {
    const kannStatus = (s: string): boolean => s !== 'umgesetzt' && s !== 'abgelehnt';
    const spalten = baueSpalten([fb('A')], LANES, kannStatus as never);
    expect(spalten.find(s => s.status === 'umgesetzt')?.ausserhalbDerSicht).toBe(true);
    expect(spalten.find(s => s.status === 'abgelehnt')?.ausserhalbDerSicht).toBe(true);
    // Leer, aber erreichbar: das bleibt eine ehrliche Null.
    expect(spalten.find(s => s.status === 'rueckfrage')?.ausserhalbDerSicht).toBe(false);
    expect(spalten.find(s => s.status === 'neu')?.ausserhalbDerSicht).toBe(false);
  });

  it('ohne Angabe ist keine Bahn außerhalb — die Sicht schränkt dann nicht nach Status ein', () => {
    const spalten = baueSpalten([fb('A')], LANES);
    expect(spalten.every(s => s.ausserhalbDerSicht === false)).toBe(true);
  });

  it('lässt Tickets fallen, deren Status keine sichtbare Lane hat — das ist der Zweck der Lane-Auswahl', () => {
    const nurNeu: FeedbackLane[] = [{ status: 'neu', spalten: 1 }];
    const spalten = baueSpalten([fb('A'), fb('B', { kurator_status: 'umgesetzt' })], nurNeu);
    expect(spalten).toHaveLength(1);
    expect(spalten[0]?.tickets.map(t => t.id)).toEqual(['A']);
  });
});
