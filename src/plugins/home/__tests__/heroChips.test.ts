import { describe, it, expect } from 'vitest';
import { heroChipSichtbarkeit, type HeroChipEingabe } from '../heroChips';

const eingabe = (teil: Partial<HeroChipEingabe> = {}): HeroChipEingabe => ({
  kritisch: 0,
  warnung: 0,
  qsCount: 0,
  ersteQsScopeId: undefined,
  ...teil,
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
