/**
 * Die **Klärfragen-Ableitung**: entsteht aus dem gemessenen Bestand die richtige
 * Frage, an die richtige Person, mit einer Id, die eine Wanderung durch Excel
 * übersteht?
 *
 * Drei Zusagen tragen den ganzen Export:
 *
 * 1. **Die Wert-Herkünfte sind disjunkt.** Derselbe Rohstatus darf nicht in
 *    mehreren Töpfen liegen — in einer nach `vorkommen` sortierten Liste würde
 *    er sonst mehrfach gewogen, und wer ihn beantwortet, beantwortet ihn zweimal
 *    verschieden.
 * 2. **Ids kommen aus Daten, nie aus Positionen.** Die Datei ist Wochen
 *    unterwegs; ein nachträglich eingeschobener Befund verschöbe sonst alle
 *    Antworten dahinter (dieselbe Zusage wie `no-index-punkt-id` in `zu-klaeren`).
 * 3. **`bezeichnung-weicht-ab` geht am Bestand leer aus** — und wird nicht leer,
 *    sobald ein Wortlaut abweicht. Ohne die Gegenprobe wäre eine kaputte Prüfung
 *    von einer erfolgreichen nicht zu unterscheiden.
 *
 * Setzt Modul-globalen Zustand (der Beschriftungs-Snapshot in
 * `status-wert-labels.ts` entscheidet, was `bezeichnungsAbweichungen` als
 * ANGEZEIGT liest) → gehört ins Projekt `isolated` und räumt in `afterAll` auf.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { setStatusKatalogSnapshot } from '@/core/status/snapshot';
import { baueSeedVersion } from '@/core/status/seed';
import { normalisiereWert } from '@/core/status/typen';
import {
  uneinigeKuerzel, projektformAbhaengigeKuerzel, offeneBedeutungen,
  type UneinigesKuerzel,
} from '@/core/status/kuerzel-katalog';
import { STATUS_CODE_KATALOG } from '@/core/status/status-codes';
import {
  baueKlaerfragen, bezeichnungsAbweichungen, zaehleJeHerkunft,
  ktFragen, ktPaare, ktVerstoesse,
  FACHLICH_BESTAETIGT, KURZLABEL_SPITZE, HERKUENFTE, STILLGELEGTE_HERKUENFTE,
  type KlaerfragenBestand, type Klaerfrage,
} from '@/core/status/klaerfragen';

afterAll(() => setStatusKatalogSnapshot(null));

/** Ein leerer Bestand, den einzelne Fälle punktuell füllen. */
function bestand(teil: Partial<KlaerfragenBestand> = {}): KlaerfragenBestand {
  return {
    rohStatus: new Map(),
    rohStatusVerbuende: new Map(),
    proKuerzel: new Map(),
    proKuerzelDs: new Map(),
    dsVerbuende: 0,
    dsVorgaenge: 0,
    gesamtVorgaenge: 0,
    importiertAm: null,
    ...teil,
  };
}

/** Alle Fassungswerte, damit `wert-nicht-in-fassung` nicht dazwischenfunkt. */
function fassungMit(...werte: string[]): ReadonlySet<string> {
  return new Set(werte.map(normalisiereWert));
}

function ids(fragen: readonly Klaerfrage[], herkunft: string): string[] {
  return fragen.filter(f => f.herkunft === herkunft).map(f => f.betrifft);
}

/**
 * Zwei erfundene uneinige Kürzel — die **Positivkontrolle** der
 * Bedeutungs-Herkünfte.
 *
 * Am echten Katalog geht `offeneBedeutungen()` seit der Klärrunde leer aus:
 * jedes uneinige Kürzel führt eine FuE-Form, aus der die Sammelregel für DS
 * schöpft, also muss nichts mehr geliehen werden. Die Ableitung deshalb nur
 * noch gegen Leere zu prüfen hieße, eine kaputte Ableitung nicht von einer
 * erfolgreichen unterscheiden zu können.
 *
 * `NWFUE` widerspricht schon zwischen NW und FuE; `ANLEIHE` nicht — damit die
 * Trennung der beiden Herkünfte prüfbar bleibt.
 */
