/**
 * Geteilter Widget-Config-State (Zustand-Store + Hook).
 *
 * Bewusst KEIN useState-only (Session-Verlust, Lehre v2.157.0): der Store wird
 * von HomePage-Stack, Einstellungs-Sektion und Stift-Popover geteilt. Jede
 * Mutation = EIN setState + EIN Persist (Geist von Pitfall #16/#20).
 */
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useStorage } from '@/core/hooks/useStorage';
import type { IDBStore } from '@/core/services/storage/idb-store';
import {
  loadHomeWidgets,
  moveInstanz,
  saveHomeWidgets,
  setzeAlleEingeklappt,
  setzeSichtbarkeitBereich,
  sichtbareWidgets,
  sortiereInstanzen,
  zurueckgesetzteConfig,
} from './homeWidgetsStore';
import type { HomeWidgetConfig, WidgetInstanz, WidgetSpezifischeConfig } from './types';

interface HomeWidgetsState {
  /** null = noch nicht geladen. */
  config: HomeWidgetConfig | null;
  laden: (idb: IDBStore) => Promise<void>;
  /** Wendet `mutator` auf die aktuelle Config an, stempelt `updatedAt` und
   *  persistiert exakt das gesetzte Objekt (ein setState + ein Persist). */
  mutiere: (idb: IDBStore, mutator: (cfg: HomeWidgetConfig) => HomeWidgetConfig) => Promise<void>;
}

export const useHomeWidgetsStore = create<HomeWidgetsState>((set, get) => ({
  config: null,
  laden: async (idb) => {
    if (get().config) return;
    const geladen = await loadHomeWidgets(idb);
    // Race-Guard: hat ein paralleler Mount schneller geladen, gewinnt der.
    if (!get().config) set({ config: geladen });
  },
  mutiere: async (idb, mutator) => {
    const aktuell = get().config;
    if (!aktuell) return;
    const next: HomeWidgetConfig = {
      ...mutator(aktuell),
      version: 2,
      updatedAt: new Date().toISOString(),
    };
    set({ config: next });
    await saveHomeWidgets(idb, next);
  },
}));

export interface HomeWidgetsApi {
  /** false, solange die Config noch aus IDB lädt. */
  geladen: boolean;
  /** Der aktuelle Stand — Vorlage für „Rückgängig" (s. `ersetze`). */
  config: HomeWidgetConfig | null;
  /** Sichtbare Widgets je Bereich (sortiert, Katalog-/Flag-gefiltert) — Homepage. */
  haupt: WidgetInstanz[];
  seite: WidgetInstanz[];
  /** ALLE Instanzen global sortiert, ungefiltert — Einstellungs-Positionsliste. */
  alleInstanzen: WidgetInstanz[];
  setSichtbar: (id: string, sichtbar: boolean) => Promise<void>;
  setEingeklappt: (id: string, eingeklappt: boolean) => Promise<void>;
  move: (id: string, richtung: 'hoch' | 'runter') => Promise<void>;
  updateConfig: (id: string, config: WidgetSpezifischeConfig) => Promise<void>;
  /** „Alles einklappen"/-aufklappen über beide Spalten (nur sichtbare Widgets). */
  alleEinklappen: (eingeklappt: boolean) => Promise<void>;
  /** Der „alle"-Schalter einer Spalte im Widgets-Untermenü. */
  setSichtbarBereich: (bereich: WidgetInstanz['bereich'], sichtbar: boolean) => Promise<void>;
  /** „Startseite zurücksetzen" — Stand eines frischen Geräts. */
  zuruecksetzen: () => Promise<void>;
  /** Schreibt einen kompletten Vorstand zurück — der EINE Rückgängig-Weg. */
  ersetze: (cfg: HomeWidgetConfig) => Promise<void>;
}

export function useHomeWidgets(): HomeWidgetsApi {
  const storage = useStorage();
  const config = useHomeWidgetsStore(s => s.config);
  const laden = useHomeWidgetsStore(s => s.laden);
  const mutiere = useHomeWidgetsStore(s => s.mutiere);

  useEffect(() => {
    laden(storage.idb).catch(err => {
      console.warn('[home-widgets] Laden fehlgeschlagen', err);
    });
  }, [laden, storage.idb]);

  return useMemo<HomeWidgetsApi>(() => {
    const idb = storage.idb;
    const patchInstanz = (id: string, patch: Partial<WidgetInstanz>) =>
      mutiere(idb, cfg => ({
        ...cfg,
        widgets: cfg.widgets.map(w => (w.id === id ? { ...w, ...patch } : w)),
      }));
    return {
      geladen: config !== null,
      config,
      haupt: config ? sichtbareWidgets(config, 'haupt') : [],
      seite: config ? sichtbareWidgets(config, 'seite') : [],
      alleInstanzen: config ? sortiereInstanzen(config.widgets) : [],
      setSichtbar: (id, sichtbar) => patchInstanz(id, { sichtbar }),
      setEingeklappt: (id, eingeklappt) => patchInstanz(id, { eingeklappt }),
      move: (id, richtung) => mutiere(idb, cfg => moveInstanz(cfg, id, richtung)),
      updateConfig: (id, config_) => patchInstanz(id, { config: config_ }),
      alleEinklappen: eingeklappt => mutiere(idb, cfg => setzeAlleEingeklappt(cfg, eingeklappt)),
      setSichtbarBereich: (bereich, sichtbar) =>
        mutiere(idb, cfg => setzeSichtbarkeitBereich(cfg, bereich, sichtbar)),
      zuruecksetzen: () => mutiere(idb, () => zurueckgesetzteConfig()),
      ersetze: vorstand => mutiere(idb, () => vorstand),
    };
  }, [config, mutiere, storage.idb]);
}
