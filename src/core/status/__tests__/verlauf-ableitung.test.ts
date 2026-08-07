/**
 * Die **Verbundspur** und der **Vorwärtslauf**: Wirkungsebene, Bedingungen,
 * Journalabgleich.
 *
 * Seit v3.23 rechnet die Ableitung gegen C16 statt gegen die Kürzel-Zuarbeit.
 * Zwei Dinge, die die Tests hier festhalten und die vorher nicht gingen:
 *
 * - Eine Bedingung gilt für den **Zeitpunkt des Kürzels**, nicht für heute.
 *   Gegen den heutigen Stand geprüft verletzte jeder bewilligte Vorgang
 *   rückwirkend seine eigene Eingangsregel.
 * - Was sich nicht auswerten lässt, bekommt ein **eigenes** Urteil
 *   (`trigger_bedingt`) — nicht „bestätigt" und nicht „keine Regel".
 */
import { describe, it, expect } from 'vitest';
import { baueVerlauf, type VerlaufsBezug, type VerlaufsSpur } from '@/core/status/verlauf';
import { parseTriggerZeile } from '@/core/status/trigger-parser';
import type { AntragsChronik } from '@/core/status/journal/lesen';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import type { MappingVersion, StatusFeldEintrag, TriggerZeile } from '@/core/status/typen';

const NW = 1;
const FUE = 3;
const DL = 4;
const BEZUG = '2026-08-06';
const PROGRAMM = '76';

function feld(code: string, ebene: StatusFeldEintrag['ebene']): StatusFeldEintrag {
  return {
    feldId: `D_${code}`, label: code, typ: 'datum', ebene, code,
    prominenzDefault: 'normal', aktiv: true, unkuratiert: false,
  };
}

const FELDER = new Map<string, StatusFeldEintrag>([
  ...(['AAE', 'AB', 'ABB', 'AT4', 'PC+', 'PC-', 'YIRR'] as const).map(
    c => [c, feld(c, 'tv')] as [string, StatusFeldEintrag]),
  ...(['XHSP', 'XIZ', 'XVE', 'XPC+', 'XPC?'] as const).map(
    c => [c, feld(c, 'verbund')] as [string, StatusFeldEintrag]),
]);

function f(code: string): StatusFeldEintrag {
  const treffer = FELDER.get(code);
  if (!treffer) throw new Error(`Testfehler: Code ${code} fehlt`);
  return treffer;
}

function vk(code: string, wert: string): FeldVorkommen {
  return { feld: f(code), wert };
}

const VERSION: MappingVersion = {
  version: 1, autor: null, zeitstempel: '2026-08-06T00:00:00.000Z',
  felder: [...FELDER.values()], werte: [],
};

const z = (
  kuerzel: string, folge: number, parameter: string,
  prozedur = 'TRG_TVs_Status_TV_VB', programm = PROGRAMM,
): TriggerZeile => parseTriggerZeile({ programm, kuerzel, folge, prozedur, parameter });

/** `Status-Vergleich | ohne-TV | ohne-Verbund | · · | TV-Status | VB-Status`. */
const TRIGGER: TriggerZeile[] = [
  z('AAE', 1, '<59|ABB|YIRR||||31|'),        // nur TV
  z('ABB', 1, '<59||||||59|59'),             // beide Ebenen
  z('AT4', 1, '<59||||||38|'),               // nur TV
  z('XVE', 1, '|||||||91'),                  // nur Verbund, unbedingt
  z('XPC+', 1, '<59||||||34|'),              // Verbund-Kürzel, TV-Wirkung
  z('XHSP', 1, '<59|||||||50'),              // nur Verbund
  z('AB', 1, '<59||||||51|'),
];

function lauf(b: Partial<VerlaufsBezug> & Pick<VerlaufsBezug, 'teilvorhaben'>,
  journal: AntragsChronik | null = null,
  trigger: readonly TriggerZeile[] = TRIGGER): VerlaufsSpur[] {
  return baueVerlauf({
    verbundId: 'VB1', statusVbRoh: 'bewilligt', vbPhaseRoh: NW, programm: PROGRAMM,
    bezugsZeitpunkt: BEZUG, ...b,
  }, VERSION, trigger, journal);
}

const vb = (s: VerlaufsSpur[]): VerlaufsSpur => {
  const treffer = s.find(x => x.art === 'verbund');
  if (!treffer) throw new Error('Testfehler: keine Verbundspur');
  return treffer;
};

