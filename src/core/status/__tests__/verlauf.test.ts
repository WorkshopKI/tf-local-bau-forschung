/**
 * Die Verlaufsableitung — TV-Spuren, Segmente, Ehrlichkeits-Vertrag.
 *
 * Gearbeitet wird gegen die **echten** Regeln der Kürzel-Zuarbeit
 * (`KUERZEL_TRIGGER_REGELN`), nicht gegen erfundene: die Fälle, die das Band
 * tragen sollen, sind genau die, die im Bestand vorkommen. Synthetische Regeln
 * nur dort, wo eine Konstellation geprüft wird, die die Zuarbeit (noch) nicht
 * führt.
 */
import { describe, it, expect } from 'vitest';
import {
  baueVerlauf, type VerlaufsBezug, type VerlaufsSpur,
} from '@/core/status/verlauf';
import { KUERZEL_TRIGGER_REGELN, type KuerzelTriggerRegel } from '@/core/status/kuerzel-trigger.data';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import type { MappingVersion, Prominenz, StatusFeldEintrag } from '@/core/status/typen';

// --- Bausteine --------------------------------------------------------------

/** `vb_phase`: 1/2 = NW · 3 = FuE · 4 = DL · 5 = DS · 9 = Irrläufer. */
const NW = 1;
const FUE = 3;
const DS = 5;

const BEZUG = '2026-08-06';

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
  ['PC+', 'tv'], ['PC-', 'tv'], ['PC?', 'tv'],
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

function bezug(
  teilvorhaben: VerlaufsBezug['teilvorhaben'],
  o: Partial<Omit<VerlaufsBezug, 'teilvorhaben'>> = {},
): VerlaufsBezug {
  return {
    verbundId: 'VB1', statusVbRoh: 'bewilligt', vbPhaseRoh: NW,
    bezugsZeitpunkt: BEZUG, teilvorhaben, ...o,
  };
}

function tv(
  aktenzeichen: string, statusTvRoh: unknown, vorkommen: FeldVorkommen[],
): VerlaufsBezug['teilvorhaben'][number] {
  return { aktenzeichen, statusTvRoh, vorkommen };
}

