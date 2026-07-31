import { describe, it, expect, afterEach } from 'vitest';
import { useKiZiel, aktivesZielFuerLauf, sollWechselHinweisZeigen } from '../ki-ziel';

// Store ist ein Modul-Singleton — nach jedem Test auf den Default zurücksetzen,
// damit kein Lauf in anderen (nicht isolierten) Testdateien 'agentisch' erbt.
afterEach(() => { useKiZiel.getState().setZiel('standard'); });

describe('useKiZiel / aktivesZielFuerLauf', () => {
  it('Default ist standard → aktivesZielFuerLauf gibt "standard"', () => {
    expect(useKiZiel.getState().ziel).toBe('standard');
    expect(aktivesZielFuerLauf()).toBe('standard');
  });

  it('agentisch aktiv → aktivesZielFuerLauf gibt "agentisch"', () => {
    useKiZiel.getState().setZiel('agentisch');
    expect(useKiZiel.getState().ziel).toBe('agentisch');
    expect(aktivesZielFuerLauf()).toBe('agentisch');
  });

  /**
   * Regression: „Standard" war ein stiller No-op. `aktivesZielFuerLauf` gab dafür
   * `undefined` zurück, der Transport liess das Feld weg und das Bookmarklet stieg
   * in `ensureZiel` sofort aus (`if (!ziel) { cb(null); return; }`) — es suchte also
   * gar keinen Tab. Da Streamlit die Tab-Auswahl hält, blieb jeder Lauf im zuletzt
   * benutzten (agentischen) Tab: aus dem Agentischen führte kein Weg zurück.
   * Nur ein EXPLIZITES 'standard' schaltet um.
   */
  it('Rueckweg aus dem Agentischen: nach dem Umschalten kommt ein explizites Ziel', () => {
    useKiZiel.getState().setZiel('agentisch');
    useKiZiel.getState().setZiel('standard');
    expect(aktivesZielFuerLauf()).toBe('standard');
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
