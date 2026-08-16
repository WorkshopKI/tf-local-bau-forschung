import { describe, it, expect } from 'vitest';
import {
  baueDarstellungsAchsen,
  darstellungsZusammenfassung,
  schalterAn,
  type DarstellungEingabe,
} from '../darstellungsAchsen';
import { TABLE_GROUPING_OPTIONS, TABLE_ANSICHT_OPTIONS } from '../tableGrouping';
import {
  GROUPING_OPTIONS, SORT_OPTIONS, DEFAULT_SORT_BY_VIEW, getSortOptionsForView,
} from '../sort';
import type { ViewKey } from '../views';
import { ARBEITSVORRAT_LABEL, BEENDET_ACHSE_LABEL } from '../arbeitsvorrat';
import { DEFAULT_VISIBLE_COLUMN_KEYS } from '../tableColumns';
import { DEFAULT_DICHTE } from '../useDichteStore';

/** Alles auf Standard, Tabellen-Ansicht im „Alle"-Reiter — also der Zustand mit
 *  allen sechs Achsen. */
const STANDARD: DarstellungEingabe = {
  viewMode: 'compact',
  activeView: 'alle',
  tableAnsicht: 'antrag',
  tableGruppierung: 'none',
  listGruppierung: 'none',
  sortierung: DEFAULT_SORT_BY_VIEW.alle,
  // Werkseinstellung = Profil „Standard"; die Profil-Achse weicht also nicht ab.
  sichtbareSpalten: DEFAULT_VISIBLE_COLUMN_KEYS,
  dichte: DEFAULT_DICHTE,
  beendetAusgeblendet: true,
};

