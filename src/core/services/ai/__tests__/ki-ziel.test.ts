import { describe, it, expect, afterEach } from 'vitest';
import { useKiZiel, aktivesZielFuerLauf } from '../ki-ziel';

// Store ist ein Modul-Singleton — nach jedem Test auf den Default zurücksetzen,
// damit kein Lauf in anderen (nicht isolierten) Testdateien 'qwen35' erbt.
afterEach(() => { useKiZiel.getState().setZiel('gpt-oss'); });

describe('useKiZiel / aktivesZielFuerLauf', () => {
  it('Default ist gpt-oss → aktivesZielFuerLauf gibt "gpt-oss"', () => {
    expect(useKiZiel.getState().ziel).toBe('gpt-oss');
    expect(aktivesZielFuerLauf()).toBe('gpt-oss');
  });

  it('Qwen3.6 aktiv → aktivesZielFuerLauf gibt "qwen35"', () => {
    useKiZiel.getState().setZiel('qwen35');
    expect(useKiZiel.getState().ziel).toBe('qwen35');
    expect(aktivesZielFuerLauf()).toBe('qwen35');
  });

  /**
   * Regression: „Standard" war ein stiller No-op. `aktivesZielFuerLauf` gab dafür
   * `undefined` zurück, der Transport liess das Feld weg und das Bookmarklet stieg
   * in `ensureZiel` sofort aus (`if (!ziel) { cb(null); return; }`) — es suchte also
   * gar keinen Tab. Da Streamlit die Tab-Auswahl hält, blieb jeder Lauf im zuletzt
   * benutzten (agentischen) Tab: aus dem Agentischen führte kein Weg zurück.
   * Nur ein EXPLIZITES 'gpt-oss' schaltet um.
   */
  it('Rueckweg aus dem grossen Modell: nach dem Umschalten kommt ein explizites Ziel', () => {
    useKiZiel.getState().setZiel('qwen35');
    useKiZiel.getState().setZiel('gpt-oss');
    expect(aktivesZielFuerLauf()).toBe('gpt-oss');
  });
});
