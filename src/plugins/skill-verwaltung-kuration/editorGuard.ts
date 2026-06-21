/**
 * Leave-Guard für die Skill-Verwaltung (Master-Detail mit drei Editoren: Skills,
 * Qualitätsregeln, Workflows). Jeder Editor meldet uniform seinen Zustand
 * `{ dirty, save }` an den Parent; der Parent leitet JEDE Verlassen-Aktion
 * (andere Zeile wählen, „+ Neu", Tab-Wechsel, Zurück/Escape) durch `guardLeave`.
 * Bei ungespeicherten Änderungen erscheint die „Speichern / Verwerfen / Abbrechen"-
 * Nachfrage; sonst wird sofort gewechselt.
 *
 * Warum so: Es ist immer höchstens ein Editor offen, also genügt EINE Ref auf den
 * aktiven `{ dirty, save }`. `save` persistiert den AKTUELLEN Entwurf (wirft bei
 * Fehler) und schließt/navigiert NICHT — die Navigation steuert der Parent nach
 * erfolgreichem Persist.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';

export interface EditorGuardState {
  /** Hat der Editor ungespeicherte Änderungen gegenüber seinem `initial`? */
  dirty: boolean;
  /** Persistiert den aktuellen Entwurf. Wirft bei Fehler. Schließt NICHT. */
  save: () => Promise<void>;
}

/**
 * Editor-Seite: meldet den eigenen `{ dirty, save }`-Zustand an den Parent.
 * `save` wird über eine Ref aktuell gehalten (die Closure wechselt jeden Render),
 * sodass der Effekt nur bei `dirty`-Wechsel neu meldet — und der Parent dennoch
 * immer den frischesten Entwurf persistiert. Cleanup meldet `null` (Editor weg).
 */
export function useReportGuardState(
  onChange: ((state: EditorGuardState | null) => void) | undefined,
  dirty: boolean,
  save: () => Promise<void>,
): void {
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    onChange?.({ dirty, save: () => saveRef.current() });
    return () => onChange?.(null);
  }, [dirty, onChange]);
}

export interface LeaveGuardDialogProps {
  open: boolean;
  busy: boolean;
  error: string | null;
  /** Persistieren, dann die ausstehende Aktion ausführen. */
  onSave: () => void;
  /** Änderungen verwerfen und die ausstehende Aktion ausführen. */
  onDiscard: () => void;
  /** Bei der aktuellen Bearbeitung bleiben. */
  onCancel: () => void;
}

export interface EditorLeaveGuard {
  /** An jeden Editor als `onGuardStateChange` durchreichen. */
  reportState: (state: EditorGuardState | null) => void;
  /** Jede Verlassen-Aktion hier durchführen: clean → sofort; dirty → Nachfrage. */
  guardLeave: (proceed: () => void) => void;
  dialog: LeaveGuardDialogProps;
}

/**
 * Parent-Seite: hält den Zustand des aktiven Editors + den Nachfrage-Dialog.
 */
export function useEditorLeaveGuard(): EditorLeaveGuard {
  const editStateRef = useRef<EditorGuardState | null>(null);
  const pendingRef = useRef<(() => void) | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const reportState = useCallback((state: EditorGuardState | null): void => {
    editStateRef.current = state;
  }, []);

  const runPending = useCallback((): void => {
    const proceed = pendingRef.current;
    pendingRef.current = null;
    proceed?.();
  }, []);

  const guardedSave = useAsyncAction(
    async () => { await editStateRef.current?.save(); },
    { onSuccess: () => { setConfirmOpen(false); runPending(); } },
  );

  const guardLeave = useCallback((proceed: () => void): void => {
    // Re-Entry verhindern (z.B. Escape, das Dialog UND Layout-Close auslöst).
    if (confirmOpen) return;
    if (editStateRef.current?.dirty) {
      pendingRef.current = proceed;
      setConfirmOpen(true);
    } else {
      proceed();
    }
  }, [confirmOpen]);

  const onDiscard = useCallback((): void => {
    setConfirmOpen(false);
    runPending();
  }, [runPending]);

  const onCancel = useCallback((): void => {
    setConfirmOpen(false);
    pendingRef.current = null;
  }, []);

  return {
    reportState,
    guardLeave,
    dialog: {
      open: confirmOpen,
      busy: guardedSave.busy,
      error: guardedSave.error,
      onSave: () => { void guardedSave.run(); },
      onDiscard,
      onCancel,
    },
  };
}
