/**
 * Tests fuer `reconcileZuweisungen` im Auslastungs-Store.
 *
 * Einmal-Bereinigung von Altdaten (eine Einheit, ein Bearbeiter): in einer
 * (Verbund, Quartal)-Gruppe MIT Freigabe bleibt nur die hoechstrangige ACTIVE
 * Zuweisung (freigegeben > selbst) — uebrige fallen weg, abgelehnt-Marker
 * bleiben. Gruppen OHNE Freigabe bleiben vollstaendig: mehrere Interessenten
 * sind vor der Freigabe erlaubt (Pitfall #26).
 * Idempotent: kein persist, wenn nichts zu bereinigen ist.
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
import { emptyAuslastungData, type Klassifizierung, type Zuweisung } from '../types';

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

function makeKl(antragId: string): Klassifizierung {
  return {
    antragId,
    vorgeschlagenePrimaer: { kategorieId: 'IT', confidence: 0.9, methode: 'regel' },
    vorgeschlageneAspekte: [],
    freigegebenePrimaer: 'IT',
    freigegebeneAspekte: [],
    status: 'freigegeben',
  };
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

  it('laesst mehrere Interessenten EINES Verbundes stehen, solange keine Freigabe existiert', async () => {
    // Zwei Bewerbungen auf denselben Verbund V1 — erlaubt (Pitfall #26). Wer
    // hier kollabiert, loescht beim naechsten App-Start die halbe Interessenten-
    // Liste und die Zeile zeigt nur noch „will MA01".
    setZuweisungen([
      { antragId: 'A1', anonId: 'MA01', quartal: Q, stunden: 9, anzahlTV: 1, status: 'selbst', selbstEingetragen: true },
      { antragId: 'A2', anonId: 'MA02', quartal: Q, stunden: 9, anzahlTV: 1, status: 'selbst', selbstEingetragen: true },
    ]);

    const { entfernt } = await useAuslastungData.getState().reconcileZuweisungen(fakeStorage, inV1);

    expect(entfernt).toBe(0);
    expect(saveSpy).not.toHaveBeenCalled();
    const z = useAuslastungData.getState().data.zuweisungen;
    expect(new Set(z.map(x => x.anonId))).toEqual(new Set(['MA01', 'MA02']));
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

  // ── Kürzel-Supersede: extern (CSV) zugewiesene Anträge ───────────────────

  it('verwirft ALLE App-Records eines extern (CSV-tib_kuerz) zugewiesenen Antrags', async () => {
    useAuslastungData.setState({
      data: {
        ...emptyAuslastungData(),
        zuweisungen: [
          { antragId: 'A1', anonId: 'MA09', quartal: Q, stunden: 9, anzahlTV: 1, status: 'freigegeben' },
          { antragId: 'B1', anonId: 'MA05', quartal: Q, stunden: 9, anzahlTV: 1, status: 'selbst', selbstEingetragen: true },
        ],
        klassifizierungen: [makeKl('A1'), makeKl('B1')],
      },
      saving: false,
      loaded: true,
    });
    // A1 wurde extern in der CSV einem TIB-Kürzel zugewiesen → tib_kuerz gesetzt.
    const hatKuerzel = (id: string): boolean => id === 'A1';

    const { entfernt } = await useAuslastungData.getState().reconcileZuweisungen(fakeStorage, idResolver, hatKuerzel);

    expect(entfernt).toBe(2); // A1-Zuweisung + A1-Klassifizierung
    expect(saveSpy).toHaveBeenCalledTimes(1);
    const d = useAuslastungData.getState().data;
    expect(d.zuweisungen.map(z => z.antragId)).toEqual(['B1']);
    expect(d.klassifizierungen.map(k => k.antragId)).toEqual(['B1']);
  });

  it('lässt Records für (noch) nicht extern zugewiesene Anträge unberührt', async () => {
    setZuweisungen([
      { antragId: 'A1', anonId: 'MA09', quartal: Q, stunden: 9, anzahlTV: 1, status: 'freigegeben' },
    ]);
    // Kein Antrag trägt ein CSV-Kürzel.
    const { entfernt } = await useAuslastungData.getState().reconcileZuweisungen(fakeStorage, idResolver, () => false);

    expect(entfernt).toBe(0);
    expect(saveSpy).not.toHaveBeenCalled();
    expect(useAuslastungData.getState().data.zuweisungen).toHaveLength(1);
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