describe('Verbundspur — die Wirkungsebene entscheidet', () => {
  it('nimmt ABB, obwohl es ein TV-Feld ist: seine Zeile füllt statusVb', () => {
    const s = vb(lauf({
      statusVbRoh: 'bewilligt', vbPhaseRoh: NW,
      teilvorhaben: [{
        aktenzeichen: 'TV1', statusTvRoh: 'bewilligt',
        vorkommen: [vk('AAE', '01.02.2024'), vk('ABB', '01.06.2024')],
      }],
    }));
    expect(s.zustand).toBe('verlauf');
    expect(s.uebergaenge.map(u => u.kuerzel)).toEqual(['ABB']);
    expect(s.segmente.map(x => x.statusRef?.code)).toEqual([59]);
    expect(s.herkunft).toBe('abgeleitet');
  });

  it('nimmt AAE NICHT auf die Verbundbahn — seine Zeile füllt nur statusTv', () => {
    const s = vb(lauf({
      statusVbRoh: 'beantragt', vbPhaseRoh: NW,
      teilvorhaben: [{
        aktenzeichen: 'TV1', statusTvRoh: 'beantragt', vorkommen: [vk('AAE', '01.02.2024')],
      }],
    }));
    expect(s.uebergaenge).toEqual([]);
    expect(s.zustand).toBe('nicht_beobachtet');
  });

  it('leitet für JEDE Projektform ab — die Regel hängt an der Richtlinie', () => {
    // Bis v3.22 blieb dieselbe Konstellation auf FuE und DL leer, weil die
    // Zuarbeit ihre 41 Regeln nach Projektform schlägt und nur NW deckt.
    for (const phase of [FUE, DL]) {
      const s = vb(lauf({
        statusVbRoh: 'bewilligt', vbPhaseRoh: phase,
        teilvorhaben: [{
          aktenzeichen: 'TV1', statusTvRoh: 'bewilligt', vorkommen: [vk('ABB', '01.06.2024')],
        }],
      }));
      expect(s.zustand, `Projektform ${phase}`).toBe('verlauf');
      expect(s.segmente.map(x => x.statusRef?.code)).toEqual([59]);
    }
  });

  it('trägt den importierten Status auch dort, wo keine Regel greift', () => {
    const s = vb(lauf({
      statusVbRoh: 'bewilligt', vbPhaseRoh: FUE,
      teilvorhaben: [{
        aktenzeichen: 'TV1', statusTvRoh: 'bewilligt', vorkommen: [vk('AT4', '01.06.2024')],
      }],
    }));
    expect(s.zustand).toBe('nicht_beobachtet');
    expect(s.begruendung).toContain('Kein Übergang');
    expect(s.segmente[0]?.statusRef?.roh).toBe('bewilligt');
    expect(s.segmente[0]?.vonDatum).toBeNull();
  });
});

describe('Verbund mit fünf Teilvorhaben', () => {
  const fuenf = (tage: string[]): VerlaufsBezug['teilvorhaben'] =>
    tage.map((t, i) => ({
      aktenzeichen: `TV${i + 1}`, statusTvRoh: 'bewilligt',
      vorkommen: [vk('AAE', '01.02.2024'), vk('ABB', t), vk('XPC+', '15.02.2024')],
    }));

  it('meldet den Verbund-Termin EINMAL, auch wenn er auf jeder TV-Zeile steht', () => {
    const s = vb(lauf({
      vbPhaseRoh: FUE, statusVbRoh: 'bewilligt',
      teilvorhaben: fuenf(['01.06.2024', '01.06.2024', '01.06.2024', '01.06.2024', '01.06.2024']),
    }));
    expect(s.uebergaenge.filter(u => u.kuerzel === 'XPC+')).toHaveLength(1);
  });

  it('macht aus fünf Bewilligungen an verschiedenen Tagen fünf Übergänge', () => {
    const s = vb(lauf({
      vbPhaseRoh: NW, statusVbRoh: 'bewilligt',
      teilvorhaben: fuenf(['01.06.2024', '02.06.2024', '03.06.2024', '04.06.2024', '05.06.2024']),
    }));
    expect(s.uebergaenge.filter(u => u.kuerzel === 'ABB')).toHaveLength(5);
    expect(s.segmente[s.segmente.length - 1]?.bisDatum).toBe(BEZUG);
  });

  it('gibt jedem Teilvorhaben seine eigene Spur', () => {
    const spuren = lauf({
      vbPhaseRoh: NW, statusVbRoh: 'bewilligt',
      teilvorhaben: fuenf(['01.06.2024', '02.06.2024', '03.06.2024', '04.06.2024', '05.06.2024']),
    });
    expect(spuren.filter(s => s.art === 'tv').map(s => s.id))
      .toEqual(['TV1', 'TV2', 'TV3', 'TV4', 'TV5']);
    expect(spuren.filter(s => s.art === 'verbund')).toHaveLength(1);
  });
});

