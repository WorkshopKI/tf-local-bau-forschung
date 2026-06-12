import { describe, it, expect } from 'vitest';
import { setEintragStatus, pausieren, fortsetzen, abbrechen, istFertig } from '../job-state';
import type { BatchJob } from '../types';

function job(): BatchJob {
  return {
    id: 'j1', erstellt_am: '2026-06-12T00:00:00.000Z', abschnitte: 'nur_a',
    eintraege: [
      { aktenzeichen: 'V1', fkz: 'V1', titel: 'A', status: 'wartet' },
      { aktenzeichen: 'V2', fkz: 'V2', titel: 'B', status: 'wartet' },
    ],
    aktiverIndex: 0, jobStatus: 'laeuft', schemaVersion: 1,
  };
}

describe('job-state', () => {
  it('setEintragStatus ändert nur den Ziel-Index + Extras', () => {
    const next = setEintragStatus(job(), 1, 'fertig', { checkKurz: '1× erzeugt ✓' });
    expect(next.eintraege[0]!.status).toBe('wartet');
    expect(next.eintraege[1]!.status).toBe('fertig');
    expect(next.eintraege[1]!.checkKurz).toBe('1× erzeugt ✓');
  });

  it('pausieren/fortsetzen/abbrechen setzen nur jobStatus', () => {
    expect(pausieren(job()).jobStatus).toBe('pausiert');
    expect(fortsetzen({ ...job(), jobStatus: 'pausiert' }).jobStatus).toBe('laeuft');
    expect(abbrechen(job()).jobStatus).toBe('abgebrochen');
  });

  it('istFertig: false solange ein Eintrag wartet/in_arbeit, sonst true', () => {
    expect(istFertig(job())).toBe(false);
    let j = setEintragStatus(job(), 0, 'fertig');
    j = setEintragStatus(j, 1, 'uebersprungen');
    expect(istFertig(j)).toBe(true);
    expect(istFertig(setEintragStatus(j, 1, 'in_arbeit'))).toBe(false);
  });
});
