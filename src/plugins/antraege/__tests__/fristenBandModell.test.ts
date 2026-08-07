/**
 * Das Anzeigemodell des FristenBands.
 *
 * Die tragende Zusage ist eine **Nicht**-Zusage: das Modell rechnet nichts nach.
 * Der erste Test setzt deshalb ein absichtlich widersprüchliches `tageRest` und
 * prüft, dass die Anzeige ihm folgt — ein Modell, das selbst rechnete, würde
 * hier „richtig" antworten und damit die zweite Ableitung sein.
 */
import { describe, expect, it } from 'vitest';
import type { FristErgebnis } from '@/core/services/csv/frist-ergebnis';
import type { FristBezug } from '@/core/status/frist-bezug';
import type { VerbundMeilensteine } from '@/core/meilensteine/typen';
import { FRIST_AMPEL_STUFEN, fristAmpelFromDays } from '../fristAnzeige';
import { baueFristenBandModell, MEILENSTEIN_SPITZE } from '../fristen-band/fristenBandModell';

const STICHTAG = '2026-08-07';

function bezug(e: FristErgebnis, o: Partial<FristBezug> = {}): FristBezug {
  return {
    ergebnis: e,
    antragsdatum: '2026-05-01', alleAntraegeDa: null, vnEingangDatum: null,
    halt: null, bezugsZeitpunkt: e.bezugsZeitpunkt ?? STICHTAG, ...o,
  };
}

const LAEUFT: FristErgebnis = {
  zustand: 'laeuft', basisFeld: 'D_AAE', basisDatum: '2026-05-01',
  zielDatum: '2026-09-02', bezugsZeitpunkt: STICHTAG, tageRest: 26,
  haltedatumQuelle: 'unbekannt',
};
const ANGEHALTEN: FristErgebnis = {
  zustand: 'angehalten', bezugsZeitpunkt: '2019-06-02', haltedatumQuelle: 'verlauf_bedingt',
};
const OHNE: FristErgebnis = {
  zustand: 'nicht_berechenbar', grund: 'kein Eingangsdatum in D_AAE/D_XTE',
  haltedatumQuelle: 'unbekannt',
};

const eingabe = (e: FristErgebnis, o: Partial<FristBezug> = {}) => ({
  bezug: bezug(e, o), stichtag: STICHTAG, zieltage: null,
  waechter: null, meilensteine: null,
});

describe('Das Modell rechnet nichts nach', () => {
  it('folgt einem manipulierten Restwert, statt ihn zu korrigieren', () => {
    const m = baueFristenBandModell(eingabe({ ...LAEUFT, tageRest: 999 }));
    expect(m.kopf).toBe('noch 999 T');
  });

  it('folgt einer manipulierten Ampel-Grundlage', () => {
    const m = baueFristenBandModell(eingabe({ ...LAEUFT, tageRest: -3 }));
    expect(m.ampel).toBe('rot');
  });
});

describe('Jeder Zustand in seiner eigenen Sprache', () => {
  it('nennt die Restzeit, solange die Uhr läuft', () => {
    expect(baueFristenBandModell(eingabe(LAEUFT)).kopf).toBe('noch 26 T');
  });

  it('sagt „über" statt eines Minuszeichens', () => {
    // „-12 T" liest sich als Rechenfehler, „12 T über" als Zustand.
    expect(baueFristenBandModell(eingabe({ ...LAEUFT, tageRest: -12 })).kopf).toBe('12 T über');
  });

  it('nennt bei angehaltener Uhr die Standzeit', () => {
    expect(baueFristenBandModell(eingabe(ANGEHALTEN)).kopf).toMatch(/\d+ T angehalten/);
  });

  it('nennt bei nicht_berechenbar den Grund im Klartext, nicht nur einen Strich', () => {
    const m = baueFristenBandModell(eingabe(OHNE));
    expect(m.kopf).toBe('—');
    expect(m.grund).toBe('kein Eingangsdatum in D_AAE/D_XTE');
    // Bei laufender Uhr steht dort nichts — ein Grund ohne Anlass wäre Rauschen.
    expect(baueFristenBandModell(eingabe(LAEUFT)).grund).toBeNull();
  });
});