describe('Vorwärtslauf — der Status wandert mit', () => {
  const eins = (vorkommen: FeldVorkommen[], status = 'bewilligt'): VerlaufsSpur =>
    lauf({ teilvorhaben: [{ aktenzeichen: 'TV1', statusTvRoh: status, vorkommen }] })
      .find(s => s.id === 'TV1')!;

  it('prüft `<59` gegen den Status VOR dem Kürzel, nicht gegen den heutigen', () => {
    // Der Kern der Rückschau: nach ABB steht der Vorgang auf 59. Gegen den
    // HEUTIGEN Stand geprüft wäre AT4 danach verletzt — es kam aber vorher.
    const s = eins([vk('AAE', '01.02.2024'), vk('AT4', '01.03.2024'), vk('ABB', '01.06.2024')]);
    expect(s.segmente.map(x => x.statusRef?.code)).toEqual([31, 38, 59]);
    expect(s.uebergaenge.find(u => u.kuerzel === 'AT4')?.konfidenz).toBe('trigger_bestaetigt');
  });

  it('verletzt die Bedingung, wenn das Kürzel NACH dem sperrenden Status kam', () => {
    // AT4 nach ABB: der laufende Status ist dann 59, `<59` trägt nicht mehr.
    const s = eins([vk('AAE', '01.02.2024'), vk('ABB', '01.06.2024'), vk('AT4', '01.07.2024')]);
    const at4 = s.uebergaenge.find(u => u.kuerzel === 'AT4');
    expect(at4?.setztStatus).toBeUndefined();
    expect(at4?.bedingung?.urteil).toBe('verletzt');
    expect(at4?.bedingung?.gruende[0]).toContain('Status 59 ist nicht vor 59');
    expect(s.segmente.map(x => x.statusRef?.code)).toEqual([31, 59]);
  });

  it('macht den Kettenanfang unprüfbar, statt einen Startstatus zu erfinden', () => {
    const s = eins([vk('AAE', '01.02.2024')], 'beantragt');
    const aae = s.uebergaenge[0];
    expect(aae?.konfidenz).toBe('trigger_bedingt');
    expect(aae?.bedingung?.urteil).toBe('unpruefbar');
    expect(aae?.bedingung?.gruende[0]).toContain('Vor diesem Termin ist kein Statuswechsel belegt');
    // Der Wechsel gilt trotzdem: das Kürzel WURDE gesetzt.
    expect(aae?.setztStatus?.code).toBe(31);
  });

  it('prüft „ohne ABB" gegen den Tag des Kürzels — sonst verlöre jeder Bewilligte seine Kette', () => {
    // AAE trägt „TV hat kein ABB". ABB steht im Bestand, aber vier Monate SPÄTER.
    const s = eins([vk('AAE', '01.02.2024'), vk('ABB', '01.06.2024')]);
    const aae = s.uebergaenge.find(u => u.kuerzel === 'AAE');
    expect(aae?.setztStatus?.code).toBe(31);
    expect(aae?.bedingung?.gruende.some(g => g.includes('ABB'))).toBe(false);
  });

  it('sagt bei einem früher gesetzten Sperr-Kürzel, an welchem Tag es stand', () => {
    const s = eins([vk('ABB', '01.01.2024'), vk('AAE', '01.02.2024')], 'beantragt');
    const aae = s.uebergaenge.find(u => u.kuerzel === 'AAE');
    expect(aae?.bedingung?.urteil).toBe('verletzt');
    expect(aae?.bedingung?.gruende).toContain('ABB war am 2024-02-01 bereits gesetzt.');
  });

  it('liest „ohne Verbund-Kürzel" über ALLE Teilvorhaben, nicht nur über das eigene', () => {
    const spuren = lauf({
      statusVbRoh: 'beantragt',
      teilvorhaben: [
        { aktenzeichen: 'TV1', statusTvRoh: 'beantragt', vorkommen: [vk('AAE', '01.02.2024')] },
        { aktenzeichen: 'TV2', statusTvRoh: 'beantragt', vorkommen: [vk('YIRR', '01.01.2024')] },
      ],
    });
    const aae = spuren.find(s => s.id === 'TV1')?.uebergaenge[0];
    expect(aae?.bedingung?.urteil).toBe('verletzt');
    expect(aae?.bedingung?.gruende.some(g => g.includes('im Verbund'))).toBe(true);
  });

  it('macht ein katalogfremdes Bedingungs-Kürzel unprüfbar, nicht verletzt', () => {
    const s = lauf({
      teilvorhaben: [{
        aktenzeichen: 'TV1', statusTvRoh: 'bewilligt', vorkommen: [vk('AT4', '01.03.2024')],
      }],
    }, null, [z('AT4', 1, '||FREMDLING||||38|')]).find(x => x.id === 'TV1');
    const at4 = s?.uebergaenge[0];
    expect(at4?.konfidenz).toBe('trigger_bedingt');
    expect(at4?.bedingung?.urteil).toBe('unpruefbar');
    expect(at4?.setztStatus?.code).toBe(38);
  });

  it('nimmt die erste ERFÜLLTE von mehreren Zeilen, nicht die erste überhaupt', () => {
    // Folge 1 ist verletzt (ABB steht schon), Folge 2 greift.
    const s = lauf({
      teilvorhaben: [{
        aktenzeichen: 'TV1', statusTvRoh: 'bewilligt',
        vorkommen: [vk('ABB', '01.01.2024'), vk('AT4', '01.03.2024')],
      }],
    }, null, [
      z('ABB', 1, '||||||59|'),
      z('AT4', 1, '|ABB|||||38|'),
      z('AT4', 2, '||||||40|'),
    ]).find(x => x.id === 'TV1');
    expect(s?.uebergaenge.find(u => u.kuerzel === 'AT4')?.setztStatus?.code).toBe(40);
  });
});

