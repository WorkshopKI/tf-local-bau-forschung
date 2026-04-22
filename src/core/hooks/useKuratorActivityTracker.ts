/**
 * Activity-Tracker (Phase 1a, Modul C Ergänzung).
 *
 * Registriert document-level click/keydown-Listener mit 30s-Throttle. Ruft
 * extend() NUR wenn eine Kurator-Session aktiv ist — andernfalls no-op.
 * Montage in Shell.tsx.
 */

import { useEffect } from 'react';
import { useKuratorSession } from './useKuratorSession';

const THROTTLE_MS = 30_000;

export function useKuratorActivityTracker(): void {
  useEffect(() => {
    let last = 0;
    const handler = (): void => {
      const now = Date.now();
      if (now - last < THROTTLE_MS) return;
      last = now;
      const state = useKuratorSession.getState();
      if (state.isActive) state.extend();
    };
    document.addEventListener('click', handler);
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
    };
  }, []);
}