describe('Das Basisfeld ist sichtbar', () => {
  it('nennt das gewinnende Eingangsdatum und markiert das andere als weich', () => {
    const m = baueFristenBandModell(eingabe(
      { ...LAEUFT, basisFeld: 'D_XTE', basisDatum: '2026-06-10' },
      { alleAntraegeDa: '2026-06-10' },
    ));
    const massgeblich = m.zeilen.find(z => z.label === 'Maßgeblich');
    expect(massgeblich?.wert).toBe('2026-06-10');
    expect(massgeblich?.hinweis).toContain('D_XTE');
    expect(m.zeilen.find(z => z.label === 'Antragseingang')?.weich).toBe(true);
    expect(m.zeilen.find(z => z.label === 'Alle Anträge da')?.weich).toBeUndefined();
  });

  it('sagt, warum D_XTE fehlt, statt es wegzulassen', () => {
    const m = baueFristenBandModell(eingabe(LAEUFT));
    expect(m.zeilen.find(z => z.label === 'Alle Anträge da')?.hinweis)
      .toBe('D_XTE nicht gesetzt oder nicht gemappt');
  });
});

describe('Das Haltedatum trägt seine Quelle', () => {
  it('nennt eine bedingte Kante als hergeleitet', () => {
    const m = baueFristenBandModell(eingabe(ANGEHALTEN, {
      halt: { tag: '2019-06-02', herkunft: 'verlauf_bedingt' },
    }));
    const z = m.zeilen.find(x => x.label === 'Haltedatum');
    expect(z?.wert).toBe('2019-06-02');
    expect(z?.hinweis).toContain('bedingt');
    expect(z?.weich).toBe(true);
  });

  it('setzt eine bestätigte Kante NICHT weich', () => {
    const m = baueFristenBandModell(eingabe(ANGEHALTEN, {
      halt: { tag: '2019-06-02', herkunft: 'verlauf_bestaetigt' },
    }));
    expect(m.zeilen.find(x => x.label === 'Haltedatum')?.weich).toBeUndefined();
  });

  it('sagt „nicht geraten", wo keine Quelle antwortet', () => {
    const m = baueFristenBandModell(eingabe(ANGEHALTEN));
    const z = m.zeilen.find(x => x.label === 'Haltedatum');
    expect(z?.wert).toBe('unbekannt');
    expect(z?.hinweis).toContain('nicht geraten');
  });

  it('zeigt die Zeile nur bei angehaltener Uhr', () => {
    expect(baueFristenBandModell(eingabe(LAEUFT)).zeilen.some(z => z.label === 'Haltedatum'))
      .toBe(false);
  });
});

describe('Zieltage', () => {
  it('sagt, wenn keine gepflegt sind — statt eine Null zu zeigen', () => {
    const z = baueFristenBandModell(eingabe(LAEUFT)).zeilen
      .find(x => x.label === 'Zieltage des Schritts');
    expect(z?.wert).toBe('—');
    expect(z?.hinweis).toContain('keine gepflegt');
    expect(z?.weich).toBe(true);
  });

  it('nennt sie, wo der Katalog welche führt', () => {
    const m = baueFristenBandModell({ ...eingabe(LAEUFT), zieltage: 21 });
    expect(m.zeilen.find(x => x.label === 'Zieltage des Schritts')?.wert).toBe('21 T');
  });
});