const ERFUNDEN: readonly UneinigesKuerzel[] = [
  {
    kuerzel: 'NWFUE',
    bedeutungen: [
      { form: 'NW', bezeichnung: 'Erfundene Bedeutung A' },
      { form: 'FuE', bezeichnung: 'Erfundene Bedeutung B' },
    ],
    strittig: false, bestaetigt: false, beleg: null,
  },
  {
    kuerzel: 'ANLEIHE',
    bedeutungen: [
      { form: 'NW', bezeichnung: 'Erfundene Bedeutung C' },
      { form: 'FuE', bezeichnung: 'Erfundene Bedeutung C' },
      { form: 'DL', bezeichnung: 'Erfundene Bedeutung D' },
    ],
    strittig: false, bestaetigt: false, beleg: null,
  },
];

describe('uneinigeKuerzel', () => {
  it('liefert je Kürzel, welche Projektform was sagt', () => {
    const alle = uneinigeKuerzel();
    expect(alle.length).toBeGreaterThan(40);       // Positivkontrolle (58 nach der Klärrunde)
    for (const u of alle) {
      expect(u.bedeutungen.length).toBeGreaterThan(1);
      // Die Uneinigkeit muss in den mitgelieferten Bedeutungen SICHTBAR sein —
      // sonst kann die Frage nicht formuliert werden.
      expect(new Set(u.bedeutungen.map(b => b.bezeichnung)).size).toBeGreaterThan(1);
    }
  });

  it('bleibt deckungsgleich mit der Namensliste', () => {
    expect(projektformAbhaengigeKuerzel()).toEqual(uneinigeKuerzel().map(u => u.kuerzel));
  });

  it('meldet den strittig-Marker als eigene Achse, nicht als Bedingung', () => {
    // Der Marker misst ein Schreibvarianten-Patt, nicht einen Bedeutungs-
    // unterschied. Wäre er Bedingung, verschwänden alle unmarkierten Fälle.
    const alle = uneinigeKuerzel();
    expect(alle.some(u => !u.strittig)).toBe(true);
  });
});

describe('Bedeutungs-Herkünfte', () => {
  it('sind am heutigen Katalog beantwortet — keine einzige Frage bleibt', () => {
    // Nicht unterdrückt, sondern erschöpft: jedes uneinige Kürzel führt eine
    // FuE-Form, aus der die Sammelregel für DS schöpft. Geliehen wird nichts
    // mehr, also gibt es nichts mehr zu fragen. Der Bestand ist dabei bewusst
    // GROSSZÜGIG gefüllt — die Leere kommt vom Katalog, nicht von fehlenden
    // Vorkommen.
    expect(offeneBedeutungen()).toEqual([]);
    const voll = new Map(uneinigeKuerzel().map(u => [u.kuerzel, 500] as const));
    const fragen = baueKlaerfragen({
      bestand: bestand({ proKuerzelDs: voll, dsVorgaenge: 935 }),
      fassungsWerte: null,
    });
    expect(ids(fragen, 'bedeutung-nw-fue')).toEqual([]);
    expect(ids(fragen, 'bedeutung-ds-anleihe')).toEqual([]);
  });

  it('fragt nur zu Kürzeln, die in DS-Vorgängen vorkommen', () => {
    const eines = ERFUNDEN[0]!;
    const ohne = baueKlaerfragen({
      bestand: bestand(), fassungsWerte: null, offeneBedeutungen: ERFUNDEN,
    });
    expect(ids(ohne, 'bedeutung-nw-fue')).toHaveLength(0);
    expect(ids(ohne, 'bedeutung-ds-anleihe')).toHaveLength(0);

    const mit = baueKlaerfragen({
      bestand: bestand({ proKuerzelDs: new Map([[eines.kuerzel, 12]]), dsVorgaenge: 12 }),
      fassungsWerte: null, offeneBedeutungen: ERFUNDEN,
    });
    const treffer = mit.filter(f => f.betrifft === eines.kuerzel);
    expect(treffer).toHaveLength(1);
    expect(treffer[0]!.vorkommen).toBe(12);
  });

  it('trennt NW-gegen-FuE von der reinen DS-Anleihe', () => {
    const [nwFue, nurAnleihe] = ERFUNDEN;
    const fragen = baueKlaerfragen({
      bestand: bestand({
        proKuerzelDs: new Map([[nwFue!.kuerzel, 5], [nurAnleihe!.kuerzel, 7]]),
        dsVorgaenge: 12,
      }),
      fassungsWerte: null, offeneBedeutungen: ERFUNDEN,
    });
    expect(ids(fragen, 'bedeutung-nw-fue')).toEqual([nwFue!.kuerzel]);
    expect(ids(fragen, 'bedeutung-ds-anleihe')).toEqual([nurAnleihe!.kuerzel]);
    // Nie beides: zwei Fragen zu einem Kürzel wären zwei Antworten auf eine Sache.
    expect(fragen.filter(f => f.betrifft === nwFue!.kuerzel)).toHaveLength(1);
  });

  it('bietet die konkurrierenden Wortlaute als Auswahl an', () => {
    const eines = ERFUNDEN[0]!;
    const fragen = baueKlaerfragen({
      bestand: bestand({ proKuerzelDs: new Map([[eines.kuerzel, 1]]), dsVorgaenge: 1 }),
      fassungsWerte: null, offeneBedeutungen: ERFUNDEN,
    });
    const f = fragen.find(x => x.betrifft === eines.kuerzel)!;
    for (const b of eines.bedeutungen) expect(f.optionen).toContain(b.bezeichnung);
  });
});

