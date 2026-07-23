/**
 * useKopierAktion — der Zustand eines Kopier-Knopfes an EINER Stelle.
 *
 * Neun Kopier-Knöpfe bauten denselben Dreiklang von Hand nach: `useAsyncAction`
 * um `kopiereText`, ein `kopiert`-Flag und ein 1500-ms-`setTimeout`, das es
 * zurücksetzt. Jede dieser Kopien entschied für sich, ob und wie ein Fehlschlag
 * sichtbar wird — mal als Wort „Fehler" ohne Grund, mal nur im `title`, mal gar
 * nicht. Genau das ist die Falle aus v2.301.3: wer nicht merkt, dass das
 * Kopieren scheiterte, fügt den ALTEN Inhalt der Zwischenablage ein.
 *
 * Der Hook liefert deshalb `titel` fertig ausformuliert — im Fehlerfall mit
 * Grund. Die Knöpfe bringen weiter ihr eigenes Markup mit (Icon-only, Icon +
 * Beschriftung, ganze Zeile); geteilt wird der Zustand, nicht das Aussehen.
 *
 *     const kopieren = useKopierAktion(titel.join('\n'), 'Alle Titel kopieren');
 *     <button onClick={() => kopieren.run()} title={kopieren.titel}>
 *       {kopieren.fehler ? <AlertTriangle/> : kopieren.kopiert ? <Check/> : <Copy/>}
 *     </button>
 *
 * Für Kopier-Vorgänge mit weiterer Arbeit (speichern, öffnen, Vorprüfung) bleibt
 * `useAsyncAction` + `kopiereText` der richtige Weg — dieser Hook deckt bewusst
 * nur den Fall „diesen Text kopieren" ab. Reihenfolge bei „kopieren und öffnen"
 * siehe `core/utils/kopieren.ts`.
 */
import { useEffect, useRef, useState } from 'react';
import { useAsyncAction } from './useAsyncAction';
import { kopiereText } from '@/core/utils/kopieren';

/** Wie lange die Erfolgs-Rückmeldung (Häkchen) stehen bleibt. */
export const KOPIERT_ANZEIGE_MS = 1500;

export interface KopierAktion {
  /** Kopiervorgang starten. Doppelklick-geschützt (via useAsyncAction). */
  run: () => Promise<void>;
  /** true, solange kopiert wird. */
  busy: boolean;
  /** true für KOPIERT_ANZEIGE_MS nach erfolgreichem Kopieren. */
  kopiert: boolean;
  /** Grund des letzten Fehlschlags, sonst null. */
  fehler: string | null;
  /** Fertiger `title`: im Fehlerfall der Grund, sonst der übergebene Text. */
  titel: string | undefined;
}

export function useKopierAktion(
  /** Der zu kopierende Text. Funktion, wenn er erst beim Klick feststeht. */
  text: string | (() => string),
  /** `title` des Knopfes im Normalfall. */
  titel?: string,
): KopierAktion {
  const [kopiert, setKopiert] = useState(false);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // Setzt `mounted` auch beim Setup (nicht nur im Cleanup) — sonst bliebe der
  // Hook nach dem StrictMode-Doppeleffekt in dev dauerhaft stumm. Muster
  // gespiegelt von useAsyncAction.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const aktion = useAsyncAction(async () => {
    await kopiereText(typeof text === 'function' ? text() : text);
    if (!mountedRef.current) return;
    setKopiert(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (mountedRef.current) setKopiert(false);
    }, KOPIERT_ANZEIGE_MS);
  });

  return {
    run: aktion.run,
    busy: aktion.busy,
    kopiert: kopiert && !aktion.error,
    fehler: aktion.error,
    titel: aktion.error ? `Kopieren fehlgeschlagen: ${aktion.error}` : titel,
  };
}
