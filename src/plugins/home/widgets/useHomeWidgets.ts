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
import { useSichtbar } from '@/core/hooks/useSichtbar';
import type { IDBStore } from '@/core/services/storage/idb-store';
import {
  loadHomeWidgets,
  moveInstanz,
  saveHomeWidgets,
  setzeAlleEingeklappt,
  setzeHeroChip,
  setzeHeroKarte,
  setzeSichtbarkeitBereich,
  sichtbareWidgets,
  sortiereInstanzen,
  widgetAnzeigbar,
  zurueckgesetzteConfig,
} from './homeWidgetsStore';
import {
  HERO_CONFIG_DEFAULT,
  type HeroChipId,
  type HeroConfig,
  type HeroKarte,
  type HomeWidgetConfig,
  type WidgetInstanz,
  type WidgetSpezifischeConfig,
} from './types';

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
    // Der Versions-Stempel ist zugleich das Gedächtnis der einmaligen Schritte
    // (v5 Entdeckungs-Einblendung, v6 Tagesbrief an den Kopf): solange niemand
    // etwas ändert, laufen sie bei jedem Laden erneut — folgenlos, weil
    // idempotent. Die erste echte Änderung persistiert v6, und ab da hält ein
    // Ausblenden bzw. ein Verschieben. **Der Stempel muss mit der Schema-Version
    // mitwandern** — bliebe er auf 5, verschöbe v6 die Karte bei jedem Laden aufs
    // Neue an den Kopf.
    const next: HomeWidgetConfig = {
      ...mutator(aktuell),
      version: 6,
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
  /** Die beiden festen Karten über den Spalten (kein Widget, s. `HeroConfig`). */
  hero: HeroConfig;
  setSichtbar: (id: string, sichtbar: boolean) => Promise<void>;
  setEingeklappt: (id: string, eingeklappt: boolean) => Promise<void>;
  /**
   * Eine Position hoch/runter — `unter` sagt, GEGEN WEN getauscht wird.
   *
   * Die beiden Aufrufer sehen verschiedene Listen, und der Tausch muss der
   * Liste folgen, in der geklickt wurde (v4.131): das `⋯` einer Karte steht in
   * der Startseite und kennt nur die SICHTBAREN Nachbarn; die Checkliste im
   * Untermenü führt alle ANZEIGBAREN, auch die ausgeblendeten. Bis dahin
   * tauschte beides gegen die anzeigbaren — im Karten-Menü zeigte die Zeile
   * „2 / 5" aus den sichtbaren, der Klick tauschte mit einem ausgeblendeten
   * Nachbarn, und auf dem Schirm bewegte sich nichts.
   */
  move: (id: string, richtung: 'hoch' | 'runter', unter?: 'sichtbare' | 'anzeigbare') => Promise<void>;
  updateConfig: (id: string, config: WidgetSpezifischeConfig) => Promise<void>;
  /**
   * Wie `updateConfig`, aber die neue Config entsteht aus dem AKTUELLEN Stand
   * statt aus dem, den der Aufrufer in der Hand hält. Für Schreiber, die außerhalb
   * des Render-Takts sitzen — das Vollbild-Fenster lebt weiter, wenn die
   * Startseite längst ausgehängt ist, und würde mit `updateConfig` einen alten
   * Stand zurückschreiben und fremde Änderungen mitnehmen.
   */
  mutiereConfig: (
    id: string,
    aendere: (config: WidgetSpezifischeConfig) => WidgetSpezifischeConfig,
  ) => Promise<void>;
  /** „Alles einklappen"/-aufklappen über beide Spalten (nur sichtbare Widgets). */
  alleEinklappen: (eingeklappt: boolean) => Promise<void>;
  /** Der „alle"-Schalter einer Spalte im Widgets-Untermenü. */
  setSichtbarBereich: (bereich: WidgetInstanz['bereich'], sichtbar: boolean) => Promise<void>;
  /** Hero-Karte ein-/ausblenden (`⋯` der Karte, Gruppe „Oben" im Untermenü). */
  setHeroKarte: (karte: HeroKarte, sichtbar: boolean) => Promise<void>;
  /** Kachel der Alert-Karte ab-/anwählen (nur im `⋯` dieser Karte). */
  setHeroChip: (chip: HeroChipId, an: boolean) => Promise<void>;
  /** „Startseite zurücksetzen" — Stand eines frischen Geräts. */
  zuruecksetzen: () => Promise<void>;
  /**
   * Wendet eine Umkehrung auf den AKTUELLEN Stand an — der EINE Rückgängig-Weg.
   *
   * Bewusst eine Funktion und kein fertiger Stand (v4.131): ein zurück-
   * geschriebener Vorstand nähme alles mit, was seit der Aktion passiert ist
   * (Einklappen legt keinen Eintrag an und war so nicht wiederherstellbar).
   */
  wendeAn: (umkehrung: (aktuell: HomeWidgetConfig) => HomeWidgetConfig) => Promise<void>;
}