describe('DS-Frage', () => {
  it('entsteht genau einmal, nicht je Kürzel', () => {
    const fragen = baueKlaerfragen({
      bestand: bestand({
        proKuerzelDs: new Map(ERFUNDEN.map(u => [u.kuerzel, 3] as const)),
        dsVerbuende: 851, dsVorgaenge: 900,
      }),
      fassungsWerte: null, offeneBedeutungen: ERFUNDEN,
    });
    expect(zaehleJeHerkunft(fragen).get('ds-ohne-quelle')).toBe(1);
    expect(zaehleJeHerkunft(fragen).get('bedeutung-ds-anleihe')).toBe(1);
  });

  it('schweigen, wenn es keinen DS-Bestand gibt', () => {
    const fragen = baueKlaerfragen({ bestand: bestand(), fassungsWerte: null });
    expect(zaehleJeHerkunft(fragen).get('strittig-marker')).toBeUndefined();
    expect(zaehleJeHerkunft(fragen).get('ds-ohne-quelle')).toBeUndefined();
  });

  it('nennt in der DS-Frage die gemessenen Größen', () => {
    const fragen = baueKlaerfragen({
      bestand: bestand({ dsVerbuende: 851, dsVorgaenge: 935, proKuerzelDs: new Map([['AAE', 700]]) }),
      fassungsWerte: null,
    });
    const ds = fragen.find(f => f.herkunft === 'ds-ohne-quelle')!;
    expect(ds.kontext).toContain('851');
    expect(ds.kontext).toContain('935');
    expect(ds.vorkommen).toBe(935);
  });
});

