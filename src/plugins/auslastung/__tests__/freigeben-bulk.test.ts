/**
 * Bulk-Freigabe-Tests fuer den Auslastungs-Store.
 *
 * Regressions-Schutz gegen Pitfall #16/#20: Mehrere Freigaben muessen in EINEM
 * `persist`-Call landen, nicht N sequentielle SMB-Roundtrips. Vor dem Fix lief
 * `bulkFreigeben` ueber `freigebenKategorien` pro TV → N volle atomicWrites
 * (~2 s/Verbund, 40 Verbuende = 80 s). `freigebenKategorienBulk` sammelt alle
 * Mutationen in EINEM setState + EINEM persist.
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
import { emptyAuslastungData, type Klassifizierung } from '../types';

const fakeStorage = {} as never;

describe('freigebenKategorienBulk', () => {
  beforeEach(() => {
    saveSpy.mockClear();
    useAuslastungData.setState({ data: emptyAuslastungData(), saving: false, loaded: true });
  });

  it('persistiert N Freigaben in genau EINEM persist-Call', async () => {
    const entries = Array.from({ length: 40 }, (_, i) => ({
      antragId: `AZ-${i}`,
      kategorieIds: ['IT', 'DT'],
    }));

    await useAuslastungData.getState().freigebenKategorienBulk(fakeStorage, entries);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const klass = useAuslastungData.getState().data.klassifizierungen;
    expect(klass).toHaveLength(40);
    expect(klass.every(k => k.status === 'freigegeben')).toBe(true);
    expect(klass[0]!.freigegebenePrimaer).toBe('IT');
    expect(klass[0]!.freigegebeneAspekte).toEqual(['DT']);
  });

  it('mergt bestehende Vorschlaege beim Freigeben statt zu duplizieren', async () => {
    const existing: Klassifizierung = {
      antragId: 'AZ-1',
      vorgeschlagenePrimaer: { kategorieId: 'IT', confidence: 0.9, methode: 'regel' },
      vorgeschlageneAspekte: [{ kategorieId: 'DT', confidence: 0.8 }],
      freigegebenePrimaer: '',
      freigegebeneAspekte: [],
      status: 'vorgeschlagen',
    };
    useAuslastungData.setState({
      data: { ...emptyAuslastungData(), klassifizierungen: [existing] },
      saving: false,
      loaded: true,
    });

    await useAuslastungData.getState().freigebenKategorienBulk(fakeStorage, [
      { antragId: 'AZ-1', kategorieIds: ['IT', 'DT'] },
    ]);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const klass = useAuslastungData.getState().data.klassifizierungen;
    expect(klass).toHaveLength(1);
    expect(klass[0]!.status).toBe('freigegeben');
    expect(klass[0]!.vorgeschlagenePrimaer?.kategorieId).toBe('IT');
    expect(klass[0]!.freigegebenePrimaer).toBe('IT');
    expect(klass[0]!.freigegebeneAspekte).toEqual(['DT']);
  });

  it('ist ein No-op (kein persist) bei leeren entries', async () => {
    await useAuslastungData.getState().freigebenKategorienBulk(fakeStorage, []);
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
