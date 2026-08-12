import { describe, it, expect } from 'vitest';
import { eventProminenz } from '@/core/status/timeline';
import { baueSeedVersion } from '@/core/status/seed';
import type { StatusEvent } from '@/core/status/event-typen';

const version = baueSeedVersion();

function ev(o: Partial<StatusEvent>): StatusEvent {
  return {
    id: Math.random().toString(36).slice(2), verbundId: 'VB1', feldId: 'status', wert: 'bewilligt',
    erfasstAm: '2026-01-01T00:00:00.000Z', importId: 'i', quelle: 'import', ...o,
  };
}

describe('timeline', () => {
  it('eventProminenz: Wert-Eintrag > Feld-Default', () => {
    expect(eventProminenz(ev({ feldId: 'status', wert: 'bewilligt' }), version)).toBe('meilenstein');
    expect(eventProminenz(ev({ feldId: 'status', wert: 'gutachten fertig' }), version)).toBe('normal');
    expect(eventProminenz(ev({ feldId: 'vb_phase', wert: '3' }), version)).toBe('nebensaechlich');
    expect(eventProminenz(ev({ feldId: 'antragsdatum', wert: '01.03.2024' }), version)).toBe('meilenstein');
  });
});