function lauf(b: VerlaufsBezug, regeln = KUERZEL_TRIGGER_REGELN): VerlaufsSpur[] {
  return baueVerlauf(b, VERSION, regeln, null);
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
    // ABB/NW setzt 59 „bewilligt" — der Export sagt aber „Widerruf".
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
    // Widerspruch: 92 „Widerruf" IST über WRZ/NW erreichbar, hier nur nicht belegt.
    const widerspruch = tvSpur(lauf(bezug([
      tv('TV1', 'Widerruf', [vk('AAE', '01.02.2024'), vk('ABB', '01.06.2024')]),
    ])), 'TV1');
    expect(widerspruch.abweichung?.art).toBe('widerspruch');

    // Lücke: 99 „Schlussvermerk" setzt keine Regel der Zuarbeit auflösbar —
    // gemessen der Normalfall (48 % des Bestands).
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
    // AAE/NW → 31 beantragt, AT4/NW → 38 techn geprüft, ABB/NW → 59 bewilligt.
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
    // AT4 → 38, AK4 → 39, am selben Tag. Beide Kandidaten bleiben stehen.
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

  it('führt historische Kürzel in beiden Formen', () => {
    const s = tvSpur(lauf(bezug([
      tv('TV1', 'bewilligt', [vk('MVA', '01.03.2024'), vk('ABB', '01.06.2024')]),
    ])), 'TV1');
    const alt = s.uebergaenge.find(u => u.kuerzelHistorisch === 'MVA');
    expect(alt, 'MVA ist umbenannt und muss beide Formen führen').toBeDefined();
    expect(alt?.kuerzel).toBe('ÄA');
  });

  it('trägt Termine ohne bekannten Statuswechsel als kein_kuerzel, nicht als Loch', () => {
    const s = tvSpur(lauf(bezug([
      tv('TV1', 'bewilligt', [vk('AAE', '01.02.2024'), vk('XKS', '01.04.2024'), vk('ABB', '01.06.2024')]),
    ])), 'TV1');
    const xks = s.uebergaenge.find(u => u.kuerzel === 'XKS');
    // XKS/NW hat eine Regel, deren Zielstatus („GA fertig") nicht auflösbar ist.
    expect(xks).toBeDefined();
    expect(xks?.setztStatus?.code).toBeNull();
    expect(s.uebergaenge).toHaveLength(3);
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

describe('Kürzel × Projektform — niemals flach', () => {
  it('liest dieselbe Abkürzung je Projektform verschieden', () => {
    const mit = (phase: number): string | null => tvSpur(lauf(bezug(
      [tv('TV1', 'bewilligt', [vk('AB', '01.03.2024')])], { vbPhaseRoh: phase },
    )), 'TV1').uebergaenge[0]?.bezeichnung ?? null;
    expect(mit(NW)).toBe('bewilligungsreif/Akte an Euronorm');
    expect(mit(FUE)).toBe('bewilligungsreif/Akte an Euronorm');
    // DL sagt etwas anderes — genau der Fall, für den der Schlüssel zweiteilig ist.
    expect(mit(4)).toBe('Bewilligungsempfehlung durch Haushaltsbeauftrage/Titelverantwortliche');
  });

  it('sagt bei unbekannter Projektform „nicht eindeutig", statt eine zu raten', () => {
    const s = tvSpur(lauf(bezug(
      [tv('TV1', 'bewilligt', [vk('AB', '01.03.2024')])], { vbPhaseRoh: DS },
    )), 'TV1');
    expect(s.projektform.art).toBe('zuarbeit-aelter');
    expect(s.uebergaenge[0]?.bezeichnungEindeutig).toBe(false);
    expect(s.uebergaenge[0]?.rollenLage).toBe('unbekannt');
    // Ohne Projektform greift auch keine Regel — kein geratener Statuswechsel.
    expect(s.uebergaenge[0]?.setztStatus).toBeUndefined();
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
      VERSION, KUERZEL_TRIGGER_REGELN, null, { ohneBearbeitungsstand: MARKER },
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
      VERSION, KUERZEL_TRIGGER_REGELN, null, { ohneBearbeitungsstand: MARKER },
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

describe('scope der Zuarbeit', () => {
  it('weist „Ebene unbestimmt" als eigene Aussage aus, nicht als fehlende Regel', () => {
    // ALS/NW trägt scope: null — die Zuarbeit sagt nicht, worauf sich der
    // Wechsel bezieht. Das ist etwas anderes als „keine Regel".
    const s = tvSpur(lauf(bezug([
      tv('TV1', 'bewilligt', [vk('ALS', '01.03.2024')]),
    ])), 'TV1');
    const als = s.uebergaenge.find(u => u.kuerzel === 'ALS');
    expect(als?.scopeUnbestimmt).toBe(true);
    expect(als?.setztStatus).toBeUndefined();
    expect(als?.konfidenz).toBe('kein_kuerzel');
  });

  it('nimmt eine tv-Regel nicht für die Verbundspur', () => {
    const eigen: KuerzelTriggerRegel[] = [{
      kuerzel: 'AAE', projektform: 'NW', scope: 'tv',
      zielStatus: { roh: 'beantragt', code: 31, aufloesbar: true },
      benachrichtigt: [], original: 'Stw TV auf beantragt', aktiv: false,
    }];
    const spuren = lauf(bezug([
      tv('TV1', 'beantragt', [{ feld: feld('AAE', 'verbund'), wert: '01.03.2024' }]),
    ], { statusVbRoh: 'beantragt' }), eigen);
    expect(vbSpur(spuren).zustand).toBe('nicht_beobachtet');
  });
});
