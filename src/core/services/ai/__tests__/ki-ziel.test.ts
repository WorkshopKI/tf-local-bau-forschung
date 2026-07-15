import { describe, it, expect, afterEach } from 'vitest';
import { useKiZiel, aktivesZielFuerLauf } from '../ki-ziel';

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
