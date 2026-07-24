import { describe, it, expect } from 'vitest';
import { eventProminenz, baueLanes, clustere, type TimelineEvent } from '@/core/status/timeline';
import { baueSeedVersion } from '@/core/status/seed';
import { aendereFeld } from '@/core/status/katalog-edit';
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

  it('baueLanes filtert ignoriert immer, nebensächlich nur per Toggle, splittet Lanes', () => {
    const events = [
      ev({ feldId: 'verbund_status', wert: 'bewilligt' }),               // Verbund-Lane, meilenstein
      ev({ tvId: 'AZ1', feldId: 'status', wert: 'gutachten fertig' }),    // TV AZ1, normal
      ev({ tvId: 'AZ1', feldId: 'vb_phase', wert: '3' }),                 // TV AZ1, nebensächlich
      ev({ tvId: 'AZ2', feldId: 'antragsdatum', wert: '01.03.2024', datumFachlich: '2024-03-01' }),
    ];
    const ohne = baueLanes(events, version, { zeigeNebensaechlich: false });
    expect(ohne.verbund).toHaveLength(1);
    expect(ohne.tvLanes.find(l => l.tvId === 'AZ1')?.events).toHaveLength(1); // vb_phase raus
    expect(ohne.tvLanes.find(l => l.tvId === 'AZ2')?.events).toHaveLength(1);

    const mit = baueLanes(events, version, { zeigeNebensaechlich: true });
    expect(mit.tvLanes.find(l => l.tvId === 'AZ1')?.events).toHaveLength(2);
  });

  it('baueLanes filtert ignoriert-Felder komplett', () => {
    const v = aendereFeld(version, 'vb_phase', { prominenzDefault: 'ignoriert' });
    const lanes = baueLanes([ev({ tvId: 'AZ1', feldId: 'vb_phase', wert: '3' })], v, { zeigeNebensaechlich: true });
    expect(lanes.tvLanes).toHaveLength(0);
  });

  it('clustere fasst nahe Zeitpunkte zusammen', () => {
    const te = (ms: number): TimelineEvent => ({ event: ev({}), prominenz: 'normal', ms });
    const TAG = 86_400_000;
    const cluster = clustere([te(0), te(TAG), te(10 * TAG)], 2 * TAG);
    expect(cluster).toHaveLength(2);
    expect(cluster[0]!.events).toHaveLength(2);
    expect(cluster[1]!.events).toHaveLength(1);
  });
});
