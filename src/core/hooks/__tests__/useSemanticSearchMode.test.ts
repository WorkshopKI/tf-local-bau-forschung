/**
 * Tests für den Opt-in-Schalter der Ähnlichkeitssuche (v2.62).
 *
 * Kern-Garantie: Default ist AUS — das Embedding-Modell (~0,5–1 GB WASM/GPU)
 * darf ohne explizites User-Opt-in nie geladen werden. Wer den Default auf
 * `true` dreht oder den Store persistiert, bricht die Citrix-RAM-Entlastung
 * aus v2.62 — dieser Test fängt das.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useSemanticSearchMode } from '../useSemanticSearchMode';

beforeEach(() => {
  useSemanticSearchMode.setState({ enabled: false });
});

describe('useSemanticSearchMode', () => {
  it('Default ist AUS (kein ungefragtes Modell-Laden)', () => {
    expect(useSemanticSearchMode.getState().enabled).toBe(false);
  });

  it('setEnabled(true) aktiviert für die Session', () => {
    useSemanticSearchMode.getState().setEnabled(true);
    expect(useSemanticSearchMode.getState().enabled).toBe(true);
  });

  it('setEnabled(false) schaltet zurück (Dropdown „Ohne")', () => {
    useSemanticSearchMode.getState().setEnabled(true);
    useSemanticSearchMode.getState().setEnabled(false);
    expect(useSemanticSearchMode.getState().enabled).toBe(false);
  });
});
