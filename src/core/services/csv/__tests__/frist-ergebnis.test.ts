/**
 * Der Frist-Zustand gegen eine **von Hand hingeschriebene** Wahrheitstabelle.
 *
 * Bewusst nicht aus der Ableitung berechnet: ein Test, der dieselbe Regel noch
 * einmal ausführt, prüft nur sich selbst (dieselbe Regel wie in
 * `kategorie-ableitung.test.ts`).
 *
 * Der Kern der Suite sind die drei Fälle, die es vorher NICHT gab: eine
 * angehaltene Uhr mit Haltedatum, eine ohne, und ein „nicht berechenbar" mit
 * Grund. Vorher waren alle drei dieselbe leere Zelle.
 */
import { describe, it, expect } from 'vitest';
import { berechneFrist, FRIST_GRUND } from '../frist-ergebnis';
import { resetZahPhasenSnapshotFuerTests } from '@/core/status/zah-phasen';

/** Fixer Stichtag — die Suite darf nie von der Uhr abhängen. */
const HEUTE = '2026-08-06T00:00:00.000Z';

/**
 * Rohstatus, deren ZAH-Phase im Auslieferungs-Schnitt feststeht. Sie sind der
 * Eingang in die Ableitung — jede Zeile nennt Code und Phase, damit man beim
 * Lesen nicht nachschlagen muss.
 */
const STATUS = {
  /** 31 · Eingang · Uhr läuft */
  beantragt: 'beantragt',
  /** 35 · Vollständigkeit · Uhr läuft */
  nfGestellt: 'NF gestellt',
  /** 38 · Prüfung · Uhr läuft */
  technGeprueft: 'techn geprüft',
  /** 51 · Entscheidung · Uhr steht */
  bewilligungsreif: 'bewilligungsreif',
  /** 70 · Entscheidung · Uhr steht */
  ablehnung: 'Ablehnung',
  /** 59 · Begleitung · eigene VN-Uhr */
  bewilligt: 'bewilligt',
  /** 92 · Begleitung · eigene VN-Uhr */
  vnGeprueft: 'VN geprüft',
  /** 99 · Abgeschlossen · terminal */
  schlussvermerk: 'Schlussvermerk',
  /** 90 · Abgeschlossen · terminal */
  abgelehnt: 'abgelehnt/zurückgezogen',
  /** 29 · Marker, ohne Phase */
  irrlaeufer: 'Irrläufer',
} as const;

describe('berechneFrist — die Uhr läuft', () => {
  // Kein Snapshot gesetzt ⇒ Seed gilt. Explizit, weil das Register modul-global
  // ist und eine fremde Suite es gesetzt haben könnte.
  resetZahPhasenSnapshotFuerTests();

  it('rechnet in der Antragsphase Eingang + 90 Tage', () => {
    // 2026-05-01 + 90 T = 2026-07-30, Stichtag 2026-08-06 ⇒ 7 Tage über.
    const r = berechneFrist({
      status: STATUS.beantragt, antragsdatum: '2026-05-01T00:00:00.000Z', stichtag: HEUTE,
    });
    expect(r.zustand).toBe('laeuft');
    expect(r.zielDatum?.slice(0, 10)).toBe('2026-07-30');
    expect(r.tageRest).toBe(-7);
    expect(r.basisFeld).toBe('D_AAE');
    expect(r.bezugsZeitpunkt).toBe(HEUTE);
  });

  it('läuft in Vollständigkeit und Prüfung ebenfalls', () => {
    for (const s of [STATUS.nfGestellt, STATUS.technGeprueft]) {
      const r = berechneFrist({
        status: s, antragsdatum: '2026-07-01T00:00:00.000Z', stichtag: HEUTE,
      });
      expect(r.zustand, s).toBe('laeuft');
    }
  });

  it('nimmt „alle Anträge da" als Basis, wenn es später liegt — und sagt das', () => {
    const r = berechneFrist({
      status: STATUS.beantragt,
      antragsdatum: '2026-03-01T00:00:00.000Z',
      alleAntraegeDa: '2026-06-01T00:00:00.000Z',
      stichtag: HEUTE,
    });
    expect(r.basisFeld).toBe('D_XTE');
    expect(r.basisDatum?.slice(0, 10)).toBe('2026-06-01');
    // 01.06. + 90 T = 30.08. ⇒ noch 24 Tage.
    expect(r.tageRest).toBe(24);
  });

  it('bleibt bei D_AAE, wenn der Antragseingang der spätere ist', () => {
    const r = berechneFrist({
      status: STATUS.beantragt,
      antragsdatum: '2026-06-01T00:00:00.000Z',
      alleAntraegeDa: '2026-03-01T00:00:00.000Z',
      stichtag: HEUTE,
    });
    expect(r.basisFeld).toBe('D_AAE');
    expect(r.basisDatum?.slice(0, 10)).toBe('2026-06-01');
  });

  it('nennt bei gleichem Datum D_AAE — das ist die ursprüngliche Basis', () => {
    const r = berechneFrist({
      status: STATUS.beantragt,
      antragsdatum: '2026-06-01T00:00:00.000Z',
      alleAntraegeDa: '2026-06-01T00:00:00.000Z',
      stichtag: HEUTE,
    });
    expect(r.basisFeld).toBe('D_AAE');
  });
});

