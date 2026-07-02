/**
 * `getActiveUnterprogrammCodes` baut die Allowlist für den Master-Import.
 *
 * Kern-Regression (Prod-Vorfall 2026-07): ein LEERER `unterprogramme`-Store darf
 * NICHT „skip all" bedeuten — sonst verwirft der Master-Import jede Zeile still
 * (leere Allowlist), obwohl die Absicht „kein Filter" ist. Leerer Store ⇒ null.
 * Eine bewusste „alle deaktiviert"-Absicht (vorhandene Einträge, alle aktiv:false)
 * bleibt dagegen als leere Allowlist erhalten (Skip-all).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../idb-csv', () => ({
  putUnterprogramm: vi.fn(),
  getUnterprogramm: vi.fn(),
  listUnterprogrammeByProgramm: vi.fn(),
  listAntraegeByProgramm: vi.fn(),
}));

import { getActiveUnterprogrammCodes } from '../unterprogrammRegistry';
import { listUnterprogrammeByProgramm } from '../idb-csv';
import type { CsvSchema } from '../types';
import type { IDBStore } from '@/core/services/storage/idb-store';

const idb = {} as IDBStore;
const master = { is_master: true, programm_id: 'p1' } as CsvSchema;
const mockList = listUnterprogrammeByProgramm as unknown as ReturnType<typeof vi.fn>;

describe('getActiveUnterprogrammCodes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Nicht-Master → null (kein Filter)', async () => {
    const r = await getActiveUnterprogrammCodes(idb, { is_master: false, programm_id: 'p1' } as CsvSchema);
    expect(r).toBeNull();
  });

  it('leerer Store → null (kein Filter, NICHT alles verwerfen) — Prod-Fix', async () => {
    mockList.mockResolvedValue([]);
    const r = await getActiveUnterprogrammCodes(idb, master);
    expect(r).toBeNull();
  });

  it('nur aktive Codes landen in der Allowlist', async () => {
    mockList.mockResolvedValue([
      { code: '138', aktiv: true },
      { code: '47', aktiv: true },
      { code: '99', aktiv: false },
    ]);
    const r = await getActiveUnterprogrammCodes(idb, master);
    expect(r).toEqual(new Set(['138', '47']));
  });

  it('Einträge vorhanden, aber keiner aktiv → leere Allowlist (bewusste Deaktivierung bleibt Skip-all)', async () => {
    mockList.mockResolvedValue([{ code: '138', aktiv: false }]);
    const r = await getActiveUnterprogrammCodes(idb, master);
    expect(r).toEqual(new Set());
    expect(r).not.toBeNull();
  });
});