export function useHomeWidgets(): HomeWidgetsApi {
  const storage = useStorage();
  const config = useHomeWidgetsStore(s => s.config);
  const laden = useHomeWidgetsStore(s => s.laden);
  const mutiere = useHomeWidgetsStore(s => s.mutiere);
  // Beta/Experte: die Marken kommen als Prädikat herein, damit die reinen
  // Store-Funktionen react-frei und testbar bleiben. Ändert sich ein Schalter,
  // wechselt `angezeigt` die Identität und das Memo unten rechnet neu.
  const angezeigt = useSichtbar();

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
      haupt: config ? sichtbareWidgets(config, 'haupt', undefined, angezeigt) : [],
      seite: config ? sichtbareWidgets(config, 'seite', undefined, angezeigt) : [],
      alleInstanzen: config ? sortiereInstanzen(config.widgets) : [],
      hero: config?.hero ?? HERO_CONFIG_DEFAULT,
      setSichtbar: (id, sichtbar) => patchInstanz(id, { sichtbar }),
      setEingeklappt: (id, eingeklappt) => patchInstanz(id, { eingeklappt }),
      // Der Nachbar-Begriff kommt vom Aufrufer: `anzeigbare` (Standard) ist die
      // Checkliste im Untermenü, `sichtbare` das Bild der Startseite. Von der
      // Beta-/Experten-Achse verborgene Typen sind in beiden Fällen draußen —
      // ein Tausch mit ihnen bewegte nichts.
      move: (id, richtung, unter = 'anzeigbare') =>
        mutiere(idb, cfg =>
          moveInstanz(cfg, id, richtung, w =>
            widgetAnzeigbar(w.typ, undefined, angezeigt) && (unter === 'anzeigbare' || w.sichtbar))),
      updateConfig: (id, config_) => patchInstanz(id, { config: config_ }),
      mutiereConfig: (id, aendere) =>
        mutiere(idb, cfg => ({
          ...cfg,
          widgets: cfg.widgets.map(w => (w.id === id ? { ...w, config: aendere(w.config) } : w)),
        })),
      alleEinklappen: eingeklappt => mutiere(idb, cfg => setzeAlleEingeklappt(cfg, eingeklappt, undefined, angezeigt)),
      setSichtbarBereich: (bereich, sichtbar) =>
        mutiere(idb, cfg => setzeSichtbarkeitBereich(cfg, bereich, sichtbar, undefined, angezeigt)),
      setHeroKarte: (karte, sichtbar) => mutiere(idb, cfg => setzeHeroKarte(cfg, karte, sichtbar)),
      setHeroChip: (chip, an) => mutiere(idb, cfg => setzeHeroChip(cfg, chip, an)),
      zuruecksetzen: () => mutiere(idb, () => zurueckgesetzteConfig()),
      wendeAn: umkehrung => mutiere(idb, umkehrung),
    };
  }, [config, mutiere, storage.idb, angezeigt]);
}
