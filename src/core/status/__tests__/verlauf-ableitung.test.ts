/**
 * Die **Verbundspur**: abgeleitet, nicht beobachtet — samt Aggregationsregeln,
 * Journalabgleich und der Herkunfts-Auskunft.
 *
 * Gemessen am Bestand (06.08.2026) trägt diese Ableitung 1 694 von 7 534
 * Verbünden; 3 241 tragen ein VB-Kürzel, für dessen Projektform die Zuarbeit
 * keine Regel führt. Die Tests halten fest, dass beide Fälle **benannt**
 * herauskommen und nicht als leere Zeile.
 */
import { describe, it, expect } from 'vitest';
import { baueVerlauf, type VerlaufsBezug, type VerlaufsSpur } from '@/core/status/verlauf';
import { KUERZEL_TRIGGER_REGELN } from '@/core/status/kuerzel-trigger.data';
import type { AntragsChronik } from '@/core/status/journal/lesen';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import type { MappingVersion, StatusFeldEintrag } from '@/core/status/typen';

const NW = 1;
const FUE = 3;
const DL = 4;
const BEZUG = '2026-08-06';

function feld(code: string, ebene: StatusFeldEintrag['ebene']): StatusFeldEintrag {
  return {
    feldId: `D_${code}`, label: code, typ: 'datum', ebene, code,
    prominenzDefault: 'normal', aktiv: true, unkuratiert: false,
  };
}