describe('berechneFrist — die Begleitphase hat ihre eigene Uhr', () => {
  it('rechnet VN-Eingang + 6 Monate', () => {
    const r = berechneFrist({
      status: STATUS.vnGeprueft,
      antragsdatum: '2019-01-01T00:00:00.000Z',
      vnEingangDatum: '2026-05-06T00:00:00.000Z',
      stichtag: HEUTE,
    });
    expect(r.zustand).toBe('laeuft');
    expect(r.zielDatum?.slice(0, 10)).toBe('2026-11-06');
    expect(r.tageRest).toBe(92);
  });

  it('ignoriert das Antragsdatum vollständig — die 90-Tage-Uhr gilt dort nicht', () => {
    const r = berechneFrist({
      status: STATUS.vnGeprueft,
      antragsdatum: '2018-10-17T00:00:00.000Z',
      vnEingangDatum: '2026-07-01T00:00:00.000Z',
      stichtag: HEUTE,
    });
    expect(r.basisDatum?.slice(0, 10)).toBe('2026-07-01');
  });

  it('ohne Verwendungsnachweis: nicht berechenbar mit EIGENEM Grund', () => {
    const r = berechneFrist({
      status: STATUS.vnGeprueft, antragsdatum: '2019-01-01T00:00:00.000Z', stichtag: HEUTE,
    });
    // Nicht „angehalten": es fehlt die Grundlage, nicht die Zuständigkeit.
    expect(r.zustand).toBe('nicht_berechenbar');
    expect(r.grund).toBe(FRIST_GRUND.ohneVnEingang);
    expect(r.tageRest).toBeUndefined();
  });

  it('„bewilligt" selbst gehört NICHT dazu — dort läuft gar keine Uhr', () => {
    // Code 59 liegt in der Phase „Begleitung", zählt aber zur Arbeitsliste
    // `bewilligt` und nicht zu `begleitung` (die Kategorie schneidet feiner als
    // die Phase, `kategorie-ableitung.ts`). Fachlich ist genau das richtig:
    // zwischen Bewilligung und Eingang des Verwendungsnachweises läuft keine
    // Frist — die Antragsfrist ist vorbei, die VN-Frist hat nicht begonnen.
    const r = berechneFrist({
      status: STATUS.bewilligt, antragsdatum: '2018-10-17T00:00:00.000Z', stichtag: HEUTE,
    });
    expect(r.zustand).toBe('angehalten');
  });

  it('ein VN-Datum an einem „bewilligt"-Satz startet die Uhr NICHT', () => {
    // Der Status hinkt hier den Daten hinterher. Die App leitet keinen Status
    // ab (Pitfall #44) — sie erfindet deshalb auch keinen Phasenwechsel, den
    // C16 nicht gemeldet hat, und meldet weiter „angehalten".
    const r = berechneFrist({
      status: STATUS.bewilligt,
      antragsdatum: '2018-10-17T00:00:00.000Z',
      vnEingangDatum: '2026-07-01T00:00:00.000Z',
      stichtag: HEUTE,
    });
    expect(r.zustand).toBe('angehalten');
  });
});

