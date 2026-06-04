/**
 * Cold-Start-Clobber-Schutz fuer den Auslastungs-Store.
 *
 * Regression gegen den 263-KB→7-KB-Datenverlust (Juni 2026): Ein transienter
 * Leer-Read von `auslastung.json` (z.B. die Datei liegt gerade im atomicWrite-
 * `.tmp`-Rename-Fenster eines parallel offenen Tabs) liefert `emptyAuslastungData()`,
 * `isDatenShareReadable` ist trotzdem true → `loaded=true` mit 0 MAs → der
 * Auto-Collect-Effekt merged die persoenlichen Profile auf die LEERE Basis und
 * persistiert → die volle Datei wird durch ein 2-MA-Skelett ueberschrieben.
 *
 * `applyAggregatedProfiles` muss daher auf einer un-eingerichteten (leeren) Basis
 * NIE schreiben — der MA-Bestand entsteht nur aus echtem Setup / Kuerzel-Map.
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
import { emptyAuslastungData, type PersoenlichesAuslastungProfil } from '../types';
import type { AnonymMap } from '../services/anonym-map';

const fakeStorage = {} as never;

function anonMap(pairs: Array<[string, string]>): AnonymMap {
  const toAnon = new Map<string, string>();
  const toReal = new Map<string, string>();
  for (const [kuerzel, anon] of pairs) { toAnon.set(kuerzel, anon); toReal.set(anon, kuerzel); }
  return { toAnon, toReal };
}

function makeProfil(kuerzel: string, hauptKategorie: string): PersoenlichesAuslastungProfil {
  return {
    version: 1,
    kuerzel,
    manuelleTechnologien: [],
    ausgeblendeteAutoTags: [],
    hauptKategorie,
    nebenKategorien: [],
    antragstypBevorzugt: [],
    updatedAt: '2026-06-04T00:00:00.000Z',
  };
}

describe('applyAggregatedProfiles — Cold-Start-Clobber-Schutz', () => {
  beforeEach(() => {
    saveSpy.mockClear();
  });

  it('schreibt NICHT auf eine un-eingerichtete (leere) Basis — auch wenn ein Kuerzel aufloesbar ist', async () => {
    // Leere Basis: setupAbgeschlossen=false, mitarbeiter={} — exakt der transiente Leer-Read.
    useAuslastungData.setState({ data: emptyAuslastungData(), saving: false, loaded: true });

    // 'MUE' IST in der Map → ohne Guard wuerde mergeProfilesIntoMitarbeiter einen
    // neuen MA materialisieren (neu=['MA01']) und applyAggregatedProfiles persistieren.
    const res = await useAuslastungData.getState().applyAggregatedProfiles(
      fakeStorage,
      [makeProfil('MUE', 'IT')],
      anonMap([['MUE', 'MA01']]),
    );

    expect(saveSpy).not.toHaveBeenCalled();
    expect(res.neu).toEqual([]);
    expect(res.aktualisiert).toEqual([]);
    expect(Object.keys(useAuslastungData.getState().data.mitarbeiter)).toEqual([]);
  });

  it('schreibt auf einer eingerichteten Basis normal (setupAbgeschlossen=true)', async () => {
    useAuslastungData.setState({
      data: {
        ...emptyAuslastungData(),
        config: { ...emptyAuslastungData().config, setupAbgeschlossen: true },
        mitarbeiter: {
          MA01: {
            anonId: 'MA01', jahresKapazitaet: 800, abgemeldet: [], manuelleTechnologien: [],
            ausgeblendeteAutoTags: [], hauptKategorie: 'IT', nebenKategorien: [], abschlagProzent: 0,
            virtuelleProjekte: [], onboardingAbgeschlossen: true, aktiv: true,
          },
        },
      },
      saving: false,
      loaded: true,
    });

    const res = await useAuslastungData.getState().applyAggregatedProfiles(
      fakeStorage,
      [makeProfil('MUE', 'DT')],
      anonMap([['MUE', 'MA01']]),
    );

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(res.aktualisiert).toEqual(['MA01']);
    expect(useAuslastungData.getState().data.mitarbeiter.MA01!.hauptKategorie).toBe('DT');
  });
});
