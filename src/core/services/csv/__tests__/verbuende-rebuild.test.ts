/**
 * Self-Heal des abgeleiteten `verbuende`-Caches: ist der Store leer, obwohl die
 * Anträge (Slim-List-View) Verbund-IDs referenzieren, müssen die fehlenden
 * Verbund-Records aus der List-View rekonstruiert werden — sonst zeigt jede
 * Verbund-Detailseite „Verbund … nicht gefunden" (Bug: leerer verbuende-Store,
 * der vom idempotenten Snapshot-Sync nicht nachgeladen wird).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import {
  putProgramm,
  putAntraegeListView,
  putVerbund,
  getVerbund,
  listVerbuendeByProgramm,
} from '../idb-csv';
import { healMissingVerbuende } from '../verbuende-rebuild';
import type { AntragListItem, Programm } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

async function freshIdb(): Promise<IDBStore> {
  const s = new IDBStore();
  await s.open();
  return s;
}

const PID = 'default-programm';

function makeProgramm(id: string): Programm {
  return { id, name: `P ${id}`, created_at: '2026-06-03T00:00:00.000Z', smb_handle_key: 'daten-share' };
}

function lvItem(az: string, extra: Partial<AntragListItem> = {}): AntragListItem {
  return {
    aktenzeichen: az,
    programm_id: PID,
    _updated_at: '2026-06-03T00:00:00.000Z',
    ...extra,
  };
}

describe('healMissingVerbuende', () => {
  it('rekonstruiert fehlende Verbund-Records aus der List-View (Key == verbund_id, TVs gruppiert)', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    // verbuende-Store leer; List-View hat zwei TVs desselben Verbundes + ein Solo.
    await putAntraegeListView(idb, [
      lvItem('16KN110645', { verbund_id: 'ZKN110630', akronym: 'LADScessible', titel: 'TV A' }),
      lvItem('16KN110646', { verbund_id: 'ZKN110630', akronym: 'LADScessible', titel: 'TV B' }),
      lvItem('16EP250213', { akronym: 'Solo' }), // kein verbund_id → kein Verbund
    ]);
    expect(await listVerbuendeByProgramm(idb, PID)).toHaveLength(0);

    const created = await healMissingVerbuende(idb, PID);

    expect(created).toBe(1);
    const vb = await getVerbund(idb, 'ZKN110630');
    expect(vb).not.toBeNull();
    expect(vb?.verbund_id).toBe('ZKN110630');
    expect(vb?.programm_id).toBe(PID);
    expect(vb?.akronym).toBe('LADScessible');
    expect(vb?.teilantrags_ids.sort()).toEqual(['16KN110645', '16KN110646']);
  });

  it('bevorzugt verbund_titel vor dem TV-Titel', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    await putAntraegeListView(idb, [
      lvItem('16KN1', { verbund_id: 'V1', titel: 'TV-Titel', verbund_titel: 'Der Verbund-Titel' }),
    ]);

    await healMissingVerbuende(idb, PID);

    expect((await getVerbund(idb, 'V1'))?.titel).toBe('Der Verbund-Titel');
  });

  it('lässt vorhandene Verbund-Records unangetastet und ist dann ein No-op', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    await putVerbund(idb, {
      verbund_id: 'V1',
      programm_id: PID,
      titel: 'Kuratiert',
      teilantrags_ids: ['16KN1'],
    });
    await putAntraegeListView(idb, [lvItem('16KN1', { verbund_id: 'V1', titel: 'TV' })]);

    const created = await healMissingVerbuende(idb, PID);

    expect(created).toBe(0);
    // Kuratierter Titel bleibt erhalten (nicht überschrieben).
    expect((await getVerbund(idb, 'V1'))?.titel).toBe('Kuratiert');
  });

  it('keine verbund_id in der List-View → 0 Records, kein Crash', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    await putAntraegeListView(idb, [lvItem('16EP1'), lvItem('16EP2')]);

    expect(await healMissingVerbuende(idb, PID)).toBe(0);
    expect(await listVerbuendeByProgramm(idb, PID)).toHaveLength(0);
  });
});
