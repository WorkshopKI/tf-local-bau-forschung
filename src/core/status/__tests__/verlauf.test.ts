/**
 * Die Verlaufsableitung — TV-Spuren, Segmente, Ehrlichkeits-Vertrag.
 *
 * Gearbeitet wird gegen **echte** C16-Zeilen: die vierzehn Fixtures aus
 * `docs/architecture/todo-regeln-ab-seed.md` (Richtlinie 76), ergänzt um die
 * Zeilen, die dieselbe Tabelle für `ABB`/`AT4`/`AK4`/`WRZ` führt und die dort
 * nicht abgeschrieben sind. Erfundene Konstellationen nur da, wo die Datei
 * keine hat — die Fälle, die eine Bahn tragen sollen, sind die aus dem Bestand.
 *
 * Seit v3.23 ist C16 die alleinige Regelquelle (vorher: 41 Regeln der
 * Kürzel-Zuarbeit). Die Zuarbeit liefert weiter **Bezeichnung und Rollen** —
 * deshalb bleibt der Block „Kürzel × Projektform" unverändert bestehen.
 */
import { describe, it, expect } from 'vitest';
import {
  baueVerlauf, type VerlaufsBezug, type VerlaufsSpur,
} from '@/core/status/verlauf';
import { parseTriggerZeile } from '@/core/status/trigger-parser';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import type { MappingVersion, Prominenz, StatusFeldEintrag, TriggerZeile } from '@/core/status/typen';

// --- Bausteine --------------------------------------------------------------

/** `vb_phase`: 1/2 = NW · 3 = FuE · 4 = DL · 5 = DS · 9 = Irrläufer. */
const NW = 1;
const FUE = 3;
const DS = 5;

const BEZUG = '2026-08-06';
/** Die Richtlinie, für die C16 im Test Regeln führt. */
const PROGRAMM = '76';

function feld(
  code: string,
  ebene: StatusFeldEintrag['ebene'] = 'tv',
  prominenz: Prominenz = 'normal',
): StatusFeldEintrag {
  return {
    feldId: `D_${code}`, label: code, typ: 'datum', ebene, code,
    prominenzDefault: prominenz, aktiv: true, unkuratiert: false,
  };
}

/** Alle Codes, die in den Fixtures vorkommen — die Fassung muss sie kennen. */
const CODES: readonly [string, StatusFeldEintrag['ebene']][] = [
  ['AAE', 'tv'], ['ABB', 'tv'], ['AB', 'tv'], ['AT4', 'tv'], ['AK4', 'tv'],
  ['AL', 'tv'], ['AN', 'tv'], ['ARZ', 'tv'], ['ARW', 'tv'], ['AAR', 'tv'],
  ['ABLZ', 'tv'], ['VU', 'tv'], ['VV', 'tv'], ['WRZ', 'tv'], ['ABA', 'tv'],
  ['ALS', 'tv'], ['ALSB', 'tv'], ['ABLW', 'tv'], ['AAW', 'tv'], ['MVA', 'tv'],
  ['PC+', 'tv'], ['PC-', 'tv'], ['PC?', 'tv'], ['YIRR', 'tv'],
  ['XPC+', 'verbund'], ['XPC?', 'verbund'], ['XHSP', 'verbund'],
  ['XIZ', 'verbund'], ['XVE', 'verbund'], ['XKS', 'tv'],
];

const FELDER = new Map(CODES.map(([c, e]) => [c, feld(c, e)]));

function f(code: string): StatusFeldEintrag {
  const treffer = FELDER.get(code);
  if (!treffer) throw new Error(`Testfehler: Code ${code} fehlt in CODES`);
  return treffer;
}

/** Ein gesetztes Datum (deutsches Format, wie im Export). */
function vk(code: string, wert: string): FeldVorkommen {
  return { feld: f(code), wert };
}

const VERSION: MappingVersion = {
  version: 1, autor: null, zeitstempel: '2026-08-06T00:00:00.000Z',
  felder: [...FELDER.values()], werte: [],
};

// --- C16-Fixtures -----------------------------------------------------------