const FELDER = new Map<string, StatusFeldEintrag>([
  ...(['AAE', 'AB', 'ABB', 'AT4', 'PC+', 'PC-'] as const).map(
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

function lauf(b: Partial<VerlaufsBezug> & Pick<VerlaufsBezug, 'teilvorhaben'>,
  journal: AntragsChronik | null = null): VerlaufsSpur[] {
  return baueVerlauf({
    verbundId: 'VB1', statusVbRoh: 'bewilligt', vbPhaseRoh: NW,
    bezugsZeitpunkt: BEZUG, ...b,
  }, VERSION, KUERZEL_TRIGGER_REGELN, journal);
}

const vb = (s: VerlaufsSpur[]): VerlaufsSpur => {
  const treffer = s.find(x => x.art === 'verbund');
  if (!treffer) throw new Error('Testfehler: keine Verbundspur');
  return treffer;
};

describe('Verbundspur — direkte VB-Trigger', () => {
  it('nimmt ABB, obwohl es ein TV-Feld ist: die Regel gibt ihm Verbund-Wirkung', () => {
    const s = vb(lauf({
      statusVbRoh: 'bewilligt', vbPhaseRoh: NW,
      teilvorhaben: [{
        aktenzeichen: 'TV1', statusTvRoh: 'bewilligt',
        vorkommen: [vk('AAE', '01.02.2024'), vk('ABB', '01.06.2024')],
      }],
    }));
    expect(s.zustand).toBe('verlauf');
    expect(s.uebergaenge.map(u => u.kuerzel)).toEqual(['ABB']);
    expect(s.uebergaenge[0]?.konfidenz).toBe('trigger_bestaetigt');
    expect(s.segmente.map(x => x.statusRef?.code)).toEqual([59]);
    expect(s.herkunft).toBe('abgeleitet');
  });

  it('nimmt AAE NICHT auf die Verbundbahn — die Regel gilt nur dem Teilvorhaben', () => {
    const s = vb(lauf({
      statusVbRoh: 'beantragt', vbPhaseRoh: NW,
      teilvorhaben: [{
        aktenzeichen: 'TV1', statusTvRoh: 'beantragt', vorkommen: [vk('AAE', '01.02.2024')],
      }],
    }));
    expect(s.uebergaenge).toEqual([]);
    expect(s.zustand).toBe('nicht_beobachtet');
  });

  it('führt einen unauflösbaren Zielstatus als Übergang MIT Rohtext, nicht als Loch', () => {
    // XHSP/FuE → „Bewilligungsentwurf": der Katalog führt
    // „Bewilligungsentwurf VDI/VDE-IT", der Wortlaut der Zuarbeit löst nicht auf.
    const s = vb(lauf({
      statusVbRoh: 'bewilligt', vbPhaseRoh: FUE,
      teilvorhaben: [{
        aktenzeichen: 'TV1', statusTvRoh: 'bewilligt', vorkommen: [vk('XHSP', '01.03.2024')],
      }],
    }));
    const u = s.uebergaenge.find(x => x.kuerzel === 'XHSP');
    expect(u?.konfidenz).toBe('trigger_bestaetigt');
    expect(u?.setztStatus?.code).toBeNull();
    expect(u?.setztStatus?.roh).toBe('Bewilligungsentwurf');
  });

  it('sagt bei fehlender Regel für die Projektform „nicht beobachtet", statt zu raten', () => {
    // ABB trägt eine Regel NUR für NW. Auf einem FuE-Verbund (76,5 % des
    // Bestands) greift sie nicht — der häufigste Fall überhaupt.
    const s = vb(lauf({
      statusVbRoh: 'bewilligt', vbPhaseRoh: FUE,
      teilvorhaben: [{
        aktenzeichen: 'TV1', statusTvRoh: 'bewilligt', vorkommen: [vk('ABB', '01.06.2024')],
      }],
    }));
    expect(s.zustand).toBe('nicht_beobachtet');
    expect(s.uebergaenge).toEqual([]);
    expect(s.begruendung).toContain('Kein Übergang');
    // Die Bahn trägt trotzdem den importierten Status.
    expect(s.segmente[0]?.statusRef?.roh).toBe('bewilligt');
    expect(s.segmente[0]?.vonDatum).toBeNull();
  });

  it('lässt DL ganz ohne Verbund-Regel — und sagt es', () => {
    const s = vb(lauf({
      statusVbRoh: 'bewilligt', vbPhaseRoh: DL,
      teilvorhaben: [{
        aktenzeichen: 'TV1', statusTvRoh: 'bewilligt',
        vorkommen: [vk('AB', '01.05.2024'), vk('ABB', '01.06.2024')],
      }],
    }));
    expect(s.projektform).toEqual({ art: 'bekannt', form: 'DL' });
    expect(s.zustand).toBe('nicht_beobachtet');
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
    // XPC+ ist ein Verbund-Feld und steht fünfmal in den Vorkommen.
    expect(s.uebergaenge.filter(u => u.kuerzel === 'XPC+')).toHaveLength(1);
  });

  it('macht aus fünf Bewilligungen an verschiedenen Tagen fünf Übergänge', () => {
    const s = vb(lauf({
      vbPhaseRoh: NW, statusVbRoh: 'bewilligt',
      teilvorhaben: fuenf(['01.06.2024', '02.06.2024', '03.06.2024', '04.06.2024', '05.06.2024']),
    }));
    expect(s.uebergaenge.filter(u => u.kuerzel === 'ABB')).toHaveLength(5);
    expect(s.segmente).toHaveLength(5);
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

describe('Aggregationsregeln über die Teilvorhaben', () => {
  const mitPc = (pc: (string | null)[]): VerlaufsBezug['teilvorhaben'] =>
    pc.map((p, i) => ({
      aktenzeichen: `TV${i + 1}`, statusTvRoh: 'bearbeitungsreif',
      vorkommen: [vk('XPC+', '01.03.2024'), ...(p ? [vk('PC+', p)] : [])],
    }));

  it('setzt den TV-Status, nicht den Verbundstatus — so steht es in der Zuarbeit', () => {
    const spuren = lauf({ vbPhaseRoh: FUE, statusVbRoh: 'bearbeitungsreif', teilvorhaben: mitPc(['01.02.2024', '01.02.2024']) });
    const tv1 = spuren.find(s => s.id === 'TV1');
    expect(tv1?.uebergaenge.find(u => u.kuerzel === 'XPC+')?.setztStatus?.code).toBe(34);
    // Auf der Verbundbahn steht derselbe Termin — aber ohne Statuswechsel.
    expect(vb(spuren).uebergaenge.find(u => u.kuerzel === 'XPC+')?.setztStatus).toBeUndefined();
  });

  it('prüft den Quantor gegen die Teilvorhaben und meldet das Ergebnis', () => {
    const alle = lauf({ vbPhaseRoh: FUE, teilvorhaben: mitPc(['01.02.2024', '01.02.2024']) });
    const nichtAlle = lauf({ vbPhaseRoh: FUE, teilvorhaben: mitPc(['01.02.2024', null]) });
    const holen = (s: VerlaufsSpur[]): { quantor: string; kuerzel: string; erfuellt: boolean | null } | undefined =>
      s.find(x => x.id === 'TV1')?.uebergaenge.find(u => u.kuerzel === 'XPC+')?.ausAggregation;
    expect(holen(alle)).toEqual({ quantor: 'alle', kuerzel: 'PC+', erfuellt: true });
    expect(holen(nichtAlle)).toEqual({ quantor: 'alle', kuerzel: 'PC+', erfuellt: false });
  });

  it('erzeugt das Segment auch bei nicht erfüllter Bedingung — der Termin ist die Tatsache', () => {
    const s = lauf({ vbPhaseRoh: FUE, teilvorhaben: mitPc(['01.02.2024', null]) })
      .find(x => x.id === 'TV1');
    expect(s?.uebergaenge.find(u => u.kuerzel === 'XPC+')?.setztStatus?.code).toBe(34);
    expect(s?.zustand).toBe('verlauf');
  });

  it('sagt „nicht prüfbar", wenn die Fassung das Bezugs-Kürzel gar nicht führt', () => {
    const ohnePc: MappingVersion = { ...VERSION, felder: VERSION.felder.filter(x => x.code !== 'PC+') };
    const spuren = baueVerlauf({
      verbundId: 'VB1', statusVbRoh: 'bearbeitungsreif', vbPhaseRoh: FUE, bezugsZeitpunkt: BEZUG,
      teilvorhaben: [{
        aktenzeichen: 'TV1', statusTvRoh: 'bearbeitungsreif', vorkommen: [vk('XPC+', '01.03.2024')],
      }],
    }, ohnePc, KUERZEL_TRIGGER_REGELN, null);
    expect(spuren[0]?.uebergaenge[0]?.ausAggregation?.erfuellt).toBeNull();
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

  it('hebt einen Termin auf zeitliche_naehe, wenn er in die Spanne des Eintrags fällt', () => {
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
        vorkommen: [vk('AT4', '04.08.2026'), vk('AAE', '01.02.2024')],
      }],
    }, j).find(x => x.id === 'TV1');
    // AT4/NW hat eine eigene Regel — die bleibt bestehen, die Nähe überschreibt nicht.
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
        aktenzeichen: 'TV1', statusTvRoh: 'bewilligt', vorkommen: [vk('XVE', '01.03.2026')],
      }],
    }, j));
    // XVE/FuE setzt 91 „beendet"; hier prüfen wir den Nachbarn ohne Regel.
    const xve = s.uebergaenge.find(u => u.kuerzel === 'XVE');
    expect(xve?.konfidenz).toBe('trigger_bestaetigt');
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
