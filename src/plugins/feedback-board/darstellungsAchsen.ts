/**
 * Die Darstellungs-Achsen des Feedback-Boards als EINE Datenstruktur — der pure
 * Teil des geteilten „Darstellung"-Menüs (`@/components/ui/DarstellungDropdown`,
 * dasselbe Bauteil wie auf den Förderanträgen).
 *
 * Bis v3.23 standen Gruppierung, Dichte und „Archivierte" als drei Bedienelemente
 * in drei verschiedenen Bauformen nebeneinander in der Toolbar (zwei Popover-Knöpfe
 * und eine rohe Checkbox) — für Schalter, die man selten anfasst.
 *
 * **Keine eigene Options-Liste.** Jede Achse zieht Werte UND Standard aus ihrer
 * bisherigen Quelle (`GRUPPIER_ACHSEN`, `DICHTE_OPTIONEN`). Eine zweite
 * Aufzählung hier liefe genau dann auseinander, wenn eine Option dazukommt.
 */
import type { DarstellungAchse } from '@/components/ui/darstellungsAchsen';
import { GRUPPIER_ACHSEN, istGruppierAchse, type GruppierAchse } from './gruppierung';
import { DICHTE_OPTIONEN, istDichte, type Dichte } from './ticket/dichte';

export type BoardAchseId = 'gruppierung' | 'dichte' | 'archiv';

/**
 * Die komfortable Dichte ist intern der LEERE String (sie wird als CSS-Klasse
 * angehängt, und „keine Zusatzklasse" ist der Normalfall). Als Options-Schlüssel
 * taugt sie damit nicht: `key=""` gibt einen leeren React-Key und `aria-checked`
 * ließe sich nicht zuordnen. Im Menü heißt sie deshalb `komfort` — eine reine
 * Innenrepräsentation, die den Storage nie erreicht.
 */
const KOMFORT = 'komfort';

const dichteNachAussen = (d: Dichte): string => (d === '' ? KOMFORT : d);

/** Menü-Schlüssel zurück auf den Dichte-Wert; unbekanntes fällt auf komfortabel. */
export function dichteAusSchluessel(key: string): Dichte {
  if (key === KOMFORT) return '';
  return istDichte(key) ? key : '';
}

/** Menü-Schlüssel zurück auf die Gruppier-Achse; unbekanntes heißt „keine". */
export function gruppierungAusSchluessel(key: string): GruppierAchse {
  return istGruppierAchse(key) ? key : 'keine';
}

export interface BoardDarstellung {
  gruppierung: GruppierAchse;
  dichte: Dichte;
  zeigeArchiv: boolean;
  /** Ohne Schreibrecht ist „Archivierte einblenden" wirkungslos — die Achse
   *  fällt dann weg, statt als Attrappe dazustehen. */
  darfVerwalten: boolean;
}

/**
 * Die geltenden Achsen in Menü-Reihenfolge. Nie leer — Gruppierung und Dichte
 * gibt es immer.
 *
 * `standard` ist der TATSÄCHLICHE Startwert der Seite, nicht die erste Option:
 * die Dichte startet auf „Kompakt" (`useBoardAnsicht`), und mit `DICHTE_OPTIONEN[0]`
 * als Standard stünde dauerhaft „Darstellung: Kompakt" am Knopf, obwohl niemand
 * etwas verstellt hat.
 */
export function baueBoardAchsen(e: BoardDarstellung): DarstellungAchse<BoardAchseId>[] {
  const achsen: DarstellungAchse<BoardAchseId>[] = [
    {
      id: 'gruppierung',
      label: 'Gruppierung',
      hinweis: 'Bänder quer zur Statusachse',
      options: GRUPPIER_ACHSEN,
      value: e.gruppierung,
      standard: 'keine',
    },
    {
      id: 'dichte',
      label: 'Dichte',
      hinweis: 'Wie viel eine Karte zeigt',
      options: DICHTE_OPTIONEN.map(o => ({ key: dichteNachAussen(o.key), label: o.label })),
      value: dichteNachAussen(e.dichte),
      standard: 'dicht',
    },
  ];
  if (e.darfVerwalten) {
    achsen.push({
      id: 'archiv',
      label: 'Archivierte',
      hinweis: 'Archivierte Tickets in der Liste',
      options: [
        { key: 'aus', label: 'ausgeblendet' },
        { key: 'ein', label: 'eingeblendet' },
      ],
      value: e.zeigeArchiv ? 'ein' : 'aus',
      standard: 'aus',
    });
  }
  return achsen;
}