describe('Die drei Wert-Herkünfte', () => {
  it('sind disjunkt — ein Rohwert erzeugt höchstens eine Frage', () => {
    const roh = new Map([
      ['Ein Wert, den niemand führt', 40],
      ['VN gepürft', 30],
      ['bewilligt', 20],
    ]);
    const fragen = baueKlaerfragen({
      bestand: bestand({ rohStatus: roh }),
      fassungsWerte: fassungMit('VN gepürft', 'bewilligt'),
    });
    const wertFragen = fragen.filter(f => f.herkunft.startsWith('wert-') || f.herkunft === 'kurzlabel');
    expect(new Set(wertFragen.map(f => f.betrifft)).size).toBe(wertFragen.length);
  });

  it('ordnet jeden Wert der grundsätzlichsten offenen Frage zu', () => {
    const roh = new Map([['Ein Wert, den niemand führt', 40], ['VN gepürft', 30]]);
    const fragen = baueKlaerfragen({
      bestand: bestand({ rohStatus: roh }),
      fassungsWerte: fassungMit('VN gepürft'),
    });
    expect(ids(fragen, 'wert-nicht-in-fassung')).toEqual(['Ein Wert, den niemand führt']);
    expect(ids(fragen, 'wert-ohne-code')).toEqual(['VN gepürft']);
  });

  it('schlägt für einen Wert ohne Code die nächstliegenden Wortlaute vor', () => {
    const fragen = baueKlaerfragen({
      bestand: bestand({ rohStatus: new Map([['VN gepürft', 7]]) }),
      fassungsWerte: fassungMit('VN gepürft'),
    });
    const f = fragen.find(x => x.herkunft === 'wert-ohne-code')!;
    expect(f.optionen).toContain('VN geprüft');
    // Vorschlag, keine Einstufung: die Entscheidung bleibt in der Antwortspalte.
    expect(f.optionen).toContain('kein amtlicher Code — eigenständiger Wert');
  });

  it('bietet auch einem unbekannten Wert den nächstliegenden Wortlaut an', () => {
    // Ein Verschreiber, den noch niemand gemeldet hat, fällt in die
    // GRUNDSÄTZLICHERE Herkunft (die Fassung führt ihn nicht) und verlöre dort
    // sonst den Tippfehler-Hinweis. Der Realfall `VN gegrüft` ist inzwischen
    // beantwortet und steht in `schreibfehler.ts` — er erzeugt keine Frage mehr.
    const fragen = baueKlaerfragen({
      bestand: bestand({ rohStatus: new Map([['VN gepürft', 5]]) }),
      fassungsWerte: fassungMit('bewilligt'),
    });
    const f = fragen.find(x => x.herkunft === 'wert-nicht-in-fassung')!;
    // Typografisches Schlusszeichen: gerade Anführungszeichen ersetzt der Export
    // (Excels Inline-Liste kennt dafür kein Escape) und zerlegte das Zitat.
    expect(f.optionen).toContain('Schreibfehler — gemeint ist „VN geprüft“');
    expect(f.kontext).toContain('kennt den Wortlaut NICHT');
  });

  it('prüft die Fassung gar nicht, wenn keine geladen ist', () => {
    const fragen = baueKlaerfragen({
      bestand: bestand({ rohStatus: new Map([['Ein Wert, den niemand führt', 40]]) }),
      fassungsWerte: null,
    });
    // „Nichts zu melden" und „nicht geprüft" sind zwei Aussagen.
    expect(ids(fragen, 'wert-nicht-in-fassung')).toHaveLength(0);
    expect(ids(fragen, 'wert-ohne-code')).toEqual(['Ein Wert, den niemand führt']);
  });

  it('führt höchstens die häufigsten Kurzlabel-Zeilen', () => {
    // Schreibweisen, die der Katalog über `varianten` auflöst, für die aber
    // keine Kurzform greift — genau die Menge der Pflegeliste.
    const roh = new Map<string, number>();
    for (let i = 0; i < KURZLABEL_SPITZE + 5; i++) roh.set(`bewilligt ${i}`, 100 - i);
    const fragen = baueKlaerfragen({
      bestand: bestand({ rohStatus: roh }),
      fassungsWerte: new Set([...roh.keys()].map(normalisiereWert)),
    });
    expect(ids(fragen, 'kurzlabel').length).toBeLessThanOrEqual(KURZLABEL_SPITZE);
  });
});

