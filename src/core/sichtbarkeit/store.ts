/**
 * Der Laufzeit-Zustand der Sichtbarkeits-Achsen: das Kurator-Overlay über der
 * Code-Vorbelegung.
 *
 * Aufbau wie `useModulFreischaltung`: zustand-Store (reaktiv & react-agnostisch),
 * der Zeitpunkt des Ladens liegt beim Aufrufer (`App.tsx`), nicht im Store.
 *
 * **Share ist die Wahrheit, IDB der Cache.** Beim Start wird zuerst der Cache
 * gelesen — er gilt sofort, auch offline und bevor der Ordner-Picker lief. Erst
 * danach (und noch einmal nach dem Permission-Grant, siehe `ladeVomShare`)
 * kommt die Team-Fassung. Ohne den Nachlauf läge auf einer frischen
 * Installation die ganze Sitzung lang die Auslieferungs-Vorbelegung an —
 * dieselbe Falle wie beim Status-Katalog.
 */
import { create } from 'zustand';
import type { IDBStore } from '@/core/services/storage';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import { SICHTBARKEITS_KATALOG } from './katalog';
import { baueIndex, markenAusListe, markenGleich, markenZuListe } from './regel';
import {
  SICHTBARKEIT_IDB_KEY, leererStand, leseSichtbarkeitLage, schreibeSichtbarkeit,
  type SichtbarkeitSidecar,
} from './sidecar';
import type { Marken } from './types';

const INDEX = baueIndex(SICHTBARKEITS_KATALOG);

/**
 * Aus dem gespeicherten Stand die auswertbaren Abweichungen.
 *
 * Unbekannte Ids fallen hier heraus, bleiben aber im `stand` — sie kommen aus
 * einer neueren App-Fassung oder aus einem Element, das gerade umbenannt wurde.
 * Sie zu verwerfen hieße, fremde Kuration beim ersten Speichern zu löschen.
 * Unantastbare Ids fallen ebenfalls heraus: eine von Hand editierte Datei darf
 * den Weg zu den Schaltern nicht zusperren.
 */
function baueOverlay(stand: SichtbarkeitSidecar): Map<string, Marken> {
  const overlay = new Map<string, Marken>();
  for (const [id, liste] of Object.entries(stand.abweichungen)) {
    const eintrag = INDEX.get(id);
    if (!eintrag || eintrag.unantastbar) continue;
    overlay.set(id, markenAusListe(liste));
  }
  return overlay;
}

export interface SichtbarkeitState {
  /** Auswertbare Abweichungen (bekannt + antastbar). */
  overlay: Map<string, Marken>;
  /** Der volle gespeicherte Stand inkl. unbekannter Ids — Grundlage jedes Schreibvorgangs. */
  stand: SichtbarkeitSidecar;
  geladen: boolean;

  ladeAusCache: (idb: IDBStore) => Promise<void>;
  ladeVomShare: (idb: IDBStore) => Promise<void>;
  setzeMarken: (idb: IDBStore, id: string, marken: Marken, autor?: string) => Promise<boolean>;
  zuruecksetzen: (idb: IDBStore, id: string, autor?: string) => Promise<boolean>;
  alleZuruecksetzen: (idb: IDBStore, autor?: string) => Promise<boolean>;
}

export const useSichtbarkeitStore = create<SichtbarkeitState>((set, get) => ({
  overlay: new Map(),
  stand: leererStand(),
  geladen: false,

  ladeAusCache: async (idb) => {
    const roh = await idb.get<SichtbarkeitSidecar>(SICHTBARKEIT_IDB_KEY);
    if (roh) set({ stand: roh, overlay: baueOverlay(roh) });
    set({ geladen: true });
  },

  /**
   * Team-Fassung holen. Best-effort: fehlender Share, fehlende Datei oder
   * fehlende Berechtigung lassen den Cache-Stand stehen. **Nur `ok` überschreibt**
   * — bei `unlesbar` wäre ein Zurückfallen auf „nichts markiert" die
   * schlechtere Auskunft als der Stand von gestern.
   */
  ladeVomShare: async (idb) => {
    const lage = await leseSichtbarkeitLage(idb);
    if (lage.status !== 'ok') return;
    set({ stand: lage.daten, overlay: baueOverlay(lage.daten), geladen: true });
    await idb.set(SICHTBARKEIT_IDB_KEY, lage.daten);
  },

  setzeMarken: async (idb, id, marken, autor) => {
    const eintrag = INDEX.get(id);
    if (!eintrag || eintrag.unantastbar) return false;
    // Deckt sich die Wahl mit der Vorbelegung, ist es keine Abweichung mehr.
    if (markenGleich(marken, eintrag.marken)) return get().zuruecksetzen(idb, id, autor);
    return schreibeStand(idb, set, autor, abw => {
      abw[id] = markenZuListe(marken);
    }, { id, marken: markenZuListe(marken) });
  },

  zuruecksetzen: async (idb, id, autor) => {
    const eintrag = INDEX.get(id);
    if (!eintrag || eintrag.unantastbar) return false;
    return schreibeStand(idb, set, autor, abw => {
      delete abw[id];
    }, { id, marken: 'vorgabe' });
  },

  alleZuruecksetzen: async (idb, autor) => {
    return schreibeStand(idb, set, autor, abw => {
      // Nur die BEKANNTEN Ids räumen: unbekannte gehören einer anderen
      // App-Fassung und wären hier nicht wiederherstellbar.
      for (const id of Object.keys(abw)) {
        if (INDEX.has(id)) delete abw[id];
      }
    }, { id: '*', marken: 'vorgabe' });
  },
}));

type Setter = (partial: Partial<SichtbarkeitState>) => void;

/**
 * Lesen → ändern → schreiben, in dieser Reihenfolge und mit Abbruch bei
 * `unlesbar` (Regel v4.12): der Kurator schreibt die GANZE Datei zurück, also
 * darf er nie von einem Stand ausgehen, den er nur nicht lesen konnte.
 *
 * Erst der Share, dann der lokale Zustand — was nicht auf dem Share steht, hat
 * für das Team nicht stattgefunden.
 */
async function schreibeStand(
  idb: IDBStore,
  set: Setter,
  autor: string | undefined,
  aendere: (abweichungen: Record<string, ReturnType<typeof markenZuListe>>) => void,
  audit: { id: string; marken: unknown },
): Promise<boolean> {
  const lage = await leseSichtbarkeitLage(idb);
  if (lage.status === 'unlesbar') return false;
  const basis = lage.status === 'ok' ? lage.daten : leererStand();

  const abweichungen = { ...basis.abweichungen };
  aendere(abweichungen);
  const neu: SichtbarkeitSidecar = {
    version: 1,
    updatedAt: new Date().toISOString(),
    ...(autor ? { autor } : {}),
    abweichungen,
  };

  const ok = await schreibeSichtbarkeit(idb, neu);
  if (!ok) return false;

  set({ stand: neu, overlay: baueOverlay(neu), geladen: true });
  await idb.set(SICHTBARKEIT_IDB_KEY, neu);
  void logAudit(idb, {
    ...(autor ? { user: autor } : {}),
    action: 'sichtbarkeit_geaendert',
    details: { element: audit.id, marken: audit.marken },
  }).catch(() => {});
  return true;
}
