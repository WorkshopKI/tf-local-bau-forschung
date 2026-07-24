import { describe, it, expect } from 'vitest';
import { eventZeitMs, sortiereEvents, aufzeichnungsGrenze } from '@/core/status/event-sort';
import type { StatusEvent } from '@/core/status/event-typen';

const base = (o: Partial<StatusEvent>): StatusEvent => ({
  id: 'i', verbundId: 'v', feldId: 'status', wert: 'x',
  erfasstAm: '2026-01-01T00:00:00.000Z', importId: 'imp', quelle: 'import', ...o,
});

describe('event-sort', () => {
  it('eventZeitMs bevorzugt datumFachlich (deutsches Datum)', () => {
    expect(eventZeitMs(base({ datumFachlich: '15.03.2024' })))
      .toBe(new Date('2024-03-15').getTime());
  });

  it('eventZeitMs akzeptiert ISO-datumFachlich', () => {
    expect(eventZeitMs(base({ datumFachlich: '2024-03-15' })))
      .toBe(new Date('2024-03-15').getTime());
  });

  it('eventZeitMs fällt bei unparsebarem datumFachlich auf erfasstAm zurück', () => {
    expect(eventZeitMs(base({ datumFachlich: 'kaputt', erfasstAm: '2026-05-05T00:00:00.000Z' })))
      .toBe(new Date('2026-05-05T00:00:00.000Z').getTime());
  });

  it('sortiereEvents ordnet chronologisch (älteste zuerst)', () => {
    const a = base({ id: 'a', datumFachlich: '01.01.2024' });
    const b = base({ id: 'b', datumFachlich: '01.06.2024' });
    expect(sortiereEvents([b, a]).map(e => e.id)).toEqual(['a', 'b']);
  });

  it('aufzeichnungsGrenze = frühestes erfasstAm mit quelle import', () => {
    const events = [
      base({ id: 'i', quelle: 'initial', erfasstAm: '2026-01-01T00:00:00.000Z' }),
      base({ id: 'x', quelle: 'import', erfasstAm: '2026-03-01T00:00:00.000Z' }),
      base({ id: 'y', quelle: 'import', erfasstAm: '2026-02-01T00:00:00.000Z' }),
    ];
    expect(aufzeichnungsGrenze(events)).toBe('2026-02-01T00:00:00.000Z');
  });

  it('aufzeichnungsGrenze fällt ohne import-Events auf das früheste Event zurück', () => {
    expect(aufzeichnungsGrenze([base({ quelle: 'initial', erfasstAm: '2026-01-01T00:00:00.000Z' })]))
      .toBe('2026-01-01T00:00:00.000Z');
  });

  it('aufzeichnungsGrenze ist null bei leerer Liste', () => {
    expect(aufzeichnungsGrenze([])).toBeNull();
  });
});