const z = (
  kuerzel: string, folge: number, parameter: string,
  prozedur = 'TRG_TVs_Status_TV_VB', programm = PROGRAMM,
): TriggerZeile => parseTriggerZeile({ programm, kuerzel, folge, prozedur, parameter });

/**
 * Die Regelmenge der Richtlinie 76.
 *
 * Positionen: `Status-Vergleich | ohne-TV | ohne-Verbund | · · | TV-Status | VB-Status`.
 * Die vier ersten Zeilen stehen wörtlich in der Zuarbeit; die übrigen füllen die
 * Kette, die der Bestand fährt (Eingang → Prüfung → Bewilligung).
 */
const TRIGGER: TriggerZeile[] = [
  z('AAE', 1, '<59|ABB|YIRR||||31|31'),
  z('AAE', 3, 'XAAE|210|0', 'TRG.VorgEintragNeu'),
  z('AAR', 1, '<59|ABB|||||73|73'),
  z('AAR', 2, 'TIB|!.055.VorgInfo.01|BIB', 'TRG.VorgEintragMail'),
  z('ABA', 1, '211|74', 'TRG.Status.TV.VB'),
  z('ABLW', 1, '<59|ABB|||||75|'),
  z('AT4', 1, '<59||||||38|'),
  z('AK4', 1, '<59||||||39|'),
  z('ABB', 1, '<59||||||59|59'),
  z('WRZ', 1, '||||||92|92'),
  z('ALS', 1, '<59||||||36|'),
  z('ÄA', 1, '<59||||||37|'),
  // Nur Verbund-Wirkung: hebt ein TV-Kürzel auf die Verbundbahn.
  z('XKS', 1, '<59|||||||45'),
  // Ein Zielcode, den der Statuskatalog nicht führt.
  z('VU', 1, '<59||||||777|'),
];

function bezug(
  teilvorhaben: VerlaufsBezug['teilvorhaben'],
  o: Partial<Omit<VerlaufsBezug, 'teilvorhaben'>> = {},
): VerlaufsBezug {
  return {
    verbundId: 'VB1', statusVbRoh: 'bewilligt', vbPhaseRoh: NW, programm: PROGRAMM,
    bezugsZeitpunkt: BEZUG, teilvorhaben, ...o,
  };
}

function tv(
  aktenzeichen: string, statusTvRoh: unknown, vorkommen: FeldVorkommen[],
): VerlaufsBezug['teilvorhaben'][number] {
  return { aktenzeichen, statusTvRoh, vorkommen };
}

function lauf(b: VerlaufsBezug, trigger: readonly TriggerZeile[] = TRIGGER): VerlaufsSpur[] {
  return baueVerlauf(b, VERSION, trigger, null);
}

const tvSpur = (s: VerlaufsSpur[], akz: string): VerlaufsSpur => {
  const treffer = s.find(x => x.art === 'tv' && x.id === akz);
  if (!treffer) throw new Error(`Testfehler: keine TV-Spur ${akz}`);
  return treffer;
};
const vbSpur = (s: VerlaufsSpur[]): VerlaufsSpur => {
  const treffer = s.find(x => x.art === 'verbund');
  if (!treffer) throw new Error('Testfehler: keine Verbundspur');
  return treffer;
};

/**
 * Der Ehrlichkeits-Vertrag als Zusicherung (Pitfall #44): die Bahn endet auf
 * dem IMPORTIERTEN Status — oder sie weist die Abweichung aus. Ein dritter
 * Ausgang darf nicht entstehen.
 */
function pruefeVertrag(spur: VerlaufsSpur, importiert: string): void {
  if (spur.zustand === 'kein_wert_im_csv' || spur.zustand === 'kein_bearbeitungsstand') {
    expect(spur.segmente, `${spur.id}: ${spur.zustand} trägt keine Bahn`).toEqual([]);
    expect(spur.begruendung, `${spur.id}: ${spur.zustand} ohne Begründung`).toBeTruthy();
    return;
  }
  const letztes = spur.segmente[spur.segmente.length - 1];
  expect(letztes, `${spur.id}: keine Segmente`).toBeDefined();
  expect(letztes?.bisDatum, `${spur.id}: letztes Segment endet nicht am Bezugszeitpunkt`)
    .toBe(BEZUG);
  expect(letztes?.statusRef?.roh, `${spur.id}: letztes Segment ≠ importierter Status`)
    .toBe(importiert);
}

