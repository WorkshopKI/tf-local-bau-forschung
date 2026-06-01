/**
 * MA-Identity-Session (v2.11) — die per Passwort entschluesselte Identitaet.
 *
 * Spiegelt das Kurator-Session-Pattern ([useKuratorSession]), speichert aber
 * statt eines Boolean-Flags das aus dem Passwort entschluesselte **Kuerzel** —
 * und zwar in `sessionStorage` (NICHT IDB):
 *  - TTL = Browser-Tab: loescht sich beim Schliessen → Login pro Arbeitstag.
 *  - Bewusste Abweichung vom IDB-Pattern der anderen Sessions, sicherheits-
 *    positiv: das Kuerzel liegt nie persistent auf der Platte.
 *  - Es wird AUSSCHLIESSLICH das Kuerzel abgelegt, NIE Passwort oder Key — so
 *    liegt selbst bei offener DevTools-Konsole nie das Passwort herum.
 *
 * Es gibt KEINE setKuerzel()-Funktion: das Kuerzel entsteht nur aus einer
 * erfolgreichen Entschluesselung (`verifyPasswortAgainstAll`).
 */
import { create } from 'zustand';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { MA_KUERZEL_SESSION_KEY } from '@/core/services/infrastructure/types';
import {
  isZugangConfigured,
  loadZugangFile,
  verifyPasswortAgainstAll,
} from '@/core/services/infrastructure/zugang-config';

// sessionStorage-Zugriff defensiv: gehaertete file://-Konfigurationen koennen
// werfen — ein unbehandelter Throw im Store-Initializer wuerde die App beim
// Modul-Load crashen.
function readSessionKuerzel(): string | null {
  try {
    const v = sessionStorage.getItem(MA_KUERZEL_SESSION_KEY);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}
function writeSessionKuerzel(kuerzel: string | null): void {
  try {
    if (kuerzel) sessionStorage.setItem(MA_KUERZEL_SESSION_KEY, kuerzel);
    else sessionStorage.removeItem(MA_KUERZEL_SESSION_KEY);
  } catch {
    /* sessionStorage nicht verfuegbar — der In-Memory-State traegt die Session. */
  }
}

const initialKuerzel = readSessionKuerzel();

export interface MAIdentityState {
  /** Entschluesseltes Kuerzel aus sessionStorage, oder null. */
  kuerzel: string | null;
  istAngemeldet: boolean;
  /** true waehrend der Login-Entschluesselung (fuer den Spinner). */
  istPruefend: boolean;
  /** Bestimmt, ob der Login erzwungen wird (Datei da) oder Fallback greift. */
  zugangsdateiVorhanden: boolean;

  /** Prueft, ob `_intern/auslastung-zugang.enc` existiert. */
  pruefeZugangsdatei: (idb: IDBStore) => Promise<void>;
  /** Probiert das Passwort gegen alle Eintraege. true bei Treffer. */
  login: (idb: IDBStore, passwort: string) => Promise<boolean>;
  /** Leert die Session (sessionStorage + State). */
  logout: () => void;
}

export const useMAIdentity = create<MAIdentityState>((set) => ({
  kuerzel: initialKuerzel,
  istAngemeldet: initialKuerzel != null,
  istPruefend: false,
  zugangsdateiVorhanden: false,

  pruefeZugangsdatei: async (idb) => {
    const vorhanden = await isZugangConfigured(idb);
    set({ zugangsdateiVorhanden: vorhanden });
  },

  login: async (idb, passwort) => {
    set({ istPruefend: true });
    try {
      const file = await loadZugangFile(idb);
      const treffer = file ? await verifyPasswortAgainstAll(passwort, file.eintraege) : null;
      if (!treffer) {
        set({ istPruefend: false });
        return false;
      }
      writeSessionKuerzel(treffer.kuerzel);
      set({ kuerzel: treffer.kuerzel, istAngemeldet: true, istPruefend: false });
      return true;
    } catch (err) {
      console.error('[useMAIdentity] login fehlgeschlagen:', err);
      set({ istPruefend: false });
      return false;
    }
  },

  logout: () => {
    writeSessionKuerzel(null);
    set({ kuerzel: null, istAngemeldet: false });
  },
}));
