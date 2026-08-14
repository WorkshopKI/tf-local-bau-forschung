import { describe, it, expect } from 'vitest';
import { heroChipSichtbarkeit, type HeroChipEingabe } from '../heroChips';
import { HERO_CONFIG_DEFAULT, type HeroConfig } from '../widgets/types';

const eingabe = (teil: Partial<HeroChipEingabe> = {}): HeroChipEingabe => ({
  kritisch: 0,
  warnung: 0,
  qsCount: 0,
  ersteQsScopeId: undefined,
  hero: HERO_CONFIG_DEFAULT,
  ...teil,
});

const hero = (teil: Partial<HeroConfig['chips']>, alert = true): HeroConfig => ({
  sichtbar: { resume: true, alert },
  chips: { ...HERO_CONFIG_DEFAULT.chips, ...teil },
});

describe('heroChipSichtbarkeit', () => {
  it('zeigt jeden Chip mit Zähler > 0', () => {
    const s = heroChipSichtbarkeit(eingabe({ kritisch: 493, warnung: 292, qsCount: 3, ersteQsScopeId: 'VB-1' }));
    expect(s).toEqual({ kritisch: true, warnung: true, qs: true, karte: true });
  });

  it('blendet Chips mit Zähler 0 aus', () => {
    const s = heroChipSichtbarkeit(eingabe({ kritisch: 493 }));
    expect(s.kritisch).toBe(true);
    expect(s.warnung).toBe(false);
    expect(s.qs).toBe(false);
    expect(s.karte).toBe(true);
  });

  it('ohne jeden Chip entfällt die Karte', () => {
    expect(heroChipSichtbarkeit(eingabe()).karte).toBe(false);
  });
});

describe('Abwahl im `⋯` der Karte (v4.41) — zweiter Grund, gleiche Wirkung', () => {
  it('blendet eine abgewählte Kachel auch bei vollem Zähler aus', () => {
    const s = heroChipSichtbarkeit(eingabe({
      kritisch: 29, warnung: 11, qsCount: 17, ersteQsScopeId: 'VB-1',
      hero: hero({ qs: false }),
    }));
    expect(s.qs).toBe(false);
    expect(s.kritisch).toBe(true);
    expect(s.karte).toBe(true);
  });

  it('lässt die Karte entfallen, wenn jede Kachel abgewählt ist', () => {
    const s = heroChipSichtbarkeit(eingabe({
      kritisch: 29, warnung: 11, qsCount: 17, ersteQsScopeId: 'VB-1',
      hero: hero({ kritisch: false, warnung: false, qs: false }),
    }));
    expect(s.karte).toBe(false);
  });

  it('nimmt die ausgeblendete Karte auch mit Kacheln vom Bildschirm', () => {
    const s = heroChipSichtbarkeit(eingabe({
      kritisch: 29, ersteQsScopeId: undefined, hero: hero({}, false),
    }));
    expect(s.kritisch).toBe(true); // die Kachel selbst bleibt gewählt …
    expect(s.karte).toBe(false); // … die Karte steht trotzdem nicht da
  });
});

describe('Regression: „0 QS-Freigaben offen" war ein Klickziel ohne Ziel', () => {
  // Bis v2.371 rendert HomeHero alle drei Chips bedingungslos, und der
  // QS-Chip navigierte per `navigate('antraege')` in die UNGEFILTERTE Liste —
  // bei 0 also ein Versprechen, hinter dem nichts stand.
  it('qsCount 0 → kein QS-Chip', () => {
    expect(heroChipSichtbarkeit(eingabe({ qsCount: 0 })).qs).toBe(false);
  });

  it('Zeilen ohne Sprungziel ergeben keinen Chip (sonst Klick ins Nichts)', () => {
    expect(heroChipSichtbarkeit(eingabe({ qsCount: 2, ersteQsScopeId: undefined })).qs).toBe(false);
  });

  it('erst mit Ziel wird der Chip klickbar', () => {
    const s = heroChipSichtbarkeit(eingabe({ qsCount: 2, ersteQsScopeId: 'VB-42' }));
    expect(s.qs).toBe(true);
    expect(s.karte).toBe(true);
  });
});