// --- Tests ------------------------------------------------------------------

describe('baueVerlauf — der Ehrlichkeits-Vertrag', () => {
  it('endet IMMER auf dem importierten Status, auch wenn die Ableitung anderes sagt', () => {
    // ABB setzt 59 „bewilligt" — der Export sagt aber „Widerruf".
    const spuren = lauf(bezug([
      tv('TV1', 'Widerruf', [vk('AAE', '01.02.2024'), vk('ABB', '01.06.2024')]),
    ]));
    const s = tvSpur(spuren, 'TV1');
    pruefeVertrag(s, 'Widerruf');
    expect(s.abweichung?.erwartet?.code).toBe(59);
    expect(s.abweichung?.beobachtet).toBe('Widerruf');
    // Die abgeleitete Strecke bleibt vollständig stehen (31 → 59), nur ihr
    // letztes Segment bekommt ein offenes Ende; der Export hängt hinten an.
    expect(s.segmente.map(x => x.statusRef?.code)).toEqual([31, 59, 92]);
    expect(s.segmente[1]?.bisDatum).toBeNull();
    expect(s.segmente[2]?.vonDatum).toBeNull();
  });

  it('trennt „Ziel gar nicht ableitbar" vom echten Widerspruch', () => {
    // Widerspruch: 92 „Widerruf" IST über WRZ erreichbar, hier nur nicht belegt.
    const widerspruch = tvSpur(lauf(bezug([
      tv('TV1', 'Widerruf', [vk('AAE', '01.02.2024'), vk('ABB', '01.06.2024')]),
    ])), 'TV1');
    expect(widerspruch.abweichung?.art).toBe('widerspruch');

    // Lücke: 99 „Schlussvermerk" setzt keine Zeile dieser Richtlinie — gemessen
    // der Normalfall (48 % des Bestands).
    const luecke = tvSpur(lauf(bezug([
      tv('TV1', 'Schlussvermerk', [vk('AAE', '01.02.2024'), vk('ABB', '01.06.2024')]),
    ])), 'TV1');
    expect(luecke.abweichung?.art).toBe('nicht_ableitbar');
  });

  it('meldet keine Abweichung, wenn die Ableitung den Export trifft', () => {
    const spuren = lauf(bezug([
      tv('TV1', 'bewilligt', [vk('AAE', '01.02.2024'), vk('ABB', '01.06.2024')]),
    ]));
    const s = tvSpur(spuren, 'TV1');
    pruefeVertrag(s, 'bewilligt');
    expect(s.abweichung).toBeUndefined();
    expect(s.zustand).toBe('verlauf');
    expect(s.herkunft).toBe('abgeleitet');
  });

  it('trägt den Journal-Nullpunkt an jeder Spur, auch als null', () => {
    for (const s of lauf(bezug([tv('TV1', 'bewilligt', [vk('AAE', '01.02.2024')])]))) {
      expect(s).toHaveProperty('journalAb', null);
    }
  });
});

