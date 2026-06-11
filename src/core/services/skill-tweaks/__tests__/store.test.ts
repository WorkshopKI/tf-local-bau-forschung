import { describe, expect, it } from 'vitest';
import type { IDBStore } from '@/core/services/storage/idb-store';
import {
  getSkillTweakCached,
  loadSkillTweak,
  saveSkillTweak,
  deleteSkillTweak,
  isNewerTweak,
  shouldShowVersionHint,
  TWEAK_FELD_MAX,
  type SkillTweak,
} from '../index';

/** Map-backed Fake-IDB (Muster: src/plugins/chat/__tests__/store.test.ts). */
function makeIdb(): { idb: IDBStore; data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  const idb = {
    get: async <T,>(k: string): Promise<T | null> => (data.get(k) as T | undefined) ?? null,
    set: async (k: string, v: unknown): Promise<void> => { data.set(k, JSON.parse(JSON.stringify(v))); },
    delete: async (k: string): Promise<void> => { data.delete(k); },
  } as unknown as IDBStore;
  return { idb, data };
}

const SKILL_ID = 'gutachten-kurzfassung';

function makeTweak(over: Partial<SkillTweak> = {}): SkillTweak {
  return {
    skillId: SKILL_ID,
    angelegtFuerSkillVersion: 1,
    aktiv: true,
    stilHinweise: 'Sachlich formulieren.',
    beispielFormulierungen: 'Eine wesentliche Herausforderung …',
    geaendert_am: '2026-06-01T10:00:00.000Z',
    ...over,
  };
}

describe('skill-tweaks store (IDB round-trip)', () => {
  it('save → get → load → delete', async () => {
    const { idb } = makeIdb();
    const tweak = makeTweak();
    await saveSkillTweak(idb, null, tweak);

    expect(await getSkillTweakCached(idb, SKILL_ID)).toEqual(tweak);
    expect(await loadSkillTweak(idb, null, SKILL_ID)).toEqual(tweak);

    await deleteSkillTweak(idb, null, SKILL_ID);
    expect(await getSkillTweakCached(idb, SKILL_ID)).toBeNull();
  });

  it('klemmt überlange Freitextfelder beim Speichern auf TWEAK_FELD_MAX', async () => {
    const { idb } = makeIdb();
    await saveSkillTweak(idb, null, makeTweak({
      stilHinweise: 'x'.repeat(TWEAK_FELD_MAX + 500),
      beispielFormulierungen: 'y'.repeat(TWEAK_FELD_MAX + 500),
    }));
    const got = await getSkillTweakCached(idb, SKILL_ID);
    expect(got?.stilHinweise.length).toBe(TWEAK_FELD_MAX);
    expect(got?.beispielFormulierungen.length).toBe(TWEAK_FELD_MAX);
  });

  it('getSkillTweakCached liefert null für unbekannte skillId', async () => {
    const { idb } = makeIdb();
    expect(await getSkillTweakCached(idb, 'gibt-es-nicht')).toBeNull();
  });
});

describe('isNewerTweak (LWW)', () => {
  it('neuer Zeitstempel gewinnt', () => {
    expect(isNewerTweak('2026-06-02T00:00:00Z', '2026-06-01T00:00:00Z')).toBe(true);
    expect(isNewerTweak('2026-06-01T00:00:00Z', '2026-06-02T00:00:00Z')).toBe(false);
  });
  it('fehlende Werte', () => {
    expect(isNewerTweak(undefined, '2026-06-01T00:00:00Z')).toBe(false);
    expect(isNewerTweak('2026-06-01T00:00:00Z', undefined)).toBe(true);
    expect(isNewerTweak(null, null)).toBe(false);
  });
});

describe('shouldShowVersionHint', () => {
  it('kein Tweak → false', () => {
    expect(shouldShowVersionHint(null, 4)).toBe(false);
  });
  it('inaktiver Tweak → false', () => {
    expect(shouldShowVersionHint(makeTweak({ aktiv: false, angelegtFuerSkillVersion: 3 }), 4)).toBe(false);
  });
  it('gleiche/ältere Skill-Version → false', () => {
    expect(shouldShowVersionHint(makeTweak({ angelegtFuerSkillVersion: 4 }), 4)).toBe(false);
    expect(shouldShowVersionHint(makeTweak({ angelegtFuerSkillVersion: 5 }), 4)).toBe(false);
  });
  it('neuere Skill-Version, nicht weggeklickt → true', () => {
    expect(shouldShowVersionHint(makeTweak({ angelegtFuerSkillVersion: 3 }), 4)).toBe(true);
  });
  it('für diese Version weggeklickt → false', () => {
    expect(shouldShowVersionHint(makeTweak({ angelegtFuerSkillVersion: 3, hinweisAusgeblendetFuerVersion: 4 }), 4)).toBe(false);
  });
  it('für eine ANDERE Version weggeklickt → true', () => {
    expect(shouldShowVersionHint(makeTweak({ angelegtFuerSkillVersion: 3, hinweisAusgeblendetFuerVersion: 3 }), 4)).toBe(true);
  });
});