describe('Journalabgleich', () => {
  const chronik = (eintraege: AntragsChronik['felder']): AntragsChronik => ({
    journalAb: '2026-08-05', gefuehrt: true, felder: eintraege, letzteAenderung: '2026-08-06',
  });

  it('hebt die Herkunft auf beobachtet, sobald das Journal einen Wechsel belegt', () => {
    const j = chronik([{
      feld: 'STATUS_TV',
      eintraege: [{
        stempel: 'a1b2c3', antragId: 'TV1', art: 'geaendert', feld: 'STATUS_TV',
        von: 'beantragt', nach: 'bewilligt', datum: '2026-08-06',
      }],
    }]);
    const s = lauf({
      teilvorhaben: [{
        aktenzeichen: 'TV1', statusTvRoh: 'bewilligt', vorkommen: [vk('AAE', '01.02.2024')],
      }],
    }, j).find(x => x.id === 'TV1');
    expect(s?.herkunft).toBe('beobachtet');
    expect(s?.journalAb).toBe('2026-08-05');
  });

  it('überschreibt eine Regel nicht mit zeitlicher Nähe', () => {
    const j = chronik([{
      feld: 'STATUS_TV',
      eintraege: [{
        stempel: 'a1b2c3', antragId: 'TV1', art: 'gesetzt', feld: 'STATUS_TV',
        nach: 'bewilligt', datum: '2026-08-06',
        unscharf: true, vonDatum: '2026-08-03', bisDatum: '2026-08-06',
      }],
    }]);
    const s = lauf({
      teilvorhaben: [{
        aktenzeichen: 'TV1', statusTvRoh: 'bewilligt',
        vorkommen: [vk('AAE', '01.02.2024'), vk('AT4', '04.08.2026')],
      }],
    }, j).find(x => x.id === 'TV1');
    expect(s?.uebergaenge.find(u => u.kuerzel === 'AT4')?.konfidenz).toBe('trigger_bestaetigt');
  });

  it('lässt einen Termin ohne Regel auf zeitliche_naehe steigen', () => {
    const j = chronik([{
      feld: 'STATUS_VB',
      eintraege: [{
        stempel: 'a1b2c3', antragId: 'TV1', art: 'geaendert', feld: 'STATUS_VB',
        nach: 'bewilligt', datum: '2026-03-01',
      }],
    }]);
    const s = vb(lauf({
      vbPhaseRoh: FUE, statusVbRoh: 'bewilligt',
      teilvorhaben: [{
        aktenzeichen: 'TV1', statusTvRoh: 'bewilligt',
        vorkommen: [vk('XIZ', '01.03.2026')],
      }],
    }, j));
    // XIZ trägt in dieser Fixture-Menge keine Zeile — genau der Nachbar ohne Regel.
    const xiz = s.uebergaenge.find(u => u.kuerzel === 'XIZ');
    expect(xiz?.konfidenz).toBe('zeitliche_naehe');
    expect(s.herkunft).toBe('beobachtet');
  });

  it('rührt nichts an, wenn das Journal den Antrag nicht führt', () => {
    const j: AntragsChronik = {
      journalAb: '2026-08-05', gefuehrt: false, felder: [], letzteAenderung: null,
    };
    const s = lauf({
      teilvorhaben: [{
        aktenzeichen: 'TV1', statusTvRoh: 'bewilligt', vorkommen: [vk('AAE', '01.02.2024')],
      }],
    }, j).find(x => x.id === 'TV1');
    expect(s?.herkunft).toBe('abgeleitet');
    expect(s?.journalAb).toBe('2026-08-05');
  });
});
