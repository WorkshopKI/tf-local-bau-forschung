import { describe, it, expect } from 'vitest';
import {
  baueDarstellungsAchsen,
  darstellungsZusammenfassung,
  schalterAn,
  type DarstellungEingabe,
} from '../darstellungsAchsen';
import { TABLE_GROUPING_OPTIONS, TABLE_ANSICHT_OPTIONS } from '../tableGrouping';
import { GROUPING_OPTIONS } from '../sort';
import { ARBEITSVORRAT_LABEL, BEENDET_ACHSE_LABEL } from '../arbeitsvorrat';
import { DEFAULT_VISIBLE_COLUMN_KEYS } from '../tableColumns';
import { DEFAULT_DICHTE } from '../useDichteStore';

/** Alles auf Standard, Tabellen-Ansicht im „Alle"-Reiter — also der Zustand mit
 *  allen fünf Achsen. */
const STANDARD: DarstellungEingabe = {
  viewMode: 'compact',
  activeView: 'alle',
  tableAnsicht: 'antrag',
  tableGruppierung: 'none',
  listGruppierung: 'none',
  // Werkseinstellung = Profil „Standard"; die Profil-Achse weicht also nicht ab.
  sichtbareSpalten: DEFAULT_VISIBLE_COLUMN_KEYS,
  dichte: DEFAULT_DICHTE,
  beendetAusgeblendet: true,
};

describe('welche Achsen gelten', () => {
  it('Tabelle im „Alle"-Reiter: alle fünf, in Menü-Reihenfolge', () => {
    // Spaltensatz und Zeilendichte stehen nebeneinander: beide sind reine
    // Anzeige-Achsen der Tabelle und gelten unter genau derselben Bedingung.
    expect(baueDarstellungsAchsen(STANDARD).map(a => a.id))
      .toEqual(['ansicht', 'gruppierung', 'spalten', 'dichte', 'beendet']);
  });

  it('Zeilen-Körnung nur in der Tabelle — Liste und Karten verdichten nicht', () => {
    expect(baueDarstellungsAchsen({ ...STANDARD, viewMode: 'list' }).map(a => a.id))
      .toEqual(['gruppierung', 'beendet']);
    // Karten kannten den Beendet-Split noch nie.
    expect(baueDarstellungsAchsen({ ...STANDARD, viewMode: 'cards' }).map(a => a.id))
      .toEqual(['gruppierung']);
  });

  it('Beendet nur im „Alle"-Reiter — anderswo steht praktisch nichts Terminales', () => {
    expect(baueDarstellungsAchsen({ ...STANDARD, activeView: 'meine_offenen' }).map(a => a.id))
      .toEqual(['ansicht', 'gruppierung', 'spalten', 'dichte']);
  });

  it('liefert nie eine leere Liste — die Gruppierung gibt es in jeder Ansicht', () => {
    for (const viewMode of ['list', 'compact', 'cards'] as const) {
      for (const activeView of ['alle', 'meine_offenen'] as const) {
        expect(baueDarstellungsAchsen({ ...STANDARD, viewMode, activeView }).length)
          .toBeGreaterThan(0);
      }
    }
  });
});