describe('Entschiedene Frageklassen kommen nicht zurück', () => {
  /** Alle kleinbeginnenden Katalogtexte — die Obermenge von einst. */
  const KLEIN = STATUS_CODE_KATALOG
    .filter(e => { const c = e.text.trim().charAt(0); return c.toLowerCase() === c && c.toUpperCase() !== c; });

  it('fragt nie wieder nach der Kleinschreibung amtlicher Texte', () => {
    // Positivkontrolle: die Fälle sind noch da — es wird nur nicht mehr
    // gefragt. Zwölf davon sind bestätigt; die Regel gilt seitdem ausnahmslos,
    // auch für künftige Fälle, die falsch aussehen (Pitfall #43).
    expect(KLEIN.length).toBeGreaterThan(5);
    const fragen = baueKlaerfragen({
      bestand: bestand({ rohStatus: new Map(KLEIN.map(e => [e.text, 900] as const)) }),
      fassungsWerte: fassungMit(...KLEIN.map(e => e.text)),
    });
    expect(fragen.some(f => f.id.startsWith('amtlicher-text-klein'))).toBe(false);
  });

  it('fragt nie wieder nach dem strittig-Marker', () => {
    const eines = uneinigeKuerzel()[0]!;
    const fragen = baueKlaerfragen({
      bestand: bestand({ proKuerzelDs: new Map([[eines.kuerzel, 99]]), dsVorgaenge: 99 }),
      fassungsWerte: null,
    });
    expect(fragen.some(f => f.id === 'strittig-marker')).toBe(false);
  });

  it('fragt nicht mehr nach einem beantworteten Schreibfehler des Quellsystems', () => {
    // `VN gegrüft` ist als Schreibfehler belegt: die App löst ihn auf, zeigt
    // den Rohwert daneben und schreibt nichts zurück. Eine Frage danach wäre
    // eine zweite Antwort auf dieselbe Sache.
    const fragen = baueKlaerfragen({
      bestand: bestand({ rohStatus: new Map([['VN gegrüft', 5]]) }),
      fassungsWerte: fassungMit('VN geprüft'),
    });
    expect(fragen.filter(f => f.betrifft === 'VN gegrüft')).toEqual([]);
  });

  it('hält die stillgelegten Präfixe fest, damit sie nie neu belegt werden', () => {
    expect(STILLGELEGTE_HERKUENFTE).toEqual(['amtlicher-text-klein', 'strittig-marker']);
    for (const alt of STILLGELEGTE_HERKUENFTE) expect(HERKUENFTE).not.toContain(alt);
  });
});

describe('K/T-Konvention', () => {
  it('geht am Katalog leer aus — die eine Vertauschung ist korrigiert', () => {
    expect(ktVerstoesse()).toEqual([]);
  });

  it('prüft überhaupt etwas: 19 Paare tragen die Konvention', () => {
    // Ohne diese Zahl wäre eine leere Verstoßliste auch mit einer kaputten
    // Prüfung zu erklären.
    const stämme = new Set(ktPaare().map(p => p.stamm));
    expect(stämme.size).toBeGreaterThanOrEqual(15);
  });

  it('meldet eine Vertauschung (Positivkontrolle)', () => {
    const v = ktVerstoesse([{
      stamm: 'XY', form: 'NW',
      kBezeichnung: 'Vereinbarung technisch geprüft',
      tBezeichnung: 'Vereinbarung kaufmännisch geprüft',
    }]);
    expect(v).toEqual([expect.objectContaining({ stamm: 'XY', seite: 'beide' })]);
    expect(ktFragen(v)[0]!.kontext).toContain('vertauscht');
  });

  it('schweigt, wo eine Bezeichnung gar kein Zuständigkeitswort trägt', () => {
    // Kein Befund ist kein Verstoß — sonst meldete die Prüfung jede
    // Bezeichnung, die die Zuständigkeit schlicht nicht nennt.
    expect(ktVerstoesse([{
      stamm: 'XY', form: 'NW', kBezeichnung: 'Eingang Vereinbarung', tBezeichnung: 'Vereinbarung technisch geprüft',
    }])).toEqual([]);
  });
});

