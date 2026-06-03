/**
 * Tests fuer `reconcileZuweisungen` im Auslastungs-Store.
 *
 * Einmal-Bereinigung von Altdaten (eine Einheit, ein Bearbeiter): pro
 * (Verbund, Quartal) bleibt nur die hoechstrangige ACTIVE Zuweisung
 * (freigegeben > selbst) — uebrige ACTIVE-Dubletten fallen weg, abgelehnt-Marker
 * bleiben. Idempotent: kein persist, wenn nichts zu bereinigen ist.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const saveSpy = vi.fn(
  async (_storage: unknown, data: unknown) => ({ ...(data as object), updatedAt: 'x' }),
);
vi.mock('../services/auslastung-store', () => ({
  saveAuslastungData: (storage: unknown, data: unknown) => saveSpy(storage, data),
  loadAuslastungData: vi.fn(),
}));

import { useAuslastungData } from '../hooks/useAuslastungData';
import { emptyAuslastungData, type Zuweisung } from '../types';

const fakeStorage = {} as never;
const Q = '2026-Q2';
const idResolver = (id: string): string => id;
// A1 + A2 gehoeren zum selben Verbund V1.
const inV1 = (id: string): string => (id === 'A1' || id === 'A2' ? 'V1' : id);

function setZuweisungen(zuweisungen: Zuweisung[]): void {
  useAuslastungData.setState({
    data: { ...emptyAuslastungData(), zuweisungen },
    saving: false,
    loaded: true,
  });
}

describe('reconcileZuweisungen', () => {
  beforeEach(() => {
    saveSpy.mockClear();
    useAuslastungData.setState({ data: emptyAuslastungData(), saving: false, loaded: true });
  });

  it('collapst konkurrierende ACTIVE Zuweisungen desselben Antrags auf die Freigabe', async () => {
    setZuweisungen([
      { antragId: 'A1', anonId: 'MA05', quartal: Q, stunden: 9, anzahlTV: 1, status: 'selbst', selbstEingetragen: true },
      { antragId: 'A1', anonId: 'MA09', quartal: Q, stunden: 9, anzahlTV: 1, status: 'freigegeben' },
    ]);

    const { entfernt } = await useAuslastungData.getState().reconcileZuweisungen(fakeStorage, idResolver);

    expect(entfernt).toBe(1);
    expect(saveSpy).toHaveBeenCalledTimes(1);
    const z = useAuslastungData.getState().data.zuweisungen;
    expect(z).toHaveLength(1);
    expect(z[0]).toMatchObject({ anonId: 'MA09', status: 'freigegeben' });
  });

  it('collapst TVs desselben Verbundes (verbund_id) auf eine Zuweisung', async () => {
    setZuweisungen([
      { antragId: 'A1', anonId: 'MA09', quartal: Q, stunden: 18, anzahlTV: 2, status: 'freigegeben' },
      { antragId: 'A2', anonId: 'MA05', quartal: Q, stunden: 9, anzahlTV: 1, status: 'selbst', selbstEingetragen: true },
    ]);

    const { entfernt } = await useAuslastungData.getState().reconcileZuweisungen(fakeStorage, inV1);

    expect(entfernt).toBe(1);
    const z = useAuslastungData.getState().data.zuweisungen;
    expect(z).toHaveLength(1);
    expect(z[0]).toMatchObject({ antragId: 'A1', anonId: 'MA09', status: 'freigegeben' });
  });

  it('laesst abgelehnt-Marker unangetastet', async () => {
    setZuweisungen([
      { antragId: 'A1', anonId: 'MA09', quartal: Q, stunden: 9, anzahlTV: 1, status: 'freigegeben' },
      { antragId: 'A1', anonId: 'MA05', quartal: Q, stunden: 9, anzahlTV: 1, status: 'selbst', selbstEingetragen: true },
      { antragId: 'A1', anonId: 'MA03', quartal: Q, stunden: 0, status: 'abgelehnt' },
    ]);

    const { entfernt } = await useAuslastungData.getState().reconcileZuweisungen(fakeStorage, idResolver);

    expect(entfernt).toBe(1); // nur der selbst-Eintrag faellt
    const z = useAuslastungData.getState().data.zuweisungen;
    expect(z).toHaveLength(2);
    expect(z.find(x => x.status === 'abgelehnt' && x.anonId === 'MA03')).toBeDefined();
    expect(z.find(x => x.status === 'freigegeben' && x.anonId === 'MA09')).toBeDefined();
    expect(z.find(x => x.status === 'selbst')).toBeUndefined();
  });

  it('trennt nach Quartal — gleiche Verbund-Zuweisung in zwei Quartalen bleibt', async () => {
    setZuweisungen([
      { antragId: 'A1', anonId: 'MA09', quartal: '2026-Q2', stunden: 9, anzahlTV: 1, status: 'freigegeben' },
      { antragId: 'A1', anonId: 'MA05', quartal: '2026-Q1', stunden: 9, anzahlTV: 1, status: 'selbst', selbstEingetragen: true },
    ]);

    const { entfernt } = await useAuslastungData.getState().reconcileZuweisungen(fakeStorage, idResolver);

    expect(entfernt).toBe(0);
    expect(saveSpy).not.toHaveBeenCalled();
    expect(useAuslastungData.getState().data.zuweisungen).toHaveLength(2);
  });

  it('ist ein No-op (kein persist), wenn nichts zu bereinigen ist', async () => {
    setZuweisungen([
      { antragId: 'A1', anonId: 'MA09', quartal: Q, stunden: 9, anzahlTV: 1, status: 'freigegeben' },
      { antragId: 'B1', anonId: 'MA05', quartal: Q, stunden: 9, anzahlTV: 1, status: 'selbst', selbstEingetragen: true },
    ]);

    const { entfernt } = await useAuslastungData.getState().reconcileZuweisungen(fakeStorage, idResolver);

    expect(entfernt).toBe(0);
    expect(saveSpy).not.toHaveBeenCalled();
    expect(useAuslastungData.getState().data.zuweisungen).toHaveLength(2);
  });
});
