import { create, type StoreApi, type UseBoundStore } from 'zustand';

/**
 * Factory für „etwas hat sich extern geändert"-Tick-Stores (cold-start-store-
 * refresh-Pattern, siehe docs/architecture/recurring-bug-classes.md).
 *
 * Problem: Ein Hintergrund-Write in die IndexedDB (Share-Sync, Korpus-Download,
 * Ordner-Verknüpfung) ändert KEINE React-State-Referenz — In-Memory-Konsumenten,
 * die ihren Stand nur beim Mount lesen (`useState`/`useEffect`-Guard/Ref-Cache),
 * bleiben leer bis zu einem manuellen Browser-Reload.
 *
 * Lösung: ein winziger Zustand-Store mit monotoner `version`. Der Writer ruft
 * `bump()` (auch außerhalb von React), die Konsumenten lesen `useSignal(s =>
 * s.version)` als Effekt-Dep und re-lesen die IDB bei jeder Änderung.
 *
 * Regel: Nur EXTERNE Mutationen bumpen. Wer den Write selbst auslöst und das
 * Ergebnis direkt erhält (Mount-Load), bumpt NICHT — sonst Self-Trigger-Loop.
 *
 * Domain-spezifische Instanzen (mit dem konkreten „Warum") liegen bei ihrer
 * Domain, nicht hier — z.B. `csv-sources-signal.ts`, `corpus-signal.ts`.
 */
export interface SignalState {
  version: number;
  bump: () => void;
}

export interface SignalStore {
  /** Zustand-Hook — in React via Selector lesen: `useSignal(s => s.version)`. */
  useSignal: UseBoundStore<StoreApi<SignalState>>;
  /** Außerhalb von React (Services/Callbacks/Hooks) den Konsumenten-Reload anstoßen. */
  bump: () => void;
}

export function createSignalStore(): SignalStore {
  const useSignal = create<SignalState>((set) => ({
    version: 0,
    bump: () => set((s) => ({ version: s.version + 1 })),
  }));
  return { useSignal, bump: () => useSignal.getState().bump() };
}
