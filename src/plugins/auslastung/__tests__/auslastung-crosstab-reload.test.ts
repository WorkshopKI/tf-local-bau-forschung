/**
 * Cross-Tab-Reload (v2.25) — `reloadFromShare` lädt bei einem fremden Write
 * frisch vom Share, ohne dabei den eigenen Stand zu gefährden:
 *  - übernimmt echte Daten,
 *  - übernimmt KEINEN transienten Leer-Read (Datei im atomicWrite-.tmp-Fenster),
 *  - ist no-op während eines eigenen Saves (kein Clobber des laufenden Writes).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const loadSpy = vi.fn();
vi.mock('../services/auslastung-store', () => ({
  loadAuslastungData: () => loadSpy(),
  saveAuslastungData: vi.fn(),
}));
const readableSpy = vi.fn();
vi.mock('@/core/services/infrastructure/smb-handle', () => ({
  isDatenShareReadable: () => readableSpy(),
}));

import { useAuslastungData } from '../hooks/useAuslastungData';
import { emptyAuslastungData, type AnonymerMitarbeiter } from '../types';

const fakeStorage = { idb: {} } as never;

function ma(anonId: string): AnonymerMitarbeiter {
  return {
    anonId, jahresKapazitaet: 800, abgemeldet: [], manuelleTechnologien: [],
    ausgeblendeteAutoTags: [], hauptKategorie: 'IT', nebenKategorien: [], abschlagProzent: 0,
    virtuelleProjekte: [], onboardingAbgeschlossen: true, aktiv: true,
  };
}

function setupData(mas: string[]) {
  return {
    ...emptyAuslastungData(),
    config: { ...emptyAuslastungData().config, setupAbgeschlossen: true },
    mitarbeiter: Object.fromEntries(mas.map(id => [id, ma(id)])),
  };
}

describe('reloadFromShare (Cross-Tab-Sync)', () => {
  beforeEach(() => {
    loadSpy.mockReset();
    readableSpy.mockReset();
    useAuslastungData.setState({
      data: setupData(['MA01']), loaded: true, loading: false, saving: false, persistDirty: false, error: null,
    });
  });

  it('übernimmt echte Daten vom Share', async () => {
    loadSpy.mockResolvedValue(setupData(['MA01', 'MA02']));
    readableSpy.mockResolvedValue(true);

    await useAuslastungData.getState().reloadFromShare(fakeStorage);

    expect(Object.keys(useAuslastungData.getState().data.mitarbeiter).sort()).toEqual(['MA01', 'MA02']);
  });

  it('übernimmt KEINEN transienten Leer-Read (behält den eigenen Stand)', async () => {
    loadSpy.mockResolvedValue(emptyAuslastungData()); // setupAbgeschlossen=false, 0 MAs
    readableSpy.mockResolvedValue(true);

    await useAuslastungData.getState().reloadFromShare(fakeStorage);

    expect(Object.keys(useAuslastungData.getState().data.mitarbeiter)).toEqual(['MA01']);
  });

  it('ist no-op während eines eigenen Saves', async () => {
    useAuslastungData.setState({ saving: true });
    await useAuslastungData.getState().reloadFromShare(fakeStorage);
    expect(loadSpy).not.toHaveBeenCalled();
    expect(Object.keys(useAuslastungData.getState().data.mitarbeiter)).toEqual(['MA01']);
  });
});
