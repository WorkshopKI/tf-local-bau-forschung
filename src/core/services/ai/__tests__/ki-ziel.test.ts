import { describe, it, expect, afterEach } from 'vitest';
import { useKiZiel, aktivesZielFuerLauf } from '../ki-ziel';

// Store ist ein Modul-Singleton — nach jedem Test auf den Default zurücksetzen,
// damit kein Lauf in anderen (nicht isolierten) Testdateien 'stark' erbt.
afterEach(() => { useKiZiel.getState().setZiel('standard'); });

describe('useKiZiel / aktivesZielFuerLauf', () => {
  it('Default ist gpt-oss → aktivesZielFuerLauf gibt "standard"', () => {
    expect(useKiZiel.getState().ziel).toBe('standard');
    expect(aktivesZielFuerLauf()).toBe('standard');
  });

  it('Qwen3.6 aktiv → aktivesZielFuerLauf gibt "stark"', () => {
    useKiZiel.getState().setZiel('stark');
    expect(useKiZiel.getState().ziel).toBe('stark');
    expect(aktivesZielFuerLauf()).toBe('stark');
  });

  /**
   * Regression: „Standard" war ein stiller No-op. `aktivesZielFuerLauf` gab dafür
   * `undefined` zurück, der Transport liess das Feld weg und das Bookmarklet stieg
   * in `ensureZiel` sofort aus (`if (!ziel) { cb(null); return; }`) — es suchte also
   * gar keinen Tab. Da Streamlit die Tab-Auswahl hält, blieb jeder Lauf im zuletzt
   * benutzten (agentischen) Tab: aus dem Agentischen führte kein Weg zurück.
   * Nur ein EXPLIZITES 'standard' schaltet um.
   */
  it('Rueckweg aus dem grossen Modell: nach dem Umschalten kommt ein explizites Ziel', () => {
    useKiZiel.getState().setZiel('stark');
    useKiZiel.getState().setZiel('standard');
    expect(aktivesZielFuerLauf()).toBe('standard');
  });
});