describe('berechneFrist — die Uhr steht (der eigentliche Fix)', () => {
  it('hält in der Entscheidung an, statt Jahre weiterzuzählen', () => {
    // Der Bestandsfall: Antrag von 2018, Uhr meldete „seit 2 760 T".
    const r = berechneFrist({
      status: STATUS.ablehnung, antragsdatum: '2018-10-17T00:00:00.000Z', stichtag: HEUTE,
    });
    expect(r.zustand).toBe('angehalten');
    expect(r.tageRest).toBeUndefined();
  });

  it('hält auch für „bewilligungsreif" an — beide Codes liegen in derselben Phase', () => {
    const r = berechneFrist({
      status: STATUS.bewilligungsreif, antragsdatum: '2026-05-01T00:00:00.000Z', stichtag: HEUTE,
    });
    expect(r.zustand).toBe('angehalten');
  });

  it('nennt das Haltedatum als Bezugszeitpunkt, wenn es belegt ist', () => {
    const r = berechneFrist({
      status: STATUS.ablehnung,
      antragsdatum: '2018-10-17T00:00:00.000Z',
      haltedatum: '2019-02-11',
      stichtag: HEUTE,
    });
    expect(r.zustand).toBe('angehalten');
    expect(r.bezugsZeitpunkt).toBe('2019-02-11');
    expect(r.grund).toBeUndefined();
  });

  it('sagt „Haltedatum unbekannt" statt eines geratenen Datums', () => {
    const r = berechneFrist({
      status: STATUS.ablehnung, antragsdatum: '2018-10-17T00:00:00.000Z', stichtag: HEUTE,
    });
    expect(r.grund).toBe(FRIST_GRUND.haltedatumUnbekannt);
    expect(r.bezugsZeitpunkt).toBeUndefined();
    expect(r.haltedatumQuelle).toBe('unbekannt');
  });

  it('reicht die Herkunft des Haltedatums durch, ohne sie zu raten', () => {
    const mit = berechneFrist({
      status: STATUS.ablehnung, antragsdatum: '2018-10-17T00:00:00.000Z',
      haltedatum: '2019-02-11', haltedatumHerkunft: 'verlauf_bedingt', stichtag: HEUTE,
    });
    expect(mit.haltedatumQuelle).toBe('verlauf_bedingt');
    // Ein Datum OHNE Herkunft bekommt keine erfundene.
    const ohne = berechneFrist({
      status: STATUS.ablehnung, antragsdatum: '2018-10-17T00:00:00.000Z',
      haltedatum: '2019-02-11', stichtag: HEUTE,
    });
    expect(ohne.haltedatumQuelle).toBe('unbekannt');
  });

  it('**der Zustand ist gegen das Haltedatum invariant** — Teil B ist additiv', () => {
    // `berechneFrist` liest das Haltedatum erst IM `angehalten`-Zweig, nachdem
    // der Zustand feststeht. Eine neue Haltedatum-Quelle kann deshalb keinen
    // Vorgang zwischen den Zuständen verschieben. Genau darauf steht die
    // Diagonalprüfung des Bestandslaufs — sie bestätigt diese Zusage, sie
    // beweist sie nicht.
    const faelle = [
      { status: STATUS.ablehnung, antragsdatum: '2018-10-17T00:00:00.000Z' },
      { status: STATUS.beantragt, antragsdatum: '2026-06-01T00:00:00.000Z' },
      { status: STATUS.beantragt, antragsdatum: null },
      { status: STATUS.schlussvermerk, antragsdatum: '2020-01-01T00:00:00.000Z' },
    ];
    for (const f of faelle) {
      const ohne = berechneFrist({ ...f, stichtag: HEUTE });
      for (const h of ['journal', 'datumsfeld', 'verlauf_bestaetigt', 'verlauf_bedingt'] as const) {
        const mit = berechneFrist({
          ...f, haltedatum: '2019-02-11', haltedatumHerkunft: h, stichtag: HEUTE,
        });
        expect(mit.zustand, `${String(f.status)} / ${h}`).toBe(ohne.zustand);
        expect(mit.tageRest, `${String(f.status)} / ${h}`).toBe(ohne.tageRest);
      }
    }
  });

  it('hält bei terminalen Status an — unabhängig davon, was der Katalog sagt', () => {
    for (const s of [STATUS.schlussvermerk, STATUS.abgelehnt]) {
      const r = berechneFrist({
        status: s, antragsdatum: '2019-01-01T00:00:00.000Z', stichtag: HEUTE,
      });
      expect(r.zustand, s).toBe('angehalten');
    }
  });

  it('lässt einen Marker ohne Phase weiterlaufen — nicht wissen heißt nicht anhalten', () => {
    const r = berechneFrist({
      status: STATUS.irrlaeufer, antragsdatum: '2026-06-01T00:00:00.000Z', stichtag: HEUTE,
    });
    expect(r.zustand).toBe('laeuft');
  });
});

