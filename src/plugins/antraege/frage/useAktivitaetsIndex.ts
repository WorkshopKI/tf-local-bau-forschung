/**
 * Den Aktivitäts-Index **träge** bauen und über den Seitenwechsel hinweg halten.
 *
 * Er kostet einen Lauf über den ganzen Bestand
 * ([letzteAktivitaet.ts](./letzteAktivitaet.ts)) und wird deshalb erst gebaut,
 * wenn ihn wirklich jemand braucht — also sobald eine Stillstands-Schwelle
 * gesetzt ist. Wer die Achse nie anfasst, zahlt nichts.
 *
 * **Ein Cache muss sagen, dass er einer ist.** Die Zeile am Filter nennt das
 * Alter; stille Momentaufnahmen sind genau die Art Unehrlichkeit, gegen die der
 * Wächter argumentiert. Mechanik und Schlüssel nach dem Vorbild von
 * [boardCache.ts](src/plugins/vorgangs-board/boardCache.ts) — mit **einem
 * Unterschied**: der Betrachtungsbereich steht NICHT im Schlüssel, weil der
 * Index bereichsfrei über den ganzen Bestand gebaut wird und damit über
 * Bereichswechsel hinweg gültig bleibt.
 */
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { useStorage } from '@/core/hooks/useStorage';
import { bestandGeneration } from '@/core/services/bestand-generation';
import { getAktiveVersion, ladeAktiveVersion } from '@/core/status';
import { tfPerfLog } from '@/core/utils/tfPerf';
import { useAntraegeStore } from '../store';
import { baueAktivitaetsIndex, type AktivitaetsIndex } from './letzteAktivitaet';

/** Wie lange ein Index ohne neues Signal gilt — fünf Minuten wie das Board. */
export const AKTIVITAET_CACHE_TTL_MS = 5 * 60 * 1000;

interface AktivitaetsCacheState {
  schluessel: string | null;
  index: AktivitaetsIndex | null;
  berechnetAm: number;
  /** `0` = nicht scharf. Siehe `setzen`. */
  standAt: number;
  ladeMs: number;
  /**
   * @param gelesen Sätze, die aus IDB **kamen** — nicht die Zahl der Einträge.
   *   Null Einträge hat zwei sehr verschiedene Ursachen: eine noch leere IDB
   *   (Cold Start, darf nicht festgeschrieben werden) und ein Bestand ohne ein
   *   einziges datiertes Kürzel (eine echte, stabile Antwort). Nur die gelesene
   *   Zahl unterscheidet sie.
   */
  setzen: (schluessel: string, index: AktivitaetsIndex, gelesen: number, ladeMs: number) => void;
  entwerten: () => void;
}

export const useAktivitaetsCache = create<AktivitaetsCacheState>(set => ({
  schluessel: null,
  index: null,
  berechnetAm: 0,
  standAt: 0,
  ladeMs: 0,
  setzen: (schluessel, index, gelesen, ladeMs) => set({
    schluessel,
    index,
    berechnetAm: Date.now(),
    standAt: gelesen > 0 ? Date.now() : 0,
    ladeMs,
  }),
  entwerten: () => set({ schluessel: null, index: null, standAt: 0, berechnetAm: 0 }),
}));

/** Gilt der Eintrag noch? Rein — `jetzt` kommt von außen. */
export function indexGilt(
  state: Pick<AktivitaetsCacheState, 'schluessel' | 'index' | 'standAt'>,
  schluessel: string,
  jetzt: number,
): boolean {
  return state.index !== null
    && state.schluessel === schluessel
    && state.standAt > 0
    && jetzt - state.standAt < AKTIVITAET_CACHE_TTL_MS;
}

export interface AktivitaetsIndexErgebnis {
  /** `null` = noch nicht gerechnet. Der Filter lässt die Liste dann stehen. */
  index: AktivitaetsIndex | null;
  laden: boolean;
  /** Klartext, warum es keinen Index gibt. `null` = alles in Ordnung. */
  fehler: string | null;
  /** Wie alt der Index ist, in Sekunden. `null`, solange keiner steht. */
  alterSekunden: number | null;
}

/**
 * Liefert den Index, sobald `stillstandTage` gesetzt ist — vorher `null`, ohne
 * je etwas gerechnet zu haben.
 *
 * `stichtag` als ISO-Tag von außen wäre schöner, ist hier aber ein Hook an der
 * Uhr: der Tageswechsel verschiebt jede Liegezeit, und ein über Mitternacht
 * offener Tab zeigte sonst die Zahlen von gestern. Er wird deshalb **einmal je
 * Mount** genommen und steckt im Schlüssel.
 */
export function useAktivitaetsIndex(): AktivitaetsIndexErgebnis {
  const idb = useStorage().idb;
  const stillstandTage = useAntraegeStore(s => s.stillstandTage);
  const [laden, setLaden] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const heuteRef = useRef<string>(new Date().toISOString());
  const cache = useAktivitaetsCache();
  // Gegen den doppelten Lauf im StrictMode UND gegen den zweiten Lauf, den ein
  // Re-Render während des ersten auslösen würde.
  const laeuftRef = useRef<string | null>(null);

  const gebraucht = stillstandTage !== null;

  useEffect(() => {
    if (!gebraucht || !idb) return;
    let abgebrochen = false;

    void (async () => {
      try {
        const v = getAktiveVersion() ?? await ladeAktiveVersion(idb);
        const schluessel = [
          v.version,
          v.zeitstempel ?? '',
          bestandGeneration(),
          heuteRef.current.slice(0, 10),
        ].join('|');

        if (indexGilt(useAktivitaetsCache.getState(), schluessel, Date.now())) return;
        if (laeuftRef.current === schluessel) return;
        laeuftRef.current = schluessel;

        setLaden(true);
        setFehler(null);
        const begonnen = performance.now();
        const { index, gelesen } = await baueAktivitaetsIndex(idb, v, heuteRef.current);
        const ms = Math.round(performance.now() - begonnen);
        if (abgebrochen) return;
        useAktivitaetsCache.getState().setzen(schluessel, index, gelesen, ms);
        tfPerfLog(
          `[stillstand] Aktivitäts-Index: ${index.size} von ${gelesen} Sätzen datiert, ${ms} ms`,
        );
      } catch (err) {
        if (abgebrochen) return;
        console.error('[useAktivitaetsIndex]', err);
        // Benannt statt still: ohne Index steht die Liste unverändert, und ein
        // Filter, der sichtbar gesetzt ist und nichts tut, muss sagen warum.
        setFehler('Der Stillstand ließ sich nicht ermitteln — die Liste ist ungefiltert.');
      } finally {
        if (!abgebrochen) setLaden(false);
        laeuftRef.current = null;
      }
    })();

    return () => { abgebrochen = true; };
  }, [gebraucht, idb]);

  return {
    index: gebraucht ? cache.index : null,
    laden,
    fehler,
    alterSekunden: cache.berechnetAm > 0
      ? Math.round((Date.now() - cache.berechnetAm) / 1000)
      : null,
  };
}
