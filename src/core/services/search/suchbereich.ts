/**
 * „Suchen in" — worin die Suche überhaupt nachsieht.
 *
 * Der Korpus hält die Antragsfelder ohnehin getrennt vor
 * ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts)); die
 * Beschränkung ist damit eine Whitelist, kein Eingriff in einen Index.
 *
 * Wozu das gut ist, zeigt der Handoff an einem echten Fall: „Standards" findet
 * die „HPC Standards GmbH" — ein Treffer im Firmennamen, nicht im Thema. Wer
 * fachlich sucht, will die Einrichtung ausschließen können.
 *
 * Rein — kein React, kein IDB.
 */
import type { Trefferfeld } from './trefferstelle';

export type Suchbereich = 'alles' | 'inhalt' | 'dokumente' | 'einrichtung';

export const SUCHBEREICH_LABEL: Record<Suchbereich, string> = {
  alles: 'Titel, Beschreibung, Dokumente',
  inhalt: 'nur Titel & Kurzbeschreibung',
  dokumente: 'nur Dokumente',
  einrichtung: 'nur Einrichtung & Ort',
};

/**
 * Welche Antragsfelder die Wortlaut-Stufe prüft.
 *
 * Akronym und Aktenzeichen gehören zu den INHALTLICHEN Bereichen, weil sie die
 * Identität eines Vorhabens sind: wer ein FKZ eintippt, meint dieses Vorhaben,
 * egal welchen Bereich er eingestellt hat. In „nur Einrichtung & Ort" haben sie
 * nichts zu suchen — dort ist die Frage „wer" und „wo", nicht „welches".
 *
 * `dokumente` liefert eine LEERE Menge: die Wortlaut-Stufe trägt dann nichts
 * bei, alle Treffer kommen aus dem Dokumentenindex. Sonst stünde unter „nur
 * Dokumente" ein Antrag, der über sein Akronym gefunden wurde.
 */
export function bereichFelder(bereich: Suchbereich): ReadonlySet<Trefferfeld> {
  switch (bereich) {
    case 'inhalt':
      return new Set<Trefferfeld>(['titel', 'kurzbeschreibung', 'akronym', 'aktenzeichen']);
    case 'einrichtung':
      return new Set<Trefferfeld>(['organisation', 'standort']);
    case 'dokumente':
      return new Set<Trefferfeld>();
    case 'alles':
    default:
      return new Set<Trefferfeld>([
        'titel', 'kurzbeschreibung', 'deskriptoren',
        'akronym', 'aktenzeichen', 'organisation', 'standort',
      ]);
  }
}

/** Wird der Dokumentenindex befragt? In den reinen Stammdaten-Bereichen nicht —
 *  sonst käme unter „nur Einrichtung & Ort" ein Vorhabensbeschreibungs-Treffer. */
export function bereichNutztDokumente(bereich: Suchbereich): boolean {
  return bereich === 'alles' || bereich === 'dokumente';
}

/** Toleranter Leser für die Persistenz. */
export function parseSuchbereich(roh: string | null): Suchbereich {
  if (roh === 'inhalt' || roh === 'dokumente' || roh === 'einrichtung') return roh;
  return 'alles';
}
