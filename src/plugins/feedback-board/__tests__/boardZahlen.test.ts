/**
 * Guard für die abgeleiteten Zahlen der Board-Oberfläche: eine Facettenzahl ist
 * eine Zusage („so viele bekommst du, wenn du klickst"), und die Summenzeile ist
 * der Triage-Blick auf eine Spalte. Beide dürfen nicht raten.
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackItem } from '@/core/types/feedback';
import { kopfZaehler, spaltenSumme, TYP_UNKLASSIFIZIERT, zaehleFacetten } from '../boardZahlen';

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

describe('zaehleFacetten', () => {
  it('zählt Typ, Status und Bereich in einem Durchlauf', () => {
    const items = [
      fb('A', { category: 'problem', kurator_status: 'neu', bereich: 'suche' }),
      fb('B', { category: 'problem', kurator_status: 'rueckfrage', bereich: 'suche' }),
      fb('C', { category: 'idea', kurator_status: 'neu', bereich: 'antraege' }),
    ];
    const z = zaehleFacetten(items);
    expect(z.typ).toEqual({ problem: 2, idea: 1 });
    expect(z.status).toEqual({ neu: 2, rueckfrage: 1 });
    expect(z.bereich).toEqual({ suche: 2, antraege: 1 });
  });

  it('bucketet Tickets ohne Kategorie als „unklassifiziert" statt sie zu verlieren', () => {
    const z = zaehleFacetten([fb('A', { category: undefined }), fb('B', { category: 'idea' })]);
    expect(z.typ[TYP_UNKLASSIFIZIERT]).toBe(1);
    expect(z.typ.idea).toBe(1);
  });

  it('fällt beim Bereich auf die Meldung des Erstellers und dann auf „sonstiges" zurück', () => {
    const gemeldet = fb('A', { context: { ...fb('x').context, screenRef: 'chat' } });
    const gar_nichts = fb('B');
    expect(zaehleFacetten([gemeldet, gar_nichts]).bereich).toEqual({ chat: 1, sonstiges: 1 });
  });
});

describe('spaltenSumme', () => {
  it('summiert die Stunden-Äquivalente und zählt die Ungeschätzten getrennt', () => {
    const s = spaltenSumme([
      fb('A', { effort_estimate: 'M' }),   // 8 h
      fb('B', { effort_estimate: 'XL' }),  // 32 h
      fb('C'),
      fb('D'),
    ]);
    expect(s).toEqual({ stunden: 40, ungeschaetzt: 2 });
  });

  it('liefert für eine leere Spalte Nullen, nicht NaN', () => {
    expect(spaltenSumme([])).toEqual({ stunden: 0, ungeschaetzt: 0 });
  });
});

describe('kopfZaehler', () => {
  it('zählt „neu" und „in Arbeit" getrennt — Rückfragen sind weder das eine noch das andere', () => {
    const z = kopfZaehler([
      fb('A', { kurator_status: 'neu' }),
      fb('B', { kurator_status: 'rueckfrage' }),
      fb('C', { kurator_status: 'in_bearbeitung' }),
      fb('D', { kurator_status: 'umgesetzt' }),
    ]);
    expect(z).toEqual({ gesamt: 4, neu: 1, inArbeit: 1 });
  });
});
