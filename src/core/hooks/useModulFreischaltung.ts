/**
 * Freischaltung des Auslastungs-Moduls per Zusatzpasswort (v3.0).
 *
 * Aufbau 1:1 wie `useKuratorSession`: zustand-Store + IDB-Meta + 12h-TTL +
 * `rehydrate()` beim Start + `tick()` aus einem Intervall in der Shell. Der Timer
 * lebt bewusst NICHT im Store — Stores bleiben reaktiv & react-agnostisch.
 *
 * **Warum nur Auslastung?** Der Kurator-Slot benutzt weiterhin `useKuratorSession`.
 * Die ist bereits eine 12h-, IDB-persistierte, rehydrierende Session, und ~35
 * Aufrufstellen lesen ihr `isActive` fuer Schreib-Buttons. Ein zweiter Zeitgeber
 * fuers selbe Konzept liefe garantiert auseinander. Wer „ist das Modul frei?"
 * fragen will, fragt `istModulFrei()` in `@/core/modul-freischaltung` — die
 * routet je Slot an die richtige Quelle.
 *
 * Strikt geraetelokal: der Eintrag gehoert nie in Snapshot, Share oder
 * Personal-Mirror. Eine Freischaltung ist eine Aussage ueber DIESES Geraet.
 */

import { create } from 'zustand';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { DEFAULT_SESSION_TTL_MS, MODUL_FREISCHALTUNG_IDB_KEY } from '@/core/services/infrastructure/types';

/** Was in der IDB liegt — bewusst minimal (kein Passwort, kein Schluessel). */
interface FreischaltungMeta {
  /** Ablaufzeitpunkt der Auslastungs-Freischaltung (ms since epoch). */
  auslastungBis?: number;
}

export interface ModulFreischaltungState {
  /** Ist das Auslastungs-Modul in dieser Sitzung freigeschaltet? */
  auslastungFrei: boolean;
  auslastungBis: number | null;
  ttlMs: number;

  freischalten: (idb: IDBStore) => Promise<void>;
  sperren: (idb: IDBStore) => Promise<void>;
  rehydrate: (idb: IDBStore) => Promise<void>;
  tick: (idb: IDBStore) => void;
}

export const useModulFreischaltung = create<ModulFreischaltungState>((set, get) => ({
  auslastungFrei: false,
  auslastungBis: null,
  ttlMs: DEFAULT_SESSION_TTL_MS,

  /**
   * Nach erfolgreicher Passwortpruefung (die passiert im Aufrufer, nicht hier).
   *
   * ERST schreiben, dann den State setzen: eine Freischaltung, die nicht in der
   * IDB steht, ueberlebt den unmittelbar folgenden Reload nicht — der Store
   * duerfte sie also gar nicht erst behaupten. Scheitert der Schreibvorgang,
   * bleibt der Slot gesperrt und der Fehler erreicht den Aufrufer.
   */
  freischalten: async (idb) => {
    const bis = Date.now() + get().ttlMs;
    const meta: FreischaltungMeta = { auslastungBis: bis };
    await idb.set(MODUL_FREISCHALTUNG_IDB_KEY, meta);
    set({ auslastungFrei: true, auslastungBis: bis });
  },

  sperren: async (idb) => {
    await idb.delete(MODUL_FREISCHALTUNG_IDB_KEY);
    set({ auslastungFrei: false, auslastungBis: null });
  },

  /**
   * Beim App-Start aufgerufen — VOR den Plugin-onInit-Hooks und vor der
   * Gate-Entscheidung (siehe App.tsx). Nur dadurch koennen die Sichtbarkeits-
   * Praedikate synchron bleiben.
   */
  rehydrate: async (idb) => {
    const meta = await idb.get<FreischaltungMeta>(MODUL_FREISCHALTUNG_IDB_KEY);
    if (!meta?.auslastungBis) return;
    if (meta.auslastungBis > Date.now()) {
      set({ auslastungFrei: true, auslastungBis: meta.auslastungBis });
    } else {
      // Abgelaufen: aufraeumen, damit kein Leichen-Eintrag zurueckbleibt.
      await idb.delete(MODUL_FREISCHALTUNG_IDB_KEY);
    }
  },

  tick: (idb) => {
    const { auslastungFrei, auslastungBis } = get();
    if (auslastungFrei && auslastungBis !== null && Date.now() > auslastungBis) {
      void get().sperren(idb);
    }
  },
}));
