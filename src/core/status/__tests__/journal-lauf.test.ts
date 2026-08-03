/**
 * Der Journal-**Lauf**: die Reihenfolge, in der geprüft, gerechnet und
 * geschrieben wird.
 *
 * Getestet gegen einen gefälschten Share (`./stand` gemockt), weil hier nicht
 * die Datei-Mechanik interessiert, sondern die Entscheidungen: Was passiert beim
 * ersten Lauf? Beim zweiten mit derselben Datei? Wenn ein anderes Gerät
 * schneller war? Und was, wenn kein Schreibrecht besteht?
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { JournalEintrag, JournalStand, Stempel } from '@/core/status/journal/typen';

const share: {
  stand: JournalStand | null;
  angehaengt: JournalEintrag[];
  schreibrecht: boolean;
  /** Simuliert ein anderes Gerät, das zwischen Diff und Schreiben fertig wird. */
  beimZweitenLesen?: () => void;
  lesezaehler: number;
} = { stand: null, angehaengt: [], schreibrecht: true, lesezaehler: 0 };

vi.mock('@/core/status/journal/stand', async (echt) => {
  const original = await echt<typeof import('@/core/status/journal/stand')>();
  return {
    ...original,
    leseStand: async () => {
      share.lesezaehler += 1;
      if (share.lesezaehler === 2) share.beimZweitenLesen?.();
      return share.stand;
    },
    schreibeStand: async (_idb: IDBStore, s: JournalStand) => {
      if (!share.schreibrecht) return false;
      share.stand = s;
      return true;
    },
    haengeEintraegeAn: async (_idb: IDBStore, e: readonly JournalEintrag[]) => {
      if (!share.schreibrecht) return false;
      share.angehaengt.push(...e);
      return true;
    },
  };
});

const { laufeJournal } = await import('@/core/status/journal/lauf');

const IDB = {} as IDBStore;
const BEREICH = ['76', '77'];
const S1: Stempel = { id: 'aaa111', datum: '2026-08-01' };
const S2: Stempel = { id: 'bbb222', datum: '2026-08-02' };

beforeEach(() => {
  share.stand = null;
  share.angehaengt = [];
  share.schreibrecht = true;
  share.lesezaehler = 0;
  share.beimZweitenLesen = undefined;
});

describe('Erster Lauf — Baseline', () => {
  it('schreibt die Werte und KEINE Einträge', async () => {
    const e = await laufeJournal(IDB, {
      stempel: S1, bereich: BEREICH,
      werte: { A1: { D_ARZ: 20260801 }, A2: { D_ABB: 20260715 } },
    });
    expect(e.art).toBe('baseline');
    expect(e.eintraege).toBe(0);
    expect(share.angehaengt).toEqual([]);
    expect(e.antraege).toBe(2);
  });

  it('setzt den Nullpunkt auf das Export-Datum', async () => {
    const e = await laufeJournal(IDB, { stempel: S1, bereich: BEREICH, werte: { A1: {} } });
    expect(e.journalAb).toBe('2026-08-01');
    expect(share.stand?.journalAb).toBe('2026-08-01');
  });
});

describe('Zweiter Lauf', () => {
  it('meldet die Änderungen und behält den Nullpunkt', async () => {
    await laufeJournal(IDB, { stempel: S1, bereich: BEREICH, werte: { A1: { D_ARZ: 20260801 } } });
    const e = await laufeJournal(IDB, {
      stempel: S2, bereich: BEREICH, werte: { A1: { D_ARZ: 20260802 } },
    });
    expect(e.art).toBe('diff');
    expect(e.eintraege).toBe(1);
    expect(share.angehaengt[0]).toMatchObject({ art: 'geaendert', antragId: 'A1' });
    expect(e.journalAb, 'der Nullpunkt bleibt der des Baseline-Laufs').toBe('2026-08-01');
  });

  it('überspringt einen unveränderten Export — gleicher Stempel, nichts zu tun', async () => {
    await laufeJournal(IDB, { stempel: S1, bereich: BEREICH, werte: { A1: { D_ARZ: 1 } } });
    const e = await laufeJournal(IDB, {
      stempel: S1, bereich: BEREICH, werte: { A1: { D_ARZ: 999 } },
    });
    expect(e.art).toBe('uebersprungen');
    expect(share.angehaengt).toEqual([]);
    expect(share.stand?.werte.A1?.D_ARZ, 'der Stand bleibt unangetastet').toBe(1);
  });
});

