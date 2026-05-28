/**
 * Persist-Entkopplung im Auslastungs-Store (SMB-Schreiben-Fix).
 *
 * Deckt ab:
 *  - upsertKlassifizierungenLocal schreibt NICHT (nur In-Memory).
 *  - schedulePersist debouncet + coalesct rapide Mutationen zu EINEM Write.
 *  - flushPersist schreibt einen ausstehenden Debounce-Write sofort.
 *  - Coalesce/Dirty: Mutation waehrend laufendem Save → Nachschreiben statt Drop
 *    (Pitfall #16/#20).
 *  - Clobber-Fix: Mutation waehrend laufendem Save bleibt im finalen data-Stand.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Kontrollierbarer Save-Mock: kann blockieren, bis der Test ihn freigibt.
let saveCalls: Array<{ klassifizierungenLen: number }> = [];
let pendingResolvers: Array<() => void> = [];
let blockSaves = false;

const saveSpy = vi.fn(
  async (_storage: unknown, data: { klassifizierungen: unknown[]; updatedAt?: string }) => {
    saveCalls.push({ klassifizierungenLen: data.klassifizierungen.length });
    if (blockSaves) {
      await new Promise<void>(res => pendingResolvers.push(res));
    }
    return { ...data, updatedAt: 'ts' };
  },
);
vi.mock('../services/auslastung-store', () => ({
  saveAuslastungData: (storage: unknown, data: unknown) =>
    saveSpy(storage, data as { klassifizierungen: unknown[] }),
  loadAuslastungData: vi.fn(),
}));

import { useAuslastungData } from '../hooks/useAuslastungData';
import { emptyAuslastungData, type Klassifizierung } from '../types';

const storage = {} as never;

function makeKl(antragId: string): Klassifizierung {
  return {
    antragId,
    vorgeschlagenePrimaer: { kategorieId: 'IT', confidence: 0.9, methode: 'regel' },
    vorgeschlageneAspekte: [],
    freigegebenePrimaer: '',
    freigegebeneAspekte: [],
    status: 'vorgeschlagen',
  };
}

function flushMicrotasks(): Promise<void> {
  return new Promise(res => setTimeout(res, 0));
}

beforeEach(() => {
  saveSpy.mockClear();
  saveCalls = [];
  pendingResolvers = [];
  blockSaves = false;
  useAuslastungData.setState({
    data: emptyAuslastungData(),
    saving: false,
    persistDirty: false,
    loaded: true,
    error: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('upsertKlassifizierungenLocal', () => {
  it('schreibt NICHT auf den Share (nur In-Memory)', () => {
    useAuslastungData.getState().upsertKlassifizierungenLocal([makeKl('A1'), makeKl('A2')]);
    expect(saveSpy).not.toHaveBeenCalled();
    expect(useAuslastungData.getState().data.klassifizierungen).toHaveLength(2);
  });
});

describe('schedulePersist — Debounce + Coalesce', () => {
  it('coalesct mehrere Aufrufe zu EINEM Save nach dem Debounce', async () => {
    vi.useFakeTimers();
    const s = useAuslastungData.getState();
    s.upsertKlassifizierungenLocal([makeKl('A1')]);
    s.schedulePersist(storage);
    s.upsertKlassifizierungenLocal([makeKl('A2')]);
    s.schedulePersist(storage); // resettet den Timer

    expect(saveSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveCalls[0]!.klassifizierungenLen).toBe(2);
  });
});

describe('flushPersist', () => {
  it('schreibt einen ausstehenden Debounce-Write sofort', async () => {
    const s = useAuslastungData.getState();
    s.upsertKlassifizierungenLocal([makeKl('A1')]);
    s.schedulePersist(storage);
    await s.flushPersist(storage);
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('ist No-op wenn nichts aussteht', async () => {
    await useAuslastungData.getState().flushPersist(storage);
    expect(saveSpy).not.toHaveBeenCalled();
  });
});

describe('Coalesce/Dirty — kein Drop-Write bei Mutation waehrend Save', () => {
  it('schreibt den neuesten Stand nach, statt den zweiten Write zu verwerfen', async () => {
    blockSaves = true;
    const s = useAuslastungData.getState();

    s.upsertKlassifizierungenLocal([makeKl('A1')]);
    const p1 = s.persistNow(storage); // Save #1 startet, blockiert
    await flushMicrotasks();
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // Mutation + persistNow waehrend Save #1 laeuft → wird als dirty markiert.
    s.upsertKlassifizierungenLocal([makeKl('A2')]);
    await s.persistNow(storage);
    expect(saveSpy).toHaveBeenCalledTimes(1); // noch kein zweiter Save
    expect(useAuslastungData.getState().persistDirty).toBe(true);

    pendingResolvers.shift()!(); // Save #1 freigeben
    await flushMicrotasks();
    expect(saveSpy).toHaveBeenCalledTimes(2); // Nachschreiben gestartet
    expect(saveCalls[1]!.klassifizierungenLen).toBe(2); // mit beiden Records

    pendingResolvers.shift()!(); // Save #2 freigeben
    await p1;
    expect(useAuslastungData.getState().saving).toBe(false);
    expect(useAuslastungData.getState().persistDirty).toBe(false);
  });
});

describe('Clobber-Fix — Mutation waehrend Save bleibt erhalten', () => {
  it('ueberschreibt zwischenzeitliche Mutationen nicht mit dem Write-Start-Snapshot', async () => {
    blockSaves = true;
    const s = useAuslastungData.getState();

    s.upsertKlassifizierungenLocal([makeKl('A1')]);
    const p = s.persistNow(storage); // Save #1 startet mit [A1], blockiert
    await flushMicrotasks();

    // Mutation waehrend des await — KEIN weiterer persistNow-Aufruf.
    s.upsertKlassifizierungenLocal([makeKl('A2')]);

    pendingResolvers.shift()!();
    await p;

    const klass = useAuslastungData.getState().data.klassifizierungen;
    expect(klass.map(k => k.antragId).sort()).toEqual(['A1', 'A2']); // A2 nicht geclobbert
    expect(useAuslastungData.getState().data.updatedAt).toBe('ts');   // Timestamp gestempelt
  });
});
