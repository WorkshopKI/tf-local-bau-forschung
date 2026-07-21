import { describe, it, expect, afterEach } from 'vitest';
import { useKiZiel, aktivesZielFuerLauf, sollWechselHinweisZeigen } from '../ki-ziel';

// Store ist ein Modul-Singleton — nach jedem Test auf den Default zurücksetzen,
// damit kein Lauf in anderen (nicht isolierten) Testdateien 'agentisch' erbt.
afterEach(() => { useKiZiel.getState().setZiel('standard'); });

describe('useKiZiel / aktivesZielFuerLauf', () => {
  it('Default ist standard → aktivesZielFuerLauf ist undefined (Verhalten byte-identisch)', () => {
    expect(useKiZiel.getState().ziel).toBe('standard');
    expect(aktivesZielFuerLauf()).toBeUndefined();
  });

  it('agentisch aktiv → aktivesZielFuerLauf gibt "agentisch"', () => {
    useKiZiel.getState().setZiel('agentisch');
    expect(useKiZiel.getState().ziel).toBe('agentisch');
    expect(aktivesZielFuerLauf()).toBe('agentisch');
  });
});

describe('sollWechselHinweisZeigen', () => {
  const basis = {
    bridgeAktiv: true,
    gespraechLaeuft: true,
    altesZiel: 'standard' as const,
    neuesZiel: 'agentisch' as const,
  };

  it('warnt beim echten Wechsel waehrend eines laufenden Gespraechs', () => {
    expect(sollWechselHinweisZeigen(basis)).toBe(true);
  });

  it('schweigt ohne Bridge — ohne sie gibt es keine Tabs, also nichts zu verlieren', () => {
    expect(sollWechselHinweisZeigen({ ...basis, bridgeAktiv: false })).toBe(false);
  });

  it('schweigt ohne laufendes Gespraech (der Normalfall: Umschalten vor der Arbeit)', () => {
    expect(sollWechselHinweisZeigen({ ...basis, gespraechLaeuft: false })).toBe(false);
  });

  it('schweigt, wenn derselbe Knopf nochmal gedrueckt wird', () => {
    expect(sollWechselHinweisZeigen({ ...basis, neuesZiel: 'standard' })).toBe(false);
  });

  it('warnt in beide Wechsel-Richtungen', () => {
    expect(sollWechselHinweisZeigen({
      ...basis, altesZiel: 'agentisch', neuesZiel: 'standard',
    })).toBe(true);
  });
});
