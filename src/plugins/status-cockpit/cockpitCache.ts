/**
 * Der durchgerechnete Bestand der Vorgangs-Regeln-Seite, **über den
 * Seitenwechsel hinweg**.
 *
 * Schwester von `plugins/vorgangs-board/boardCache.ts`; die Begründung steht
 * dort. Zwei Unterschiede, die aus der Sache folgen:
 *
 * 1. Gecacht wird **nur der Bestand** (`ladeBestand`) — nicht die Fassung, nicht
 *    die Fassungsliste, nicht die Trigger. Die Fassung ist auf dieser Seite das
 *    Arbeitsstück: sie wird bearbeitet, gespeichert, verworfen und getauscht.
 *    Sie zu cachen hiesse, den Editor mit einem Stand zu füllen, den jemand
 *    anderes inzwischen überschrieben hat.
 * 2. Der Schlüssel trägt **keine** Fassungsnummer. Der Bestand ist der Bestand;
 *    er hängt an den Daten, nicht am Katalog. Was ihn ändert, ist ein Import —
 *    und der bumpt die Bestands-Generation.
 *
 * Wichtig zur Fassungs-Abhängigkeit: `verbundFelder` wird MIT der Fassung
 * gebaut (`baueVerbundFelder(version, …)`). Die Fassung geht deshalb doch in den
 * Schlüssel ein — aber als Identität des benutzten Objekts, nicht als Nummer;
 * der Aufrufer legt sie dazu.
 */
import { create } from 'zustand';
import type { Bestand } from './useStatusCockpit';

/** Wie im Board — eigene Konstante, kein Import über die Plugin-Grenze. */
export const COCKPIT_CACHE_TTL_MS = 5 * 60 * 1000;

interface CockpitCacheState {
  schluessel: string | null;
  bestand: Bestand | null;
  berechnetAm: number;
  /** `0` = nicht scharf. */
  standAt: number;
  /** @param gelesen Verbünde, die der Lauf gesehen hat — `0` heisst Cold Start. */
  setzen: (schluessel: string, bestand: Bestand, gelesen: number) => void;
  entwerten: () => void;
}

export const useCockpitCache = create<CockpitCacheState>(set => ({
  schluessel: null,
  bestand: null,
  berechnetAm: 0,
  standAt: 0,
  setzen: (schluessel, bestand, gelesen) => set({
    schluessel,
    bestand,
    berechnetAm: Date.now(),
    // Ein leerer Erst-Lauf (IDB noch nicht befüllt) darf den nächsten Aufruf
    // NICHT blockieren — sonst bleibt die Seite bis zum Reload leer.
    standAt: gelesen > 0 ? Date.now() : 0,
  }),
  entwerten: () => set({ schluessel: null, bestand: null, standAt: 0, berechnetAm: 0 }),
}));

/** Gilt der Eintrag noch? Rein — `jetzt` kommt von aussen. */
export function cockpitCacheGilt(
  state: Pick<CockpitCacheState, 'schluessel' | 'bestand' | 'standAt'>,
  schluessel: string,
  jetzt: number,
): boolean {
  return state.bestand !== null
    && state.schluessel === schluessel
    && state.standAt > 0
    && jetzt - state.standAt < COCKPIT_CACHE_TTL_MS;
}
