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
 * [useBestandsAufgaben.ts](src/core/hooks/useBestandsAufgaben.ts) — mit **einem
 * Unterschied**: der Betrachtungsbereich steht NICHT im Schlüssel, weil der
 * Index bereichsfrei über den ganzen Bestand gebaut wird und damit über
 * Bereichswechsel hinweg gültig bleibt.
 */
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { useStorage } from '@/core/hooks/useStorage';
import { bestandGeneration } from '@/core/services/bestand-generation';
import { getAktiveVersion, ladeAktiveVersion, type MappingVersion } from '@/core/status';
import type { IDBStore } from '@/core/services/storage/idb-store';
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
 * Der **eine** laufende Aufbau, geteilt über alle Aufrufer — modul-lokal, nicht
 * je Hook-Instanz.
 *
 * Bis v4.122 verriegelte ein `useRef` je Instanz. Auf der Antragsseite hängt der
 * Hook aber an vier bis sechs Stellen gleichzeitig im Baum (über
 * `useFilteredAntraege` in Kopf, Hauptteil, Filterspalte, Schnellfilter — dort
 * zusätzlich direkt). Springt `stillstandTage` von `null` auf einen Wert, laufen
 * alle Effekte in derselben Commit-Phase: der Cache ist für alle noch leer, jeder
 * eigene Ref ist leer — also startete JEDE Instanz denselben Lauf über den ganzen
 * Bestand, und alle bis auf einen warfen ihr Ergebnis weg.
 *
 * Zweiter Defekt derselben Wurzel: das Cleanup eines abgebrochenen Laufs setzte
 * `abgebrochen`, und der übersprang dann das Schreiben in den Cache — genau das
 * Muster, das `StartupScreen` für sich schon als Fehler beschreibt. Das
 * Cache-Schreiben hängt deshalb **nicht** mehr am Abbruch der Instanz: das
 * Ergebnis ist global gültig, wer es angestoßen hat, ändert daran nichts.
 */
const LAEUFT = new Map<string, Promise<void>>();

async function gemeinsamerLauf(
  schluessel: string, idb: IDBStore, v: MappingVersion, heute: string,
): Promise<void> {
  const da = LAEUFT.get(schluessel);
  if (da) return da;
  const lauf = (async () => {
    const begonnen = performance.now();
    const { index, gelesen } = await baueAktivitaetsIndex(idb, v, heute);
    const ms = Math.round(performance.now() - begonnen);
    useAktivitaetsCache.getState().setzen(schluessel, index, gelesen, ms);
    tfPerfLog(
      `[stillstand] Aktivitäts-Index: ${index.size} von ${gelesen} Sätzen datiert, ${ms} ms`,
    );
  })();
  LAEUFT.set(schluessel, lauf);
  try {
    await lauf;
  } finally {
    LAEUFT.delete(schluessel);
  }
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

        setLaden(true);
        setFehler(null);
        // EIN Lauf für alle Aufrufer (siehe `LAEUFT`): wer dazukommt, hängt sich
        // an denselben Lauf, statt einen eigenen zu starten.
        await gemeinsamerLauf(schluessel, idb, v, heuteRef.current);
      } catch (err) {
        if (abgebrochen) return;
        console.error('[useAktivitaetsIndex]', err);
        // Benannt statt still: ohne Index steht die Liste unverändert, und ein
        // Filter, der sichtbar gesetzt ist und nichts tut, muss sagen warum.
        setFehler('Der Stillstand ließ sich nicht ermitteln — die Liste ist ungefiltert.');
      } finally {
        if (!abgebrochen) setLaden(false);
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