describe('Bereichswechsel', () => {
  it('legt für neu hinzugekommene Anträge eine Baseline an statt sie zu melden', async () => {
    await laufeJournal(IDB, { stempel: S1, bereich: ['76'], werte: { A1: { D_ARZ: 1 } } });
    const e = await laufeJournal(IDB, {
      stempel: S2, bereich: ['76', '77'],
      werte: { A1: { D_ARZ: 1 }, B1: { D_ARZ: 5 }, B2: { D_ARZ: 6 } },
    });
    expect(e.art).toBe('diff');
    expect(e.neuImBereich).toBe(2);
    expect(e.eintraege, 'kein Phantom-antrag-neu').toBe(0);
    expect(share.stand?.werte.B1, 'sie stehen aber im Stand').toEqual({ D_ARZ: 5 });
    expect(share.stand?.bereich).toEqual(['76', '77']);
  });

  it('meldet herausgefallene Anträge NICHT als verschwunden', async () => {
    await laufeJournal(IDB, {
      stempel: S1, bereich: ['76', '77'], werte: { A1: { D_ARZ: 1 }, B1: { D_ARZ: 5 } },
    });
    const e = await laufeJournal(IDB, { stempel: S2, bereich: ['76'], werte: { A1: { D_ARZ: 1 } } });
    expect(e.ausDemBereich).toBe(1);
    expect(e.eintraege).toBe(0);
  });
});

describe('Optimistische Sperre', () => {
  it('bricht ab, wenn ein anderes Gerät denselben Export schon verbucht hat', async () => {
    await laufeJournal(IDB, { stempel: S1, bereich: BEREICH, werte: { A1: { D_ARZ: 1 } } });
    share.lesezaehler = 0;
    // Zwischen Diff und Schreiben wird der Stand fremd fortgeschrieben.
    share.beimZweitenLesen = () => {
      share.stand = { ...share.stand!, letzterStempel: S2, verarbeitet: [S2.id, S1.id] };
    };
    const e = await laufeJournal(IDB, {
      stempel: S2, bereich: BEREICH, werte: { A1: { D_ARZ: 2 } },
    });
    expect(e.art).toBe('kollision');
    expect(share.angehaengt, 'nichts doppelt angehängt').toEqual([]);
  });
});

describe('Ohne Schreibrecht', () => {
  it('rechnet, schreibt aber nichts — das Gerät liest mit', async () => {
    share.schreibrecht = true;
    await laufeJournal(IDB, { stempel: S1, bereich: BEREICH, werte: { A1: { D_ARZ: 1 } } });
    share.schreibrecht = false;
    const e = await laufeJournal(IDB, {
      stempel: S2, bereich: BEREICH, werte: { A1: { D_ARZ: 2 } },
    });
    expect(e.art).toBe('nur-gelesen');
    expect(e.eintraege, 'der Diff ist gerechnet, nur nicht geschrieben').toBe(1);
    expect(share.angehaengt).toEqual([]);
    expect(share.stand?.letzterStempel.id, 'der Team-Stand bleibt unberührt').toBe(S1.id);
  });

  it('meldet auch die Baseline als nur-gelesen', async () => {
    share.schreibrecht = false;
    const e = await laufeJournal(IDB, { stempel: S1, bereich: BEREICH, werte: { A1: {} } });
    expect(e.art).toBe('nur-gelesen');
    expect(share.stand).toBeNull();
  });
});
