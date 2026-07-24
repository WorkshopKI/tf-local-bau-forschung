import { describe, it, expect } from 'vitest';
import { ermittleReconcileEvents } from '@/core/status/reconcile';
import { baueSeedVersion } from '@/core/status/seed';
import type { StatusEvent } from '@/core/status/event-typen';

const version = baueSeedVersion();
const JETZT = '2026-07-24T00:00:00.000Z';
const ids = (): (() => string) => { let n = 0; return () => `e${n++}`; };

describe('ermittleReconcileEvents', () => {
  it('initial: erstes Vorkommen → quelle initial, kein wertVorher, korrekte Ebene', () => {
    const events = ermittleReconcileEvents(version, {
      verbundId: 'VB1',
      verbundRecord: { status: 'bewilligt' },            // Verbund-Record führt verbund_status unter `status`
      antraege: [{ aktenzeichen: 'AZ1', record: { status: 'gutachten fertig', vb_phase: 3, antragsdatum: '01.03.2024' } }],
      bestehendeEvents: [],
    }, 'imp1', JETZT, ids());

    // verbund_status + status + vb_phase + antragsdatum
    expect(events).toHaveLength(4);
    expect(events.every(e => e.quelle === 'initial')).toBe(true);
    expect(events.every(e => e.wertVorher === undefined)).toBe(true);

    const vs = events.find(e => e.feldId === 'verbund_status');
    expect(vs?.wert).toBe('bewilligt');
    expect(vs?.tvId).toBeUndefined();

    const st = events.find(e => e.feldId === 'status');
    expect(st?.wert).toBe('gutachten fertig');
    expect(st?.tvId).toBe('AZ1');

    const dat = events.find(e => e.feldId === 'antragsdatum');
    expect(dat?.datumFachlich).toBe('2024-03-01');
    expect(dat?.tvId).toBe('AZ1');
  });

  it('idempotent: unveränderte Werte → keine neuen Events', () => {
    const eingabe = {
      verbundId: 'VB1',
      verbundRecord: { status: 'bewilligt' },
      antraege: [{ aktenzeichen: 'AZ1', record: { status: 'bewilligt' } }],
      bestehendeEvents: [] as StatusEvent[],
    };
    const first = ermittleReconcileEvents(version, eingabe, 'i1', JETZT, ids());
    const second = ermittleReconcileEvents(version, { ...eingabe, bestehendeEvents: first }, 'i2', JETZT, ids());
    expect(second).toHaveLength(0);
  });

  it('Änderung: neuer Wert → quelle import mit wertVorher', () => {
    const bestehend: StatusEvent[] = [{
      id: 'x', verbundId: 'VB1', tvId: 'AZ1', feldId: 'status',
      wert: 'gutachten fertig', erfasstAm: JETZT, importId: 'i0', quelle: 'initial',
    }];
    const events = ermittleReconcileEvents(version, {
      verbundId: 'VB1', verbundRecord: {},
      antraege: [{ aktenzeichen: 'AZ1', record: { status: 'bewilligt' } }],
      bestehendeEvents: bestehend,
    }, 'i1', JETZT, ids());

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      feldId: 'status', wert: 'bewilligt', wertVorher: 'gutachten fertig', quelle: 'import', tvId: 'AZ1',
    });
  });

  it('nebensächliches Feld (vb_phase) wird trotzdem erfasst', () => {
    const events = ermittleReconcileEvents(version, {
      verbundId: 'VB1', verbundRecord: {},
      antraege: [{ aktenzeichen: 'AZ1', record: { vb_phase: 3 } }],
      bestehendeEvents: [],
    }, 'i1', JETZT, ids());
    expect(events.some(e => e.feldId === 'vb_phase' && e.wert === '3')).toBe(true);
  });

  it('leere Werte erzeugen keine Events', () => {
    const events = ermittleReconcileEvents(version, {
      verbundId: 'VB1', verbundRecord: { status: '' },
      antraege: [{ aktenzeichen: 'AZ1', record: { status: '   ' } }],
      bestehendeEvents: [],
    }, 'i1', JETZT, ids());
    expect(events).toHaveLength(0);
  });
});
