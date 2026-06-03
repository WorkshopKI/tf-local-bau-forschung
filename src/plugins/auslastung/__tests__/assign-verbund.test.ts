/**
 * Tests fuer `assignVerbund` im Auslastungs-Store.
 *
 * Invariante „eine Einheit, ein Bearbeiter": die Verbund-atomare Freigabe muss
 * ALLE konkurrierenden Zuweisungen aller TVs des Verbundes im Quartal entfernen
 * (Geist-Freigaben anderer MAs + Fremd-Selbst-Wünsche) und GENAU EINE Freigabe
 * setzen — in EINEM persist (Pitfall #16/#20). Fremde Verbünde + andere Quartale
 * bleiben unberuehrt.
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

describe('assignVerbund', () => {
  beforeEach(() => {
    saveSpy.mockClear();
    useAuslastungData.setState({ data: emptyAuslastungData(), saving: false, loaded: true });
  });

  it('konsolidiert konkurrierende Zuweisungen eines Verbundes auf EINE Freigabe (EIN persist)', async () => {
    const zuweisungen: Zuweisung[] = [
      { antragId: 'A1', anonId: 'MA09', quartal: Q, stunden: 9, anzahlTV: 1, status: 'freigegeben' },              // Geist-Freigabe
      { antragId: 'A2', anonId: 'MA05', quartal: Q, stunden: 9, anzahlTV: 1, status: 'selbst', selbstEingetragen: true }, // Fremd-Selbst-Wunsch
      { antragId: 'B1', anonId: 'MA03', quartal: Q, stunden: 9, status: 'freigegeben' },                          // anderer Verbund
      { antragId: 'A1', anonId: 'MA09', quartal: '2026-Q1', stunden: 9, status: 'freigegeben' },                  // anderes Quartal
    ];
    useAuslastungData.setState({ data: { ...emptyAuslastungData(), zuweisungen }, saving: false, loaded: true });

    await useAuslastungData.getState().assignVerbund(fakeStorage, {
      tvAktenzeichen: ['A1', 'A2'],
      leadAktenzeichen: 'A1',
      anonId: 'MA01',
      quartal: Q,
      stunden: 18,
      anzahlTV: 2,
    });

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const z = useAuslastungData.getState().data.zuweisungen;
    // Verbund (A1/A2) im aktuellen Quartal: genau EINE Freigabe an MA01.
    const v1Q = z.filter(x => (x.antragId === 'A1' || x.antragId === 'A2') && x.quartal === Q);
    expect(v1Q).toHaveLength(1);
    expect(v1Q[0]).toMatchObject({ antragId: 'A1', anonId: 'MA01', status: 'freigegeben', anzahlTV: 2, stunden: 18 });
    // Fremd-Verbund + anderes Quartal unangetastet.
    expect(z.find(x => x.antragId === 'B1')).toBeDefined();
    expect(z.find(x => x.antragId === 'A1' && x.quartal === '2026-Q1')).toBeDefined();
    expect(z).toHaveLength(3);
  });

  it('Re-Zuweisung an anderen Bearbeiter hinterlaesst keinen Geist-Record', async () => {
    useAuslastungData.setState({
      data: {
        ...emptyAuslastungData(),
        zuweisungen: [{ antragId: 'A1', anonId: 'MA01', quartal: Q, stunden: 9, anzahlTV: 1, status: 'freigegeben' }],
      },
      saving: false,
      loaded: true,
    });

    await useAuslastungData.getState().assignVerbund(fakeStorage, {
      tvAktenzeichen: ['A1'],
      leadAktenzeichen: 'A1',
      anonId: 'MA02',
      quartal: Q,
      stunden: 9,
      anzahlTV: 1,
    });

    const z = useAuslastungData.getState().data.zuweisungen;
    expect(z).toHaveLength(1);
    expect(z[0]).toMatchObject({ antragId: 'A1', anonId: 'MA02', status: 'freigegeben' });
  });
});