describe('TV-Spuren aus den Datumsspalten', () => {
  it('baut Segmente aus den Übergängen und schließt am Bezugszeitpunkt', () => {
    const s = tvSpur(lauf(bezug([
      tv('TV1', 'bewilligt', [
        vk('AAE', '01.02.2024'), vk('AT4', '01.03.2024'), vk('ABB', '01.06.2024'),
      ]),
    ])), 'TV1');
    expect(s.segmente.map(x => x.statusRef?.code)).toEqual([31, 38, 59]);
    expect(s.segmente.map(x => x.vonDatum)).toEqual(['2024-02-01', '2024-03-01', '2024-06-01']);
    expect(s.segmente.map(x => x.bisDatum)).toEqual(['2024-03-01', '2024-06-01', BEZUG]);
    expect(s.segmente[0]?.dauerTage).toBe(29);
    pruefeVertrag(s, 'bewilligt');
  });

  it('markiert Segmente von einem Tag oder weniger als unsicher', () => {
    const s = tvSpur(lauf(bezug([
      tv('TV1', 'bewilligt', [vk('AAE', '01.02.2024'), vk('AT4', '02.02.2024'), vk('ABB', '01.06.2024')]),
    ])), 'TV1');
    expect(s.segmente[0]?.dauerTage).toBe(1);
    expect(s.segmente[0]?.dauerUnsicher).toBe(true);
    expect(s.segmente[1]?.dauerUnsicher).toBe(false);
  });

  it('stapelt gleichtägige Kürzel an EINEM Punkt und erfindet keine Reihenfolge', () => {
    const s = tvSpur(lauf(bezug([
      tv('TV1', 'bewilligt', [
        vk('AAE', '01.02.2024'), vk('AT4', '01.03.2024'), vk('AK4', '01.03.2024'),
        vk('ABB', '01.06.2024'),
      ]),
    ])), 'TV1');
    const mehrdeutig = s.segmente.find(x => x.mehrdeutig);
    expect(mehrdeutig, 'gleichtägige Ziele müssen mehrdeutig sein').toBeDefined();
    expect(mehrdeutig?.statusRef).toBeNull();
    expect(mehrdeutig?.kandidaten?.map(k => k.code).sort()).toEqual([38, 39]);
    expect(s.segmente).toHaveLength(3);   // nicht vier: EIN Punkt, nicht zwei
  });

  it('führt historische Kürzel in beiden Formen — und findet ihre Regel', () => {
    const s = tvSpur(lauf(bezug([
      tv('TV1', 'bewilligt', [vk('MVA', '01.03.2024'), vk('ABB', '01.06.2024')]),
    ])), 'TV1');
    const alt = s.uebergaenge.find(u => u.kuerzelHistorisch === 'MVA');
    expect(alt, 'MVA ist umbenannt und muss beide Formen führen').toBeDefined();
    expect(alt?.kuerzel).toBe('ÄA');
    // C16 führt die Zeile unter der HEUTIGEN Form — der zweite Nachschlag greift.
    expect(alt?.setztStatus?.code).toBe(37);
  });

  it('trägt Termine ohne Regel als kein_kuerzel, nicht als Loch', () => {
    const s = tvSpur(lauf(bezug([
      tv('TV1', 'bewilligt', [vk('AAE', '01.02.2024'), vk('AN', '01.04.2024'), vk('ABB', '01.06.2024')]),
    ])), 'TV1');
    const an = s.uebergaenge.find(u => u.kuerzel === 'AN');
    expect(an).toBeDefined();
    expect(an?.konfidenz).toBe('kein_kuerzel');
    expect(an?.setztStatus).toBeUndefined();
    expect(an?.bedingung).toBeUndefined();     // „keine Regel" ≠ „Bedingung"
    expect(s.uebergaenge).toHaveLength(3);
  });

  it('führt einen Zielcode, den der Statuskatalog nicht kennt, als Zahl statt gar nicht', () => {
    const s = tvSpur(lauf(bezug([
      tv('TV1', 'bewilligt', [vk('AAE', '01.02.2024'), vk('VU', '01.04.2024')]),
    ])), 'TV1');
    const vu = s.uebergaenge.find(u => u.kuerzel === 'VU');
    expect(vu?.setztStatus?.code).toBe(777);
    expect(vu?.setztStatus?.roh).toBe('777');
  });

  it('lässt die Rolle leer, statt sie zu raten — und trennt neutral von unbekannt', () => {
    const s = tvSpur(lauf(bezug([
      tv('TV1', 'bewilligt', [vk('AAE', '01.02.2024'), vk('AAR', '02.02.2024')]),
    ])), 'TV1');
    const aae = s.uebergaenge.find(u => u.kuerzel === 'AAE');
    const aar = s.uebergaenge.find(u => u.kuerzel === 'AAR');
    expect(aae?.rollenLage).toBe('benannt');     // PA setzt den Antragseingang
    expect(aae?.rollen).toEqual(['pa']);
    expect(aar?.rollen).toEqual(['ab']);
    for (const u of s.uebergaenge) {
      if (u.rollenLage !== 'benannt') expect(u.rollen).toEqual([]);
    }
  });

  it('kommt ohne Basisdatum aus — ein unlesbares Datum ist kein Übergang', () => {
    const s = tvSpur(lauf(bezug([
      tv('TV1', 'bewilligt', [vk('AAE', ''), vk('ABB', 'unbekannt')]),
    ])), 'TV1');
    expect(s.uebergaenge).toEqual([]);
    expect(s.zustand).toBe('nicht_beobachtet');
    expect(s.begruendung).toContain('Kein Übergang');
    pruefeVertrag(s, 'bewilligt');
  });

  it('verkraftet zwölf Wechsel und hält die Segmente lückenlos', () => {
    const codes = ['AAE', 'AN', 'AL', 'ALS', 'ALSB', 'AT4', 'AK4', 'ARZ', 'ARW', 'ABLZ', 'AAR', 'ABB'];
    const vorkommen = codes.map((c, i) => vk(c, `${String(i + 1).padStart(2, '0')}.03.2024`));
    const s = tvSpur(lauf(bezug([tv('TV1', 'bewilligt', vorkommen)])), 'TV1');
    expect(s.uebergaenge).toHaveLength(12);
    for (let i = 0; i < s.segmente.length - 1; i++) {
      expect(s.segmente[i]?.bisDatum, 'Segmente müssen aneinander anschließen')
        .toBe(s.segmente[i + 1]?.vonDatum);
    }
    pruefeVertrag(s, 'bewilligt');
  });
});