describe('Optionen kommen aus der bestehenden Quelle', () => {
  it('nutzt dieselben Listen wie die Persistenz — keine zweite Aufzählung', () => {
    const achsen = baueDarstellungsAchsen(STANDARD);
    expect(achsen.find(a => a.id === 'ansicht')!.options).toBe(TABLE_ANSICHT_OPTIONS);
    expect(achsen.find(a => a.id === 'gruppierung')!.options).toBe(TABLE_GROUPING_OPTIONS);
  });

  it('die Gruppierung der Liste hat ihre eigene, größere Options-Liste', () => {
    const achsen = baueDarstellungsAchsen({ ...STANDARD, viewMode: 'list' });
    expect(achsen.find(a => a.id === 'gruppierung')!.options).toBe(GROUPING_OPTIONS);
  });

  it('beschriftet die Beendet-Achse aus dem Aggregatnamen, nicht mit einem Literal', () => {
    const beendet = baueDarstellungsAchsen(STANDARD).find(a => a.id === 'beendet')!;
    expect(beendet.label).toBe(BEENDET_ACHSE_LABEL);
    // Die Zeile braucht ein Verb („… zeigen"), bleibt aber an den Aggregatnamen
    // gebunden: wird der umbenannt, fällt hier die Beugung auf.
    expect(BEENDET_ACHSE_LABEL.startsWith(ARBEITSVORRAT_LABEL.archiv)).toBe(true);
    expect(BEENDET_ACHSE_LABEL).toBe('Beendete zeigen');
  });

  it('deklariert je Achse die Bedienform — geraten wird nichts', () => {
    const achsen = baueDarstellungsAchsen(STANDARD);
    // „Antrag / Antrag mit TV" ist zweiwertig und trotzdem KEIN Schalter.
    expect(achsen.find(a => a.id === 'ansicht')!.art).toBe('segment');
    expect(achsen.find(a => a.id === 'gruppierung')!.art).toBe('segment');
    expect(achsen.find(a => a.id === 'spalten')!.art).toBe('segment');
    expect(achsen.find(a => a.id === 'dichte')!.art).toBe('segment');
    expect(achsen.find(a => a.id === 'beendet')!.art).toBe('schalter');
  });

  it('schaltet die Beendet-Achse in die richtige Richtung', () => {
    // Der Menü-Schlüssel `aus` heißt „ausgeblendet" — ein aus der Reihenfolge
    // geratener Schalter stünde also genau verkehrt herum.
    const aus = baueDarstellungsAchsen(STANDARD).find(a => a.id === 'beendet')!;
    expect(schalterAn(aus)).toBe(false);
    const ein = baueDarstellungsAchsen({ ...STANDARD, beendetAusgeblendet: false })
      .find(a => a.id === 'beendet')!;
    expect(schalterAn(ein)).toBe(true);
  });

  it('jede Achse steht auf einem Wert, den ihre Options-Liste kennt', () => {
    for (const a of baueDarstellungsAchsen(STANDARD)) {
      expect(a.options.map(o => o.key)).toContain(a.value);
      expect(a.options.map(o => o.key)).toContain(a.standard);
    }
  });
});

describe('Zusammenfassung am Knopf', () => {
  it('ist leer, solange alles auf Standard steht', () => {
    expect(darstellungsZusammenfassung(baueDarstellungsAchsen(STANDARD)))
      .toEqual({ text: '', weitere: 0 });
  });

  it('nennt die abweichende Achse mit ihrem Anzeige-Label', () => {
    const achsen = baueDarstellungsAchsen({ ...STANDARD, tableAnsicht: 'antrag-mit-tv' });
    expect(darstellungsZusammenfassung(achsen)).toEqual({ text: 'Antrag mit TV', weitere: 0 });
  });

  it('schreibt bei mehreren Abweichungen nur die erste aus und zählt den Rest', () => {
    const achsen = baueDarstellungsAchsen({
      ...STANDARD,
      tableAnsicht: 'antrag-mit-tv',
      tableGruppierung: 'status',
      beendetAusgeblendet: false,
    });
    expect(darstellungsZusammenfassung(achsen)).toEqual({ text: 'Antrag mit TV', weitere: 2 });
  });

  it('eine unbekannte (z.B. veraltete) Wahl fällt auf ihren Schlüssel zurück statt zu verschwinden', () => {
    const achsen = baueDarstellungsAchsen({ ...STANDARD, tableGruppierung: 'verbund' });
    expect(darstellungsZusammenfassung(achsen)).toEqual({ text: 'verbund', weitere: 0 });
  });

  it('zählt die Beendet-Achse nur, wo es sie gibt', () => {
    // Eingeblendetes Beendet weicht ab — aber im Reiter „Meine offenen" gibt es
    // die Achse gar nicht, also darf sie den Knopf nicht beschriften.
    const achsen = baueDarstellungsAchsen({
      ...STANDARD,
      activeView: 'meine_offenen',
      beendetAusgeblendet: false,
    });
    expect(darstellungsZusammenfassung(achsen)).toEqual({ text: '', weitere: 0 });
  });
});
