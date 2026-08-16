/**
 * Die **Spaltenkopf-Auswahl** der Fördertabelle — als Store statt im Bauteil.
 *
 * `useColumnFilters` hält seinen Stand normalerweise selbst (`useState` im
 * Hook). Für die Fördertabelle reicht das seit v4.67 nicht mehr: ein eigener
 * Reiter (`eigeneReiter.ts`) muss die Auswahl **lesen** können, um sie zu
 * merken, und sie **setzen** können, um sie wiederherzustellen. Beides geht
 * nicht an einem Zustand, der in der Tabelle eingeschlossen ist.
 *
 * **Warum persistiert.** Die Klick-Sortierung am Spaltenkopf überlebt einen
 * Reload seit jeher (`useTableSort` mit `storageKey`, ausdrücklicher
 * Nutzer-Wunsch), die Filterleiste ebenfalls (`activeFilterPersistence.ts`) —
 * die Kopf-Auswahl war der Ausreißer. Und ein Reiter, der elf von zwölf Achsen
 * wiederherstellt und die zwölfte beim nächsten Start verliert, verspricht mehr,
 * als er hält. Unsichtbar ist der Filter dabei nicht: ein belegter Spaltenkopf
 * trägt dauerhaft den gefüllten Trichter samt Anzahl (`TableHeadRows`).
 *
 * Gespeichert werden **Listen**, gehalten werden **Sets** — `useColumnFilters`
 * arbeitet mit Sets, JSON kennt keine.
 */
import { create } from 'zustand';

const STORAGE_KEY = 'teamflow_antraege_kopf_filter_v1';

/** Serialisierbare Form: Spalten-Key → gewählte Werte. */
export type KopfAuswahl = Record<string, string[]>;

/** Laufzeit-Form, wie `useColumnFilters` sie erwartet. */
export type KopfStand = Record<string, Set<string>>;

export function alsStand(auswahl: KopfAuswahl): KopfStand {
  const out: KopfStand = {};
  for (const [k, werte] of Object.entries(auswahl)) {
    if (werte.length > 0) out[k] = new Set(werte);
  }
  return out;
}

/** Leere Sets fallen raus — „kein Filter" hat genau eine Schreibweise. */
export function alsAuswahl(stand: KopfStand): KopfAuswahl {
  const out: KopfAuswahl = {};
  for (const [k, set] of Object.entries(stand)) {
    if (set.size > 0) out[k] = [...set].sort();
  }
  return out;
}

export function ladeKopfAuswahl(): KopfAuswahl {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: KopfAuswahl = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(v)) continue;
      const werte = v.filter((x): x is string => typeof x === 'string');
      if (werte.length > 0) out[k] = werte;
    }
    return out;
  } catch {
    return {};
  }
}

function speichereKopfAuswahl(auswahl: KopfAuswahl): void {
  try {
    if (Object.keys(auswahl).length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(auswahl));
  } catch {
    /* ignore */
  }
}

interface KopfFilterStore {
  stand: KopfStand;
  /** Eine Spalte setzen; leeres Set = Filter dieser Spalte entfernen. */
  setzeSpalte: (key: string, werte: Set<string>) => void;
  /** Den ganzen Stand ersetzen (Reiter anwenden). */
  setzeStand: (auswahl: KopfAuswahl) => void;
}

export const useKopfFilter = create<KopfFilterStore>((set, get) => ({
  stand: alsStand(ladeKopfAuswahl()),

  setzeSpalte: (key, werte) => {
    const next: KopfStand = { ...get().stand };
    if (werte.size === 0) delete next[key];
    else next[key] = werte;
    speichereKopfAuswahl(alsAuswahl(next));
    set({ stand: next });
  },

  setzeStand: (auswahl) => {
    speichereKopfAuswahl(auswahl);
    set({ stand: alsStand(auswahl) });
  },
}));
