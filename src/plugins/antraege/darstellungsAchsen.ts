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
 */
import type { ViewKey } from './views';
import type { ViewMode } from './viewModes';
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
  ARBEITSVORRAT_LABEL,
  hatBeendetAchse,
} from './arbeitsvorrat';

export type DarstellungAchseId = 'ansicht' | 'gruppierung' | 'beendet';

export interface DarstellungOption {
  key: string;
  label: string;
}

export interface DarstellungAchse {
  id: DarstellungAchseId;
  /** Überschrift des Abschnitts im Menü. */
  label: string;
  /** Ein Halbsatz darunter, der die Achse von den beiden anderen abgrenzt. */
  hinweis: string;
  options: readonly DarstellungOption[];
  value: string;
  /** Der Wert, der als „unverändert" gilt — er taucht nicht in der
   *  Zusammenfassung am Knopf auf. */
  standard: string;
}

export interface DarstellungEingabe {
  viewMode: ViewMode;
  activeView: ViewKey;
  tableAnsicht: string;
  tableGruppierung: string;
  listGruppierung: string;
  /** `true` = beendete Anträge stehen nicht in der Liste. */
  beendetAusgeblendet: boolean;
}

/** Die im aktuellen Zustand geltenden Achsen, in Menü-Reihenfolge. Nie leer —
 *  die Gruppierung gibt es in jeder Ansicht. */
export function baueDarstellungsAchsen(e: DarstellungEingabe): DarstellungAchse[] {
  const achsen: DarstellungAchse[] = [];
  // Zeilen-Körnung kennt nur die Tabelle: Karten- und Listen-Ansicht verdichten
  // Verbünde nicht, dort wäre der Schalter eine Attrappe.
  if (e.viewMode === 'compact') {
    achsen.push({
      id: 'ansicht',
      label: 'Ansicht',
      hinweis: 'Was eine Zeile zeigt',
      options: TABLE_ANSICHT_OPTIONS,
      value: e.tableAnsicht,
      standard: DEFAULT_TABLE_ANSICHT,
    });
  }
  const tabelle = e.viewMode === 'compact';
  achsen.push({
    id: 'gruppierung',
    label: 'Gruppierung',
    hinweis: 'Abschnitts-Bänder über den Zeilen',
    options: tabelle ? TABLE_GROUPING_OPTIONS : GROUPING_OPTIONS,
    value: tabelle ? e.tableGruppierung : e.listGruppierung,
    standard: tabelle ? DEFAULT_TABLE_GROUPING : DEFAULT_GROUPING_BY_VIEW[e.activeView],
  });
  if (hatBeendetAchse(e.activeView) && e.viewMode !== 'cards') {
    achsen.push({
      id: 'beendet',
      label: ARBEITSVORRAT_LABEL.archiv,
      hinweis: 'Terminale Anträge in der Liste',
      options: BEENDET_OPTIONS,
      value: e.beendetAusgeblendet ? 'aus' : 'ein',
      standard: DEFAULT_BEENDET_SICHT,
    });
  }
  return achsen;
}

/**
 * Die abweichenden Werte als „Antrag mit TV · Status" für den Knopf.
 *
 * Leer, solange alles auf Standard steht — dann trägt der Knopf nur seinen
 * Namen und bleibt schmal. Das ist der Normalfall und der Grund, warum die drei
 * Achsen überhaupt in ein Menü passen.
 */
export function darstellungsZusammenfassung(achsen: readonly DarstellungAchse[]): string {
  return achsen
    .filter(a => a.value !== a.standard)
    .map(a => a.options.find(o => o.key === a.value)?.label ?? a.value)
    .join(' · ');
}