describe('berechneFrist — nicht berechenbar ist eine Aussage, keine Lücke', () => {
  it('ohne beide Eingangsdaten: Grund statt leerer Zelle', () => {
    const r = berechneFrist({ status: STATUS.beantragt, stichtag: HEUTE });
    expect(r.zustand).toBe('nicht_berechenbar');
    expect(r.grund).toBe(FRIST_GRUND.ohneEingang);
  });

  it('leere Strings zählen als fehlend, nicht als Datum', () => {
    const r = berechneFrist({
      status: STATUS.beantragt, antragsdatum: '', alleAntraegeDa: '   ', stichtag: HEUTE,
    });
    expect(r.zustand).toBe('nicht_berechenbar');
  });

  it('unparsbares Datum wird nicht zu NaN-Tagen', () => {
    const r = berechneFrist({
      status: STATUS.beantragt, antragsdatum: 'kein Datum', stichtag: HEUTE,
    });
    expect(r.zustand).toBe('nicht_berechenbar');
    expect(r.tageRest).toBeUndefined();
  });

  it('rettet den Fall „nur D_XTE gepflegt" — der ist berechenbar', () => {
    const r = berechneFrist({
      status: STATUS.beantragt, alleAntraegeDa: '2026-06-01T00:00:00.000Z', stichtag: HEUTE,
    });
    expect(r.zustand).toBe('laeuft');
    expect(r.basisFeld).toBe('D_XTE');
  });
});

describe('berechneFrist — der Katalog entscheidet, nicht der Code', () => {
  it('folgt einer kuratierten Fassung, die die Entscheidung weiterlaufen lässt', () => {
    const r = berechneFrist({
      status: STATUS.ablehnung,
      antragsdatum: '2026-05-01T00:00:00.000Z',
      stichtag: HEUTE,
      phasen: [
        { id: 'eingang', label: 'Eingang', reihenfolge: 10, fristLaeuft: true },
        { id: 'entscheidung', label: 'Entscheidung', reihenfolge: 40, fristLaeuft: true },
      ],
    });
    expect(r.zustand).toBe('laeuft');
  });

  it('hält an, wo eine Fassung den Eingang anhält', () => {
    const r = berechneFrist({
      status: STATUS.beantragt,
      antragsdatum: '2026-05-01T00:00:00.000Z',
      stichtag: HEUTE,
      phasen: [
        { id: 'eingang', label: 'Eingang', reihenfolge: 10, fristLaeuft: false },
      ],
    });
    expect(r.zustand).toBe('angehalten');
  });

  it('lässt eine Bestandsfassung ohne das Feld laufen wie der Seed', () => {
    // Fassungen vor v3.6 tragen `fristLaeuft` nicht — `normalisiere` ergänzt es.
    const r = berechneFrist({
      status: STATUS.ablehnung,
      antragsdatum: '2026-05-01T00:00:00.000Z',
      stichtag: HEUTE,
      phasen: [
        { id: 'eingang', label: 'Eingang', reihenfolge: 10 },
        { id: 'entscheidung', label: 'Entscheidung', reihenfolge: 40 },
      ],
    });
    expect(r.zustand).toBe('angehalten');
  });
});