describe('welche Achsen gelten', () => {
  it('Tabelle im „Alle"-Reiter: alle sechs, in Menü-Reihenfolge', () => {
    // Spaltensatz und Zeilendichte stehen nebeneinander: beide sind reine
    // Anzeige-Achsen der Tabelle und gelten unter genau derselben Bedingung.
    expect(baueDarstellungsAchsen(STANDARD).map(a => a.id))
      .toEqual(['ansichtsform', 'ansicht', 'gruppierung', 'spalten', 'dichte', 'beendet']);
  });

  it('die Ansichtsform steht IMMER und ganz oben — sie bestimmt, was darunter gilt', () => {
    for (const viewMode of ['list', 'compact', 'cards'] as const) {
      for (const activeView of ['alle', 'meine_offenen'] as const) {
        expect(baueDarstellungsAchsen({ ...STANDARD, viewMode, activeView })[0]?.id)
          .toBe('ansichtsform');
      }
    }
  });

  it('die Tabelle ist der Standard — sie meldet sich nicht als Abweichung', () => {
    // Der Knopf trägt die erste Abweichung. Stünde `list` als Standard, hätte er
    // bei fast jedem dauerhaft „Tabelle" angezeigt (v4.64).
    const achse = baueDarstellungsAchsen(STANDARD)[0];
    expect(achse?.value).toBe(achse?.standard);
    expect(darstellungsZusammenfassung(baueDarstellungsAchsen(STANDARD)).text).toBe('');
    // Die Sonderfälle melden sich sehr wohl.
    expect(darstellungsZusammenfassung(
      baueDarstellungsAchsen({ ...STANDARD, viewMode: 'list' }),
    ).text).toBe('Liste');
  });

  it('Zeilen-Körnung nur in der Tabelle — Liste und Karten verdichten nicht', () => {
    expect(baueDarstellungsAchsen({ ...STANDARD, viewMode: 'list' }).map(a => a.id))
      .toEqual(['ansichtsform', 'gruppierung', 'sortierung', 'beendet']);
    // Karten kannten den Beendet-Split noch nie.
    expect(baueDarstellungsAchsen({ ...STANDARD, viewMode: 'cards' }).map(a => a.id))
      .toEqual(['ansichtsform', 'gruppierung', 'sortierung']);
  });

  it('die Sortierung gilt NUR ausserhalb der Tabelle — dort sortieren die Spaltenköpfe', () => {
    // Zwei Griffe für dieselbe Sache wären zwei Wahrheiten; in der Tabelle
    // gewinnt der Spaltenkopf, weil er am sortierten Ding steht.
    expect(baueDarstellungsAchsen(STANDARD).map(a => a.id)).not.toContain('sortierung');
    for (const viewMode of ['list', 'cards'] as const) {
      expect(baueDarstellungsAchsen({ ...STANDARD, viewMode }).map(a => a.id))
        .toContain('sortierung');
    }
  });

  it('Beendet nur im „Alle"-Reiter — anderswo steht praktisch nichts Terminales', () => {
    expect(baueDarstellungsAchsen({ ...STANDARD, activeView: 'meine_offenen' }).map(a => a.id))
      .toEqual(['ansichtsform', 'ansicht', 'gruppierung', 'spalten', 'dichte']);
  });

  it('die Fristen-Sicht bringt ihre Staffelung als STANDARD mit, nicht als Abweichung', () => {
    // Sonst meldete der Knopf dort dauerhaft „Gruppierung: Frist" — eine Meldung
    // über den Normalfall (dieselbe Falle wie die Ansichtsform in v4.64).
    const achsen = baueDarstellungsAchsen({
      ...STANDARD, activeView: 'fristen', tableGruppierung: 'frist',
      sortierung: DEFAULT_SORT_BY_VIEW.fristen,
    });
    expect(achsen.find(a => a.id === 'gruppierung')!.standard).toBe('frist');
    expect(darstellungsZusammenfassung(achsen).text).toBe('');
    // Und wer dort flach stellt, sieht das sehr wohl am Knopf.
    expect(darstellungsZusammenfassung(baueDarstellungsAchsen({
      ...STANDARD, activeView: 'fristen', tableGruppierung: 'none',
      sortierung: DEFAULT_SORT_BY_VIEW.fristen,
    })).text).toBe('Keine');
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

/** Übernommen aus `sortSeg.test.ts`, das mit der „Sortiert nach"-Pille entfallen
 *  ist (v4.65). Der Defekt, den es hielt, ist derselbe geblieben: eine
 *  Sortierung, die WIRKT, aber in der Liste der wählbaren Werte fehlt — dann
 *  steht das Menü auf nichts und der wirksame Schlüssel ist nicht mehr
 *  anwählbar. */
describe('Sortier-Achse — Anzeige und Wirkung können nicht auseinanderlaufen', () => {
  const ALLE_VIEWS: ViewKey[] = ['meine_offenen', 'fristen', 'begleitung', 'alle'];

  it('die Sicht-Vorgabe ist in JEDER Sicht ein wählbarer Wert', () => {
    for (const activeView of ALLE_VIEWS) {
      const vorgabe = DEFAULT_SORT_BY_VIEW[activeView];
      expect(getSortOptionsForView(activeView).map(o => o.key), `Sicht ${activeView}`)
        .toContain(vorgabe);
      const achse = baueDarstellungsAchsen({
        ...STANDARD, viewMode: 'list', activeView, sortierung: vorgabe,
      }).find(a => a.id === 'sortierung')!;
      expect(achse.value).toBe(achse.standard);
    }
  });

  it('jeder für die Sicht erlaubte Schlüssel ist auch ein Segment', () => {
    for (const activeView of ALLE_VIEWS) {
      for (const option of getSortOptionsForView(activeView)) {
        const achse = baueDarstellungsAchsen({
          ...STANDARD, viewMode: 'list', activeView, sortierung: option.key,
        }).find(a => a.id === 'sortierung')!;
        expect(achse.options.map(o => o.key), `${activeView}/${option.key}`).toContain(achse.value);
      }
    }
  });

  it('Bewilligungs-Sortierungen nur dort, wo Bewilligtes regelmäßig vorkommt', () => {
    const keys = baueDarstellungsAchsen({
      ...STANDARD, viewMode: 'list', activeView: 'meine_offenen', sortierung: 'frist_asc',
    }).find(a => a.id === 'sortierung')!.options.map(o => o.key);
    expect(keys).not.toContain('bewilligung_desc');
    expect(keys).not.toContain('bewilligung_asc');
    expect(keys).toContain('frist_asc');
    expect(baueDarstellungsAchsen({
      ...STANDARD, viewMode: 'list', activeView: 'alle',
    }).find(a => a.id === 'sortierung')!.options).toHaveLength(SORT_OPTIONS.length);
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
