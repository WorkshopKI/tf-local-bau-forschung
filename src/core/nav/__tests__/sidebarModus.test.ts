import { describe, it, expect } from 'vitest';
import {
  effektiverModus,
  umgeschalteteWahl,
  zuPersistierenderModus,
  type SidebarZustand,
} from '../sidebarModus';

const zustand = (teil: Partial<SidebarZustand> = {}): SidebarZustand => ({
  nutzerWahl: 'expanded',
  schmalesFenster: false,
  schubladeOffen: false,
  ...teil,
});

describe('effektiverModus', () => {
  it('breites Fenster zeigt die Nutzerwahl', () => {
    expect(effektiverModus(zustand({ nutzerWahl: 'expanded' }))).toBe('expanded');
    expect(effektiverModus(zustand({ nutzerWahl: 'rail' }))).toBe('rail');
  });

  it('schmales Fenster zeigt die Schiene, egal was gewählt war', () => {
    expect(effektiverModus(zustand({ nutzerWahl: 'expanded', schmalesFenster: true }))).toBe('rail');
  });

  it('aufgezogene Schublade schlägt das schmale Fenster', () => {
    const auf = zustand({ nutzerWahl: 'rail', schmalesFenster: true, schubladeOffen: true });
    expect(effektiverModus(auf)).toBe('expanded');
  });

  it('die Schublade wirkt nur im schmalen Fenster', () => {
    expect(effektiverModus(zustand({ nutzerWahl: 'rail', schubladeOffen: true }))).toBe('rail');
  });
});

describe('umgeschalteteWahl', () => {
  it('kippt zwischen den beiden Modi', () => {
    expect(umgeschalteteWahl('expanded')).toBe('rail');
    expect(umgeschalteteWahl('rail')).toBe('expanded');
  });
});

describe('Regression: ein schmales Fenster rastet die Schiene nicht dauerhaft ein', () => {
  // Der Bug bis v2.371: der Mobil-Zweig schrieb in DENSELBEN State, der nach
  // localStorage ging. Wer einmal schmal andockte, hatte auf jedem Bildschirm
  // dauerhaft 20 unbeschriftete Icons — ohne erkennbaren Grund.
  it('schmal werden ändert den zu persistierenden Wert nicht', () => {
    const breit = zustand({ nutzerWahl: 'expanded' });
    const schmal = { ...breit, schmalesFenster: true };
    expect(effektiverModus(schmal)).toBe('rail');
    expect(zuPersistierenderModus(schmal)).toBe('expanded');
  });

  it('nach dem Verbreitern steht wieder die ursprüngliche Wahl da', () => {
    const wahl: SidebarZustand = { nutzerWahl: 'expanded', schmalesFenster: false, schubladeOffen: false };
    const schmal = { ...wahl, schmalesFenster: true };
    // Schublade auf und wieder zu — auch das darf nichts persistieren.
    const schmalOffen = { ...schmal, schubladeOffen: true };
    const wiederBreit = { ...schmalOffen, schmalesFenster: false, schubladeOffen: false };
    expect(effektiverModus(wiederBreit)).toBe('expanded');
    expect(zuPersistierenderModus(schmalOffen)).toBe('expanded');
    expect(zuPersistierenderModus(wiederBreit)).toBe('expanded');
  });

  it('eine bewusste Umschaltung im breiten Fenster wird sehr wohl übernommen', () => {
    const nach = zustand({ nutzerWahl: umgeschalteteWahl('expanded') });
    expect(zuPersistierenderModus(nach)).toBe('rail');
    expect(effektiverModus(nach)).toBe('rail');
  });
});
