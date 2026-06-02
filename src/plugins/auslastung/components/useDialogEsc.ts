/**
 * Registriert einen ESC-Handler, der bei aktivem Dialog/Drawer dessen
 * `onClose`-Callback aufruft — sofern nicht gerade `busy` (z.B. Save laeuft).
 *
 * Pro `enabled`-Wechsel auf true wird der Listener aufgehaengt, beim
 * Unmount oder enabled=false abgehaengt. Pattern fuer alle Editor-Dialogs
 * im Auslastungs-Plugin (KategorieDrawer, MitarbeiterDrawer,
 * OnboardingImportDialog, PasswortDialog, KalibrierungsReport).
 */
import { useEffect } from 'react';

export function useDialogEsc(enabled: boolean, busy: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled, busy, onClose]);
}
