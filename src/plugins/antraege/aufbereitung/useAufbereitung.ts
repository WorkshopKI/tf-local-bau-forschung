/**
 * State-/IO-Schicht der Aufbereitungs-Seite: lädt den Run, bietet „Neu
 * aufbereiten" (via `useAsyncAction` → Fehlerbanner) und den Offene-Punkte-
 * Toggle, und prüft best-effort auf veraltete Quellen (nur Hinweis, keine
 * Auto-Neuberechnung).
 */
import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { hashText } from '@/plugins/antraege/gutachten/runner';
import { resolveVb, resolveAnlage5 } from './quellen';
import {
  aufbereitungKey, computeAufbereitung, loadAufbereitung, istVeraltet, toggleOffenerPunkt,
  type AufbereitungContext,
} from './store';
import type { AufbereitungRun } from './types';

export interface UseAufbereitungResult {
  run: AufbereitungRun | null;
  loading: boolean;
  veraltet: boolean;
  neu: UseAsyncActionResult<[]>;
  toggle: UseAsyncActionResult<[string]>;
}

export function useAufbereitung(ctx: AufbereitungContext | null): UseAufbereitungResult {
  const storage = useStorage();
  const [run, setRun] = useState<AufbereitungRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [veraltet, setVeraltet] = useState(false);
  const key = ctx?.key ?? null;

  // Gespeicherten Run laden (bei Kontext-Wechsel neu).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      if (!key) { setRun(null); setLoading(false); return; }
      const r = await loadAufbereitung(storage.idb, key);
      if (!cancelled) { setRun(r); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [key, storage.idb]);

  // Best-effort Veraltet-Prüfung: aktuelle Quell-Hashes gegen die gestempelten.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ctx || !run) { setVeraltet(false); return; }
      try {
        const vbA = await resolveVb(storage.idb, ctx);
        const anlageA = await resolveAnlage5(storage.idb, ctx).catch(() => null);
        const aktuell = {
          vbHash: vbA ? hashText(vbA.markdown) : undefined,
          anlage5Hash: anlageA ? hashText(anlageA.markdown) : undefined,
        };
        if (!cancelled) setVeraltet(istVeraltet(run, aktuell));
      } catch { /* Veraltet-Hinweis ist optional — Fehler still schlucken. */ }
    })();
    return () => { cancelled = true; };
  }, [ctx, run, storage.idb]);

  const neu = useAsyncAction(async () => {
    if (!ctx) return;
    const r = await computeAufbereitung(storage.idb, ctx);
    setRun(r);
    setVeraltet(false);
  });

  const toggle = useAsyncAction(async (befund: string) => {
    if (!run) return;
    const next = toggleOffenerPunkt(run, befund);
    setRun(next);
    await storage.idb.set(aufbereitungKey(next.antragKey), next);
  });

  return { run, loading, veraltet, neu, toggle };
}
