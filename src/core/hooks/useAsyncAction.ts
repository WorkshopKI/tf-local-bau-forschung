/**
 * useAsyncAction — wrappt asynchrone UI-Handler mit busy/error-State und
 * Doppelklick-Schutz. Loest CLAUDE.md Pitfall #15 strukturell: das
 * Anti-Pattern `onClick={() => void asyncFn()}` schluckt Promise-Rejections
 * silent, weil try/finally ohne catch keinen Error sichtbar macht.
 *
 * Pro-Pattern (Cheatsheet: docs/agents/async-error-pattern.md):
 *
 *     const save = useAsyncAction(async () => {
 *       await saveSettings(data);
 *       closeDialog();
 *     });
 *
 *     <Button onClick={() => save.run()} disabled={save.busy}>
 *       {save.busy ? 'Speichern…' : 'Speichern'}
 *     </Button>
 *     {save.error && <div className="...">Fehler: {save.error}</div>}
 *
 * Verhalten:
 *  - busy: true waehrend fn laeuft. Doppelklick-Schutz: zweiter run() wird
 *    ignoriert solange busy.
 *  - error: string | null. Bei Rejection wird die Fehler-Message (max 500
 *    chars) eingetragen. Bei Erfolg auf null gesetzt.
 *  - clearError(): manueller Dismiss fuer Error-Banner.
 *  - opts.onSuccess: nach erfolgreichem Lauf (z.B. Toast, Navigation).
 *  - opts.onError: zusaetzlich zum error-State (z.B. fuer Logging). Wird
 *    auch dann aufgerufen wenn der Caller den error-State ignoriert.
 *
 * Unmount-Sicherheit: wenn die Komponente waehrend laufendem fn unmounted,
 * werden State-Updates uebersprungen (kein "setState on unmounted" Warning).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAsyncActionResult<TArgs extends unknown[]> {
  run: (...args: TArgs) => Promise<void>;
  busy: boolean;
  error: string | null;
  clearError: () => void;
}

export interface UseAsyncActionOptions {
  onSuccess?: () => void;
  onError?: (err: unknown) => void;
}

function errorToMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return String(err);
  } catch {
    return 'Unbekannter Fehler';
  }
}

export function useAsyncAction<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<void>,
  opts: UseAsyncActionOptions = {},
): UseAsyncActionResult<TArgs> {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const busyRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearError = useCallback(() => {
    if (mountedRef.current) setError(null);
  }, []);

  const run = useCallback(
    async (...args: TArgs) => {
      if (busyRef.current) return;
      busyRef.current = true;
      if (mountedRef.current) {
        setBusy(true);
        setError(null);
      }
      try {
        await fn(...args);
        if (mountedRef.current) opts.onSuccess?.();
      } catch (err) {
        const msg = errorToMessage(err).slice(0, 500);
        if (mountedRef.current) setError(msg);
        opts.onError?.(err);
      } finally {
        busyRef.current = false;
        if (mountedRef.current) setBusy(false);
      }
    },
    [fn, opts],
  );

  return { run, busy, error, clearError };
}