describe('bezeichnung-weicht-ab', () => {
  it('geht am ausgelieferten Katalog leer aus', () => {
    expect(bezeichnungsAbweichungen()).toEqual([]);
  });

  it('meldet einen abweichenden Wortlaut (Positivkontrolle)', () => {
    const a = bezeichnungsAbweichungen([
      { code: 59, wortlaut: 'Bewilligt', quelle: 'Test' },
    ]);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ art: 'abweichend', gefunden: 'bewilligt', wo: 'auslieferung' });
  });

  it('meldet einen fehlenden Code (Positivkontrolle)', () => {
    const a = bezeichnungsAbweichungen([{ code: 4711, wortlaut: 'Erfunden', quelle: 'Test' }]);
    expect(a).toEqual([expect.objectContaining({ art: 'fehlt', gefunden: null })]);
  });

  it('erwischt auch eine Fassung, die eine korrekte Auslieferung überschreibt', () => {
    // Die Auslieferung stimmt — das Band zeigt trotzdem den Text der Fassung.
    const version = baueSeedVersion();
    const treffer = version.werte.find(w => w.wert === 'bewilligt');
    expect(treffer).toBeDefined();
    setStatusKatalogSnapshot({
      ...version,
      werte: version.werte.map(w => (w.wert === 'bewilligt' ? { ...w, label: 'freigegeben' } : w)),
    });
    try {
      const a = bezeichnungsAbweichungen([{ code: 59, wortlaut: 'bewilligt', quelle: 'Test' }]);
      expect(a).toEqual([expect.objectContaining({ wo: 'anzeige', gefunden: 'freigegeben' })]);
    } finally {
      setStatusKatalogSnapshot(null);
    }
  });

  it('trägt die Bestätigungen, die zugleich C16 belegen', () => {
    expect(FACHLICH_BESTAETIGT.map(b => b.code).sort((x, y) => x - y)).toEqual([50, 51]);
  });
});

describe('Sortierung und Ids', () => {
  it('sortiert nach Herkunft, darin nach Vorkommen absteigend', () => {
    const zwei = uneinigeKuerzel().slice(0, 3);
    const fragen = baueKlaerfragen({
      bestand: bestand({
        proKuerzelDs: new Map(zwei.map((u, i) => [u.kuerzel, (i + 1) * 10] as const)),
        dsVorgaenge: 60,
      }),
      fassungsWerte: null,
    });
    for (const h of new Set(fragen.map(f => f.herkunft))) {
      const werte = fragen.filter(f => f.herkunft === h).map(f => f.vorkommen ?? -1);
      expect(werte).toEqual([...werte].sort((a, b) => b - a));
    }
  });

  it('bildet Ids aus Daten — jede Id ist an ihrem Gegenstand erkennbar', () => {
    const eines = uneinigeKuerzel()[0]!;
    const fragen = baueKlaerfragen({
      bestand: bestand({
        rohStatus: new Map([['VN gepürft', 7]]),
        proKuerzelDs: new Map([[eines.kuerzel, 3]]),
        dsVorgaenge: 3,
      }),
      fassungsWerte: fassungMit('VN gepürft'),
    });
    // Genau zwei Herkünfte sind Einzelfragen und tragen deshalb keinen
    // Gegenstand in der Id; alle anderen müssen einen tragen.
    const EINZELN = new Set(['strittig-marker', 'ds-ohne-quelle']);
    for (const f of fragen) {
      expect(f.id.startsWith(f.herkunft)).toBe(true);
      expect(f.id === f.herkunft).toBe(EINZELN.has(f.herkunft));
    }
    expect(new Set(fragen.map(f => f.id)).size).toBe(fragen.length);
  });

  it('hält die Id stabil, wenn ein Befund davor verschwindet', () => {
    const eines = uneinigeKuerzel()[0]!;
    const bau = (rohStatus: Map<string, number>): Klaerfrage[] => baueKlaerfragen({
      bestand: bestand({ rohStatus, proKuerzelDs: new Map([[eines.kuerzel, 3]]), dsVorgaenge: 3 }),
      fassungsWerte: fassungMit('VN gepürft'),
    });
    const vorher = bau(new Map([['VN gepürft', 7], ['bewilligt', 900]]));
    const nachher = bau(new Map([['VN gepürft', 7]]));
    const id = (fs: Klaerfrage[]): string => fs.find(f => f.betrifft === 'VN gepürft')!.id;
    expect(id(nachher)).toBe(id(vorher));
  });
});
