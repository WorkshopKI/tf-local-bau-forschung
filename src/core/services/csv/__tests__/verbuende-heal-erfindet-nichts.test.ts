/**
 * Der Verbund-Heal darf nichts erfinden — und nichts Bestehendes überschreiben.
 *
 * `healMissingVerbuende` nahm `lead.verbund_titel ?? lead.titel` und
 * `lead.status`. Verbund-Ebenen-Felder gehen im Merge aber NIE auf den Antrag
 * (`getCanonicalLevel(...) === 'verbund'` leitet sie in `verbundUpdates` um),
 * also war `verbund_titel` am Slim-Item immer leer und der TV-Fallback griff
 * IMMER; `status` ist STATUS_TV, nicht STATUS_VB. Der Heal läuft bei jedem
 * App-Start UND vor jedem Publish — die Erfindung ging damit team-weit raus.
 *
 * Richtig ist, die Felder offen zu lassen: die Konsumenten fallen von sich aus
 * auf den Lead-TV zurück (`verbund?.titel ?? rep?.titel`), und die
 * Detailseite leitet den Verbund-Status ohnehin aus den TV-Status ab. Ein
 * Anzeige-Fallback zur Lesezeit ist kein persistierter Falschwert.
 *
 * Zweite Hälfte: `listVerbuendeByProgramm` liest über den `programm_id`-Index —
 * ein mis-filed Record gilt dort als fehlend und wurde vom `put` mit
 * TV-Werten ERSETZT. Ein solcher Record wird repariert, nicht neu erfunden.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import {
  getVerbund, listVerbuendeByProgramm, putAntraegeListView, putProgramm, putVerbund,
} from '../idb-csv';
import { healMissingVerbuende } from '../verbuende-rebuild';
import { asAntragStatusRaw, type AntragListItem, type Programm } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

const PID = 'default-programm';

async function freshIdb(): Promise<IDBStore> {
  const s = new IDBStore();
  await s.open();
  const programm: Programm = {
    id: PID, name: 'P', created_at: '2026-06-03T00:00:00.000Z', smb_handle_key: 'daten-share',
  };
  await putProgramm(s, programm);
  return s;
}

function lvItem(az: string, extra: Partial<AntragListItem> = {}): AntragListItem {
  return { aktenzeichen: az, programm_id: PID, _updated_at: '2026-06-03T00:00:00.000Z', ...extra };
}

describe('healMissingVerbuende erfindet keine Verbund-Felder', () => {
  it('übernimmt den TV-Titel NICHT als Verbund-Titel', async () => {
    const idb = await freshIdb();
    await putAntraegeListView(idb, [
      lvItem('16KN1', { verbund_id: 'V1', titel: 'TV1 Teilvorhaben Werkstoffe' }),
      lvItem('16KN2', { verbund_id: 'V1', titel: 'TV2 Teilvorhaben Fügetechnik' }),
    ]);

    await healMissingVerbuende(idb, PID);

    expect((await getVerbund(idb, 'V1'))?.titel).toBeUndefined();
  });

  it('übernimmt den TV-Status NICHT als Verbund-Status', async () => {
    const idb = await freshIdb();
    await putAntraegeListView(idb, [
      lvItem('16KN1', { verbund_id: 'V1', status: asAntragStatusRaw('NF gestellt') }),
    ]);

    await healMissingVerbuende(idb, PID);

    expect((await getVerbund(idb, 'V1'))?.status).toBeUndefined();
  });

  it('ein echter Verbund-Titel am Slim-Item wird weiter übernommen', async () => {
    const idb = await freshIdb();
    await putAntraegeListView(idb, [
      lvItem('16KN1', { verbund_id: 'V1', titel: 'TV-Titel', verbund_titel: 'Der Verbund-Titel' }),
    ]);

    await healMissingVerbuende(idb, PID);

    expect((await getVerbund(idb, 'V1'))?.titel).toBe('Der Verbund-Titel');
  });

  it('das Akronym bleibt — es ist antrag-level und damit kein geratener Wert', async () => {
    const idb = await freshIdb();
    await putAntraegeListView(idb, [
      lvItem('16KN1', { verbund_id: 'V1', akronym: 'LADScessible' }),
    ]);

    await healMissingVerbuende(idb, PID);

    expect((await getVerbund(idb, 'V1'))?.akronym).toBe('LADScessible');
  });
});

describe('healMissingVerbuende repariert mis-filed Records, statt sie zu ersetzen', () => {
  it('behält Titel und Status und korrigiert nur die programm_id', async () => {
    const idb = await freshIdb();
    await putVerbund(idb, {
      verbund_id: 'V1',
      programm_id: 'falsches-programm',
      titel: 'Muster VB Titel 18',
      status: asAntragStatusRaw('beantragt'),
      teilantrags_ids: ['16KN1'],
    });
    await putAntraegeListView(idb, [
      lvItem('16KN1', { verbund_id: 'V1', titel: 'Muster TV Titel 18', status: asAntragStatusRaw('bearbeitungsreif') }),
      lvItem('16KN2', { verbund_id: 'V1', titel: 'Muster TV Titel 19' }),
    ]);
    // Der Index sieht ihn nicht — genau deshalb galt er als „fehlend".
    expect(await listVerbuendeByProgramm(idb, PID)).toHaveLength(0);

    await healMissingVerbuende(idb, PID);

    const vb = await getVerbund(idb, 'V1');
    expect(vb?.programm_id).toBe(PID);
    expect(vb?.titel).toBe('Muster VB Titel 18');
    expect(vb?.status).toBe('beantragt');
    // Ab jetzt findet ihn der Index — das war der Zweck der Reparatur.
    expect(await listVerbuendeByProgramm(idb, PID)).toHaveLength(1);
  });

  it('ergänzt fehlende Teilvorhaben am reparierten Record', async () => {
    const idb = await freshIdb();
    await putVerbund(idb, {
      verbund_id: 'V1', programm_id: '', titel: 'Kuratiert', teilantrags_ids: ['16KN1'],
    });
    await putAntraegeListView(idb, [
      lvItem('16KN1', { verbund_id: 'V1' }),
      lvItem('16KN2', { verbund_id: 'V1' }),
    ]);

    await healMissingVerbuende(idb, PID);

    expect((await getVerbund(idb, 'V1'))?.teilantrags_ids.sort()).toEqual(['16KN1', '16KN2']);
  });
});
