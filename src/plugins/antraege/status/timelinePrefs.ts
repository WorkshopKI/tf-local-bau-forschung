/**
 * Anzeige-Präferenzen der Verlaufs-Sichten — pro Gerät in IndexedDB (kv-Key),
 * NIE localStorage, NIE Share.
 */
import { useCallback, useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';

/**
 * Welche Verlaufs-Ansicht offen ist — die Chronik (senkrecht, Liste) oder das
 * Band (waagerecht, Bahn). Beide lesen dieselben Termine aus den Datumsspalten.
 *
 * Der Standard bleibt `chronik`: ein geänderter Default verwirft keine
 * gespeicherte Wahl, er überschreibt sie nur für die, die noch keine haben.
 *
 * **`zeitstrahl` ist mit v3.48 entfallen** — es war die Sicht auf das
 * gerätelokale Ereignis-Protokoll und blieb leer, solange diese Installation
 * noch keine Änderung mitgeschrieben hatte. Der NAME ist auf das Band übergegangen
 * (der Reiter heißt jetzt „Zeitstrahl"), der WERT nicht: `normalisiere` lässt
 * jede gespeicherte `zeitstrahl`-Wahl auf die Chronik zurückfallen, statt einen
 * Zustand ohne Render-Zweig zu hinterlassen.
 */
export type VerlaufAnsicht = 'chronik' | 'band';

/**
 * Wie die Chronik ordnet: nach **Schritt** (Matrix Kürzel × Träger) oder nach
 * **Datum** (chronologisch). Zwei Sichten auf dieselben Termine.
 *
 * Der Standard ist `datum` (bis v4.58 `schritt`). Die Chronik nach Datum ist die
 * Ansicht, die auch der Tabellen-Ausklapp zeigt — mit `schritt` als Standard
 * öffneten die beiden Wirte desselben Vorgangs zwei verschiedene Bilder. Der
 * Vergleich über die Teilvorhaben bleibt einen Klick entfernt.
 */
export type ChronikModus = 'schritt' | 'datum';

export interface TimelinePrefs {
  zeigeNebensaechlich: boolean;
  ansicht: VerlaufAnsicht;
  modus: ChronikModus;
  /**
   * Ob die Ordnung **bewusst** gewählt wurde — nur `setModus` setzt das Feld.
   *
   * Es steht hier, weil `mutiere` bei jeder Änderung das ganze Objekt schreibt:
   * ein Stand, in dem jemand nur die Ansicht umgeschaltet hat, trägt trotzdem
   * ein explizites `modus`. Ohne dieses Feld erreichte ein geänderter Default
   * niemanden, der die Sektion je benutzt hat (persistiert schlägt Default) —
   * und ein Key-Bump hätte `ansicht` und `zeigeNebensaechlich` mit
   * zurückgesetzt, die davon gar nicht betroffen sind.
   */
  modusGewaehlt: boolean;
}

const KEY = 'status-timeline-prefs';

export const DEFAULT_PREFS: TimelinePrefs = {
  zeigeNebensaechlich: false,
  ansicht: 'chronik',
  modus: 'datum',
  modusGewaehlt: false,
};

function normalisiere(roh: unknown): TimelinePrefs {
  const p = (roh ?? {}) as Partial<TimelinePrefs>;
  // Ein gespeichertes `modus` gilt nur, wenn es aus einem Klick auf den Schalter
  // stammt. Bestandsstände tragen `modusGewaehlt` nicht und starten deshalb
  // einmalig auf dem neuen Standard — danach gilt wieder die eigene Wahl.
  const gewaehlt = p.modusGewaehlt === true;
  return {
    zeigeNebensaechlich: p.zeigeNebensaechlich === true,
    ansicht: p.ansicht === 'band' ? 'band' : 'chronik',
    modus: gewaehlt && p.modus === 'schritt' ? 'schritt' : 'datum',
    modusGewaehlt: gewaehlt,
  };
}

export interface UseTimelinePrefs {
  prefs: TimelinePrefs;
  setNebensaechlich: (v: boolean) => void;
  setAnsicht: (a: VerlaufAnsicht) => void;
  setModus: (m: ChronikModus) => void;
}

export function useTimelinePrefs(): UseTimelinePrefs {
  const storage = useStorage();
  const idb = storage.idb;
  const [prefs, setPrefs] = useState<TimelinePrefs>(DEFAULT_PREFS);

  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      const gespeichert = await idb.get<TimelinePrefs>(KEY).catch(() => null);
      if (!abgebrochen && gespeichert) setPrefs(normalisiere(gespeichert));
    })();
    return () => { abgebrochen = true; };
  }, [idb]);

  const mutiere = useCallback((next: TimelinePrefs) => {
    setPrefs(next);
    void idb.set(KEY, next).catch(() => {});
  }, [idb]);

  return {
    prefs,
    setNebensaechlich: v => mutiere({ ...prefs, zeigeNebensaechlich: v }),
    setAnsicht: a => mutiere({ ...prefs, ansicht: a }),
    // Der Klick auf den Schalter ist die Wahl — erst er hebt sie über den
    // Standard, der beim nächsten Mal wieder greifen dürfte.
    setModus: m => mutiere({ ...prefs, modus: m, modusGewaehlt: true }),
  };
}
