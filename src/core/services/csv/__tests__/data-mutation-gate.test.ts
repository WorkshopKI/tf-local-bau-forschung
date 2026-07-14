import { describe, it, expect, beforeEach } from 'vitest';
import {
  acquireDataMutation,
  releaseDataMutation,
  isDataMutationBusy,
} from '../data-mutation-gate';

describe('data-mutation-gate', () => {
  // Sauberer Ausgangszustand zwischen Tests (Modul-Singleton-Store).
  beforeEach(() => {
    releaseDataMutation();
  });

  it('erster acquire gewinnt, ein überlappender zweiter wird abgewiesen', () => {
    expect(isDataMutationBusy()).toBe(false);
    expect(acquireDataMutation()).toBe(true);
    expect(isDataMutationBusy()).toBe(true);
    // Genau die Rennbedingung aus dem Bug: der zweite, parallele Flow bekommt
    // das Gate NICHT und wird zum No-op — kein paralleles clear()/put().
    expect(acquireDataMutation()).toBe(false);
    expect(acquireDataMutation()).toBe(false);
  });

  it('nach release ist das Gate wieder frei', () => {
    expect(acquireDataMutation()).toBe(true);
    releaseDataMutation();
    expect(isDataMutationBusy()).toBe(false);
    expect(acquireDataMutation()).toBe(true);
  });

  it('release ist idempotent', () => {
    acquireDataMutation();
    releaseDataMutation();
    releaseDataMutation();
    expect(isDataMutationBusy()).toBe(false);
  });
});
