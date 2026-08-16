/**
 * Die Darstellungs-Achsen der Antragsliste als EINE Datenstruktur — der pure
 * Teil des kombinierten „Darstellung"-Menüs (`DarstellungDropdown`).
 *
 * Bis v3.10 stand jede Achse als eigenes Dropdown in der Toolbar („Ansicht:",
 * „Gruppierung:", „Beendet:"). Zu dritt belegten sie rund 640 px und drängten
 * die Quickfilter dadurch in einen Umbruch — für drei Schalter, die selten
 * angefasst werden. Sie teilen sich jetzt ein Menü; hier steht, welche Achse in
 * welchem Zustand überhaupt gilt und was davon vom Standard abweicht.
 *
 * **Keine eigene Options-Liste.** Jede Achse zieht Werte UND Standard aus ihrer
 * bisherigen Quelle (`TABLE_ANSICHT_OPTIONS`, `TABLE_GROUPING_OPTIONS` bzw.
 * `GROUPING_OPTIONS`, `BEENDET_OPTIONS`). Dieselben Listen liest die Persistenz
 * als Whitelist — eine zweite Aufzählung hier würde genau dann auseinanderlaufen,
 * wenn eine Option dazukommt.
 *
 * Welche Achse gilt, ist ebenfalls nicht neu erfunden: die Zeilen-Körnung kennt
 * nur die Tabelle, und der Beendet-Schalter nur der „Alle"-Reiter
 * (`hatBeendetAchse`) außerhalb der Karten-Ansicht.
 *
 * **Die Form der Achse ist seit v3.24 geteilt** (`@/components/ui/
 * darstellungsAchsen`) — hier bleibt die Frage, WELCHE Achsen im aktuellen
 * Zustand gelten, denn die hängt am Antrags-Datenmodell. Die drei gehobenen
 * Symbole werden re-exportiert, damit die Aufrufer und der Test ihre Importwege
 * behalten.
 */
import type { DarstellungAchse } from '@/components/ui/darstellungsAchsen';
import type { ViewKey } from './views';
import { type ViewMode, VIEW_MODE_OPTIONS, DEFAULT_VIEW_MODE } from './viewModes';
import { GROUPING_OPTIONS, DEFAULT_GROUPING_BY_VIEW } from './sort';
import {
  TABLE_ANSICHT_OPTIONS,
  DEFAULT_TABLE_ANSICHT,
  TABLE_GROUPING_OPTIONS,
  DEFAULT_TABLE_GROUPING,
} from './tableGrouping';
import {
  BEENDET_OPTIONS,
  DEFAULT_BEENDET_SICHT,
  BEENDET_ACHSE_LABEL,
  hatBeendetAchse,
} from './arbeitsvorrat';
import {
  DEFAULT_SPALTEN_PROFIL,
  EIGENE_AUSWAHL,
  erkenneProfil,
  spaltenProfilOptionen,
} from './spaltenProfile';
import { DICHTE_OPTIONS, DEFAULT_DICHTE } from './useDichteStore';

export type {
  DarstellungAchse,
  DarstellungOption,
  DarstellungArt,
  DarstellungKurzfassung,
} from '@/components/ui/darstellungsAchsen';
export {
  darstellungsZusammenfassung,
  schalterAn,
  zuruecksetzenAufrufe,
} from '@/components/ui/darstellungsAchsen';

export type DarstellungAchseId =
  | 'ansichtsform' | 'ansicht' | 'gruppierung' | 'spalten' | 'dichte' | 'beendet';

export interface DarstellungEingabe {
  viewMode: ViewMode;
  activeView: ViewKey;
  tableAnsicht: string;
  tableGruppierung: string;
  listGruppierung: string;
  /** Sichtbare Spalten der Tabelle — daraus wird das aktive Profil ERKANNT,
   *  nicht daneben gespeichert. Ein zweiter Zustand („gewähltes Profil") liefe
   *  auseinander, sobald jemand im Picker einen Haken setzt. */
  sichtbareSpalten: readonly string[];
  /** Zeilendichte der Tabelle (`useDichteStore`). */
  dichte: string;
  /** `true` = beendete Anträge stehen nicht in der Liste. */
  beendetAusgeblendet: boolean;
}

/** Die im aktuellen Zustand geltenden Achsen, in Menü-Reihenfolge. Nie leer —
 *  die Gruppierung gibt es in jeder Ansicht. */
