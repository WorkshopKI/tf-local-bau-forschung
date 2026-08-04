/**
 * Hält das Hilfe-Fenster auf der Seite, auf der die App gerade steht.
 *
 * Gemountet wird das EINMAL im ShellLayout, nicht im `SeitenHilfeButton`: der
 * Knopf rendert `null`, wenn eine Seite kein Kontext-Doc hat
 * (`SeitenHilfeButton.tsx`) — von dort aus bliebe das Fenster auf genau diesen
 * Seiten stumm auf altem Inhalt stehen. Vom Shell aus lässt sich stattdessen
 * sagen, dass es für die Seite keine Kurzanleitung gibt.
 *
 * `meldeSeitenwechsel` öffnet nie ein Fenster (Bug-Klasse 8: eine sichtbare
 * Fenster-Aktion gehört an eine Nutzer-Geste, nicht an einen Mount-Pfad) — ohne
 * offenes Fenster ist der Effekt hier ein No-op. Das Theme zieht ein
 * MutationObserver in `hilfeFenster.ts` nach, dafür braucht es keinen Hook.
 */

import { useEffect } from 'react';
import { useNavigation } from '@/core/hooks/useNavigation';
import { meldeSeitenwechsel } from '@/components/help/hilfeFenster';

export function useHilfeFensterFolgt(): void {
  const { activeId, activeName } = useNavigation();
  useEffect(() => {
    meldeSeitenwechsel(activeId, activeName);
  }, [activeId, activeName]);
}