describe('Die Achse', () => {
  it('setzt Basis, Bezugszeitpunkt und Ziel proportional', () => {
    const m = baueFristenBandModell(eingabe(LAEUFT));
    expect(m.marken.map(x => x.art)).toEqual(['basis', 'bezug', 'ziel']);
    expect(m.marken[0]!.anteil).toBe(0);
    expect(m.marken[2]!.anteil).toBe(1);
    expect(m.marken[1]!.anteil).toBeGreaterThan(0);
    expect(m.marken[1]!.anteil).toBeLessThan(1);
  });

  it('zeichnet nichts, wo es keine Spanne gibt', () => {
    expect(baueFristenBandModell(eingabe(ANGEHALTEN)).marken).toEqual([]);
    expect(baueFristenBandModell(eingabe(OHNE)).marken).toEqual([]);
  });
});

describe('Die Punktfarbe wird hergeleitet, nicht behauptet', () => {
  it('nennt alle Stufen und die getroffene', () => {
    const m = baueFristenBandModell(eingabe(LAEUFT));
    for (const s of FRIST_AMPEL_STUFEN) expect(m.ampelErklaerung).toContain(s.text);
    expect(m.ampelErklaerung).toContain('gelb');
    expect(m.ampelErklaerung).toContain('26 T');
    // Die Stufe steht als WORT da, nicht als Enum-Wert.
    expect(m.ampelErklaerung).toContain('grün');
    expect(m.ampelErklaerung).not.toContain('gruen');
  });

  it('erklärt auch, warum gar kein Punkt da ist', () => {
    expect(baueFristenBandModell(eingabe(ANGEHALTEN)).ampelErklaerung).toContain('Kein Punkt');
    expect(baueFristenBandModell(eingabe(ANGEHALTEN)).ampel).toBeNull();
  });

  it('deckt sich mit der Funktion, die den Punkt wirklich färbt', () => {
    // Tabelle gegen Funktion, nicht gegen Literale: liefe eine der beiden
    // auseinander, erklärte das Band einen Punkt, den es nicht gibt.
    for (const d of [-5, -1, 0, 14, 15, 30, 31, 400]) {
      const treffer = FRIST_AMPEL_STUFEN.find(s => d <= s.bis);
      expect(treffer?.ampel, `${d} T`).toBe(fristAmpelFromDays(d));
    }
  });
});

describe('Meilensteine', () => {
  const mst = (id: string, zustand: 'gerissen' | 'faellig' | 'offen' | 'erreicht', soll: string) => ({
    knotenId: id, zustand, sollDatum: soll, istDatum: null, abweichungTage: null,
  });
  const bewertung = {
    verbundId: 'VB1', antragsdatum: '2026-05-01', typ: null, wocheAktuell: 5,
    fristDatum: '2026-10-05', restTage: 59, prognose: 'gefaehrdet',
    ergebnisse: [
      mst('a', 'gerissen', '2026-06-01'),
      mst('b', 'gerissen', '2026-05-15'),
      mst('c', 'faellig', '2026-08-10'),
      mst('d', 'offen', '2026-08-20'),
      mst('e', 'offen', '2026-09-01'),
      mst('f', 'offen', '2026-09-20'),
      mst('g', 'erreicht', '2026-05-05'),
    ],
  } as unknown as VerbundMeilensteine;

  it('führt JEDES gerissene, aber nur die nächsten kommenden', () => {
    // Ein gerissener Meilenstein ist der Grund, warum jemand hinschaut — ihn
    // zu deckeln hiesse, den wichtigsten wegzulassen.
    const m = baueFristenBandModell({ ...eingabe(LAEUFT), meilensteine: bewertung });
    expect(m.verstrichen.map(x => x.knotenId)).toEqual(['b', 'a']);
    expect(m.kommend).toHaveLength(MEILENSTEIN_SPITZE);
    expect(m.kommend.map(x => x.knotenId)).toEqual(['c', 'd', 'e']);
  });

  it('bleibt leer ohne Bewertung', () => {
    const m = baueFristenBandModell(eingabe(LAEUFT));
    expect(m.kommend).toEqual([]);
    expect(m.verstrichen).toEqual([]);
  });
});