describe('Der Bezugszeitpunkt bewegt die Kanten nicht', () => {
  it('liefert dieselben Übergänge, egal bis wann die Achse läuft', () => {
    // **Die Zusage, auf der die zweistufige Auflösung des Haltedatums steht**
    // (v3.30): ein erster Lauf mit dem nackten Stichtag darf die Kanten
    // liefern, aus denen das Haltedatum kommt, und ein zweiter mit diesem
    // Haltedatum die Segmente. Nähme `baueUebergaenge` den Bezugszeitpunkt
    // entgegen, wäre das ein Zirkelschluss — und niemand sähe es.
    const tvs = [tv('TV1', 'bewilligt', [
      vk('AAE', '01.03.2024'), vk('ABB', '15.06.2024'), vk('AK4', '02.09.2024'),
    ])];
    const frueh = tvSpur(lauf(bezug(tvs, { bezugsZeitpunkt: '2025-01-01' })), 'TV1');
    const spaet = tvSpur(lauf(bezug(tvs, { bezugsZeitpunkt: '2026-08-06' })), 'TV1');
    expect(frueh.uebergaenge).toEqual(spaet.uebergaenge);
    // Die Segmente DÜRFEN sich unterscheiden — genau dafür gibt es den zweiten Lauf.
    const letztes = (s: VerlaufsSpur): string | null | undefined =>
      s.segmente[s.segmente.length - 1]?.bisDatum;
    expect(letztes(frueh)).not.toBe(letztes(spaet));
  });
});