export function baueDarstellungsAchsen(e: DarstellungEingabe): DarstellungAchse<DarstellungAchseId>[] {
  const achsen: DarstellungAchse<DarstellungAchseId>[] = [];
  // Die Form der Liste selbst — seit v4.64 hier statt als Drei-Icon-Gruppe im
  // Seitenkopf. Sie steht an erster Stelle, weil sie bestimmt, WELCHE Achsen
  // darunter überhaupt gelten: Zeilen-Körnung, Spaltensatz und Zeilendichte
  // kennt nur die Tabelle. Das Menü ändert sich also unter der Hand — das ist
  // gewollt und der Grund, warum die Achse ganz oben steht und nicht mittendrin.
  achsen.push({
    id: 'ansichtsform',
    art: 'segment',
    label: 'Ansicht',
    options: VIEW_MODE_OPTIONS,
    value: e.viewMode,
    standard: DEFAULT_VIEW_MODE,
  });
  // Zeilen-Körnung kennt nur die Tabelle: Karten- und Listen-Ansicht verdichten
  // Verbünde nicht, dort wäre der Schalter eine Attrappe.
  if (e.viewMode === 'compact') {
    achsen.push({
      id: 'ansicht',
      art: 'segment',
      // Zweiwertig, aber KEIN An/Aus — beide Werte sind eigene Zeilen-Körnungen.
      label: 'Zeile zeigt',
      options: TABLE_ANSICHT_OPTIONS,
      value: e.tableAnsicht,
      standard: DEFAULT_TABLE_ANSICHT,
    });
  }
  const tabelle = e.viewMode === 'compact';
  achsen.push({
    id: 'gruppierung',
    art: 'segment',
    // Beschriftung wie auf dem Feedback-Board — dieselbe Sache, und sie war
    // schon selbsterklärend. Gemessen passt die breiteste Fassung (fünf Werte
    // in der Tabelle) mit 312 px in die 378 px Innenbreite; die Listen-Fassung
    // mit „NW-Größe" braucht 319 px. Kein Stapeln nötig.
    label: 'Gruppierung',
    options: tabelle ? TABLE_GROUPING_OPTIONS : GROUPING_OPTIONS,
    value: tabelle ? e.tableGruppierung : e.listGruppierung,
    standard: tabelle ? DEFAULT_TABLE_GROUPING : DEFAULT_GROUPING_BY_VIEW[e.activeView],
    // Sechs Werte („Keine · Status · Frist · NW · FB · AB") passen neben der
    // Beschriftung nicht mehr in die 378-px-Zeile — bei fünf waren es gemessen
    // 312 px. Gestapelt statt dem Umbruch überlassen (siehe `stapel`).
    ...(tabelle ? { stapel: true } : {}),
  });
  // Spaltenprofil: eine ANZEIGE-Achse, deshalb hier und nicht in der
  // Filterzeile. Sie steht im selben Menü wie Ansicht und Gruppierung, damit
  // ein abweichendes Profil über `darstellungsZusammenfassung` am Knopf
  // auftaucht — ein stiller Spaltensatz wäre genau die Art Zustand, die man
  // sucht, wenn eine gewohnte Spalte plötzlich fehlt.
  if (tabelle) {
    const profil = erkenneProfil(e.sichtbareSpalten);
    achsen.push({
      id: 'spalten',
      art: 'segment',
      // „Spaltensatz", nicht „Spalten": daneben in der Werkzeugleiste steht der
      // Picker mit demselben Wort, und der wählt EINZELNE Spalten. Zwei Knöpfe
      // mit gleichem Namen für zwei verschiedene Griffe.
      label: 'Spaltensatz',
      options: spaltenProfilOptionen(profil),
      value: profil ?? EIGENE_AUSWAHL,
      standard: DEFAULT_SPALTEN_PROFIL,
      stapel: true,
    });
    // Zeilendichte: ebenfalls eine reine Anzeige-Achse und ebenfalls nur in der
    // Tabelle — Karten und Liste haben keine Zeilen, deren Höhe man stellen
    // könnte. Zwei Werte passen neben die Beschriftung, kein Stapeln nötig.
    achsen.push({
      id: 'dichte',
      art: 'segment',
      label: 'Zeilendichte',
      options: DICHTE_OPTIONS,
      value: e.dichte,
      standard: DEFAULT_DICHTE,
    });
  }
  if (hatBeendetAchse(e.activeView) && e.viewMode !== 'cards') {
    achsen.push({
      id: 'beendet',
      art: 'schalter',
      // `aus` ist der ERSTE Schlüssel und heißt „ausgeblendet" — der Schalter
      // steht also auf an, wenn der Wert `ein` ist. Deshalb explizit.
      anKey: 'ein',
      label: BEENDET_ACHSE_LABEL,
      options: BEENDET_OPTIONS,
      value: e.beendetAusgeblendet ? 'aus' : 'ein',
      standard: DEFAULT_BEENDET_SICHT,
    });
  }
  return achsen;
}
