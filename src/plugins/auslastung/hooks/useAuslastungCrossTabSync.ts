/**
 * useAuslastungCrossTabSync (v2.25) — hält zwei parallele pl-Tabs konsistent.
 *
 * Hintergrund: Zwei pl-Tabs teilen sich unter `file://` EINE IndexedDB + EINEN
 * Datei-Handle, aber jeder Tab hält seine eigene In-Memory-Kopie (der `loaded`-
 * Guard liest fremde Writes nicht nach). Ohne Sync überschreibt der später
 * speichernde Tab mit seiner veralteten Kopie still die Änderungen des anderen
 * (Lost Update). Dieser Hook lauscht auf den localStorage-Schreib-Ping
 * ([cross-tab.ts](../services/cross-tab.ts)) und lädt bei einem fremden Write
 * frisch vom Share nach — `reloadFromShare` ist no-op während eigener Writes und
 * übernimmt keinen transienten Leer-Read.
 */
import { useEffect } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAuslastungData } from './useAuslastungData';
import { onAuslastungWrite } from '../services/cross-tab';

export function useAuslastungCrossTabSync(): void {
  const storage = useStorage();
  useEffect(() => {
    return onAuslastungWrite(() => {
      void useAuslastungData.getState().reloadFromShare(storage);
    });
  }, [storage]);
}