describe('Kürzel × Projektform — niemals flach (Bezeichnung, nicht Regel)', () => {
  it('liest dieselbe Abkürzung je Projektform verschieden', () => {
    const mit = (phase: number): string | null => tvSpur(lauf(bezug(
      [tv('TV1', 'bewilligt', [vk('AB', '01.03.2024')])], { vbPhaseRoh: phase },
    )), 'TV1').uebergaenge[0]?.bezeichnung ?? null;
    expect(mit(NW)).toBe('bewilligungsreif/Akte an Euronorm');
    expect(mit(FUE)).toBe('bewilligungsreif/Akte an Euronorm');
    // DL sagt etwas anderes — genau der Fall, für den der Schlüssel zweiteilig ist.
    expect(mit(4)).toBe('Bewilligungsempfehlung durch Haushaltsbeauftrage/Titelverantwortliche');
  });

  it('nennt die Quelle der Bezeichnung — und lässt sie weg, wenn sie geliehen ist', () => {
    const eigen = tvSpur(lauf(bezug(
      [tv('TV1', 'bewilligt', [vk('AB', '01.03.2024')])], { vbPhaseRoh: NW },
    )), 'TV1');
    expect(eigen.uebergaenge[0]?.bezeichnungQuelle).toBe('NW');

    // DS führt der Katalog gar nicht (0 von 143 Kürzeln, §14.7) — die
    // Bezeichnung kommt aus der Kuration bzw. aus FuE und ist NICHT die der
    // eigenen Form. `bezeichnungQuelle` bleibt deshalb leer.
    const geliehen = tvSpur(lauf(bezug(
      [tv('TV1', 'bewilligt', [vk('AB', '01.03.2024')])], { vbPhaseRoh: DS },
    )), 'TV1');
    expect(geliehen.uebergaenge[0]?.bezeichnungQuelle).toBeUndefined();
    expect(geliehen.uebergaenge[0]?.bezeichnung).not.toBeNull();
  });

  it('beantwortet DS aus der Kuration, statt die erstgeführte Form zu nehmen', () => {
    // Vor der Klärrunde zeigte ein DS-Vorgang mit `AB` die NW-Bezeichnung
    // („bewilligungsreif/Akte an Euronorm") und musste sie als unsicher
    // ausweisen. Die Antwortrunde hat für DS den DL-Wortlaut festgestellt —
    // seitdem wird nicht mehr geliehen, sondern beantwortet.
    const s = tvSpur(lauf(bezug(
      [tv('TV1', 'bewilligt', [vk('AB', '01.03.2024')])], { vbPhaseRoh: DS },
    )), 'TV1');
    expect(s.projektform.art).toBe('zuarbeit-aelter');
    expect(s.uebergaenge[0]?.bezeichnung)
      .toBe('Bewilligungsempfehlung durch Haushaltsbeauftrage/Titelverantwortliche');
    expect(s.uebergaenge[0]?.bezeichnungEindeutig).toBe(true);
  });

  it('sagt bei unbekannter Projektform „nicht eindeutig", statt eine zu raten', () => {
    // Irrläufer ist begrifflich KEINE Projektform — hier gibt es nichts
    // nachzuliefern und nichts zu kuratieren, also bleibt es beim Nicht-Raten.
    const s = tvSpur(lauf(bezug(
      [tv('TV1', 'bewilligt', [vk('AB', '01.03.2024')])], { vbPhaseRoh: 9 },
    )), 'TV1');
    expect(s.projektform.art).toBe('keine-projektform');
    expect(s.uebergaenge[0]?.bezeichnungEindeutig).toBe(false);
    expect(s.uebergaenge[0]?.rollenLage).toBe('unbekannt');
  });

  it('leitet für DS trotzdem ab — die Regel hängt an der Richtlinie, nicht an der Form', () => {
    // Der Kern der Umstellung: bis v3.22 blieb ein DS-Vorgang ohne jeden
    // Statuswechsel, weil die Zuarbeit nach Projektform schlägt. C16 nicht.
    const s = tvSpur(lauf(bezug(
      [tv('TV1', 'bewilligt', [vk('AAE', '01.02.2024'), vk('ABB', '01.06.2024')])],
      { vbPhaseRoh: DS },
    )), 'TV1');
    expect(s.segmente.map(x => x.statusRef?.code)).toEqual([31, 59]);
    expect(s.zustand).toBe('verlauf');
  });

  it('unterscheidet „Zuarbeit älter" von „gar keine Projektform"', () => {
    const irrlaeufer = tvSpur(lauf(bezug(
      [tv('TV1', 'Irrläufer', [vk('AAE', '01.03.2024')])], { vbPhaseRoh: 9 },
    )), 'TV1');
    expect(irrlaeufer.projektform.art).toBe('keine-projektform');
  });
});

describe('Statuswerte ohne Bearbeitungsstand', () => {
  const MARKER = new Set([29, 88, 93, 94]);

  it('bekommt keine Bahn, aber eine Begründung und die Zahl der Termine', () => {
    const spuren = baueVerlauf(
      bezug([tv('TV1', 'assoziierter Partner', [vk('AAE', '01.02.2024'), vk('AB', '01.03.2024')])]),
      VERSION, TRIGGER, null, { ohneBearbeitungsstand: MARKER },
    );
    const s = tvSpur(spuren, 'TV1');
    expect(s.zustand).toBe('kein_bearbeitungsstand');
    expect(s.segmente).toEqual([]);
    expect(s.verworfeneTermine).toBe(2);
    expect(s.begruendung).toContain('Kennzeichen neben dem Verfahren');
    pruefeVertrag(s, 'assoziierter Partner');
  });

  it('gibt einem Status, den der Katalog nicht kennt, trotzdem seine Bahn', () => {
    const spuren = baueVerlauf(
      bezug([tv('TV1', 'Phantasiestatus', [vk('AAE', '01.02.2024')])]),
      VERSION, TRIGGER, null, { ohneBearbeitungsstand: MARKER },
    );
    const s = tvSpur(spuren, 'TV1');
    expect(s.zustand).toBe('verlauf');
    pruefeVertrag(s, 'Phantasiestatus');
  });

  it('unterscheidet „kein Wert im CSV" von „kein Bearbeitungsstand"', () => {
    const s = tvSpur(lauf(bezug([tv('TV1', '', [vk('AAE', '01.02.2024')])])), 'TV1');
    expect(s.zustand).toBe('kein_wert_im_csv');
    expect(s.begruendung).toContain('keinen Statuswert');
    pruefeVertrag(s, '');
  });
});

describe('Setzebene und Wirkungsebene', () => {
  it('hebt ein TV-Kürzel auf die Verbundbahn, wenn seine Zeile statusVb füllt', () => {
    // XKS liegt als TV-Feld im Katalog, seine C16-Zeile setzt aber nur den
    // Verbund-Status. Setzebene TV, Wirkungsebene Verbund — zwei Felder.
    const spuren = lauf(bezug(
      [tv('TV1', 'bewilligt', [vk('XKS', '01.03.2024')])],
      { statusVbRoh: 'bewilligt' },
    ));
    const vb = vbSpur(spuren);
    expect(vb.uebergaenge.map(u => u.kuerzel)).toEqual(['XKS']);
    expect(vb.uebergaenge[0]?.setztStatus?.code).toBe(45);
    // Auf der TV-Bahn steht derselbe Termin — ohne Statuswechsel.
    const t = tvSpur(spuren, 'TV1');
    expect(t.uebergaenge[0]?.setztStatus).toBeUndefined();
  });

  it('nimmt eine reine TV-Zeile nicht für die Verbundspur', () => {
    // AT4 setzt nur `statusTv`. Der Verbund darf davon nichts abbekommen.
    const spuren = lauf(bezug(
      [tv('TV1', 'bewilligt', [vk('AT4', '01.03.2024')])],
      { statusVbRoh: 'beantragt' },
    ));
    expect(vbSpur(spuren).zustand).toBe('nicht_beobachtet');
  });

  it('setzt beide Ebenen, wenn die Zeile beide füllt', () => {
    const spuren = lauf(bezug(
      [tv('TV1', 'bewilligt', [vk('AAE', '01.02.2024'), vk('ABB', '01.06.2024')])],
      { statusVbRoh: 'bewilligt' },
    ));
    expect(vbSpur(spuren).segmente.map(x => x.statusRef?.code)).toEqual([31, 59]);
  });
});

describe('Ohne Regelquelle — und der Grund steht dabei', () => {
  it('sagt, wenn C16 für diese Richtlinie nichts führt', () => {
    const s = tvSpur(lauf(bezug(
      [tv('TV1', 'bewilligt', [vk('AAE', '01.02.2024')])], { programm: '46' },
    )), 'TV1');
    expect(s.zustand).toBe('nicht_beobachtet');
    expect(s.begruendung).toContain('für diese Richtlinie keine Regeln');
    // Der Termin bleibt trotzdem stehen — es fehlt die Regel, nicht das Ereignis.
    expect(s.uebergaenge).toHaveLength(1);
  });

  it('sagt, wenn die Richtlinie des Vorgangs unbekannt ist', () => {
    const s = tvSpur(lauf(bezug(
      [tv('TV1', 'bewilligt', [vk('AAE', '01.02.2024')])], { programm: null },
    )), 'TV1');
    expect(s.begruendung).toContain('Richtlinie des Vorgangs ist unbekannt');
  });
});
