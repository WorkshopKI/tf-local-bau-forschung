/**
 * Der geteilte Filterzustand. Die wichtigste Zusage steht zuerst: **ein
 * neutraler Eintrag wird nie weggefiltert**. 144 der 505 Codes lässt das
 * Fachsystem von jedem setzen; wer sie einer Rollenwahl opfert, nimmt gut ein
 * Viertel des Verlaufs weg und behauptet dabei, sie gehörten jemand anderem.
 */
import { describe, it, expect } from 'vitest';
import {
  BEREICH_VERBUND, bereicheVon, bereichZaehler, filterePaare, neutralZaehler,
  rollenBilanz, rollenSicht, rollenWahlOffen, rollenZaehler, schalteAuswahl,
  sichtFuerBahn, trifftBereich,
} from '@/core/status/verlauf-filter';
import { ROLLEN } from '@/core/status/rollen';
import type { ChronikEintrag } from '@/core/status/chronik';
import type { OffenesPaarJeTv } from '@/core/status/waechter';
import type { Rolle, StatusFeldEintrag } from '@/core/status/typen';

const feld = (code: string, rollen: Rolle[]): StatusFeldEintrag => ({
  feldId: `D_${code}`, label: `Bezeichnung ${code}`, typ: 'datum', ebene: 'tv', code,
  rollen, prominenzDefault: 'normal', aktiv: true, unkuratiert: false,
});

const e = (f: StatusFeldEintrag, tag: string, tvIds: string[] = []): ChronikEintrag =>
  ({ tag, feld: f, wert: tag, tvIds });

const NUR_QS = new Set<Rolle>(['qs']);
const ALLE = new Set<Rolle>(ROLLEN);

describe('verlauf-filter — neutral verschwindet nie', () => {
  it('blendet einen neutralen Eintrag ab, statt ihn zu entfernen', () => {
    expect(rollenSicht([], NUR_QS)).toBe('gedimmt');
  });

  it('nimmt eine fremde Rolle aus der Liste', () => {
    expect(rollenSicht(['ab'], NUR_QS)).toBe('weg');
  });

  it('zeigt die gewählte Rolle voll, auch neben einer zweiten', () => {
    expect(rollenSicht(['ab', 'qs'], NUR_QS)).toBe('voll');
  });

  it('lässt ohne wirksame Wahl alles voll — Hervorhebung überall wäre keine', () => {
    expect(rollenSicht([], new Set())).toBe('voll');
    expect(rollenSicht(['ab'], ALLE)).toBe('voll');
    expect(rollenWahlOffen(new Set())).toBe(true);
    expect(rollenWahlOffen(ALLE)).toBe(true);
    expect(rollenWahlOffen(NUR_QS)).toBe(false);
  });

  it('kennt im Zeitstrahl kein „weg" — die Bahn behielte sonst Lücken', () => {
    expect(sichtFuerBahn('weg')).toBe('gedimmt');
    expect(sichtFuerBahn('gedimmt')).toBe('gedimmt');
    expect(sichtFuerBahn('voll')).toBe('voll');
  });
});

describe('verlauf-filter — Bereiche', () => {
  it('liest leere Träger als Verbund, nicht als niemand', () => {
    expect(bereicheVon([])).toEqual([BEREICH_VERBUND]);
    expect(bereicheVon(['TV1'])).toEqual(['TV1']);
  });

  it('trifft, sobald EIN Träger gewählt ist', () => {
    expect(trifftBereich(['TV1', 'TV2'], new Set(['TV2']))).toBe(true);
    expect(trifftBereich(['TV1'], new Set(['TV2']))).toBe(false);
    expect(trifftBereich([], new Set([BEREICH_VERBUND]))).toBe(true);
    expect(trifftBereich(['TV1'], new Set())).toBe(true);
  });
});

describe('verlauf-filter — Zähler', () => {
  const AB_FB = feld('PC+', ['ab', 'fb']);
  const NEUTRAL = feld('XTE', []);
  const chronik = [
    e(AB_FB, '2026-03-24', ['TV1', 'TV2', 'TV3']),
    e(feld('QSF', ['qs']), '2026-07-10', ['TV1']),
    e(NEUTRAL, '2026-03-10'),
  ];

  it('zählt Zellen, nicht Ereignisse', () => {
    expect(rollenZaehler(chronik, new Set()).ab).toBe(3);
  });

  it('zählt einen Eintrag mit zwei Rollen für BEIDE — die Summe darf größer sein', () => {
    const z = rollenZaehler(chronik, new Set());
    expect(z.ab).toBe(3);
    expect(z.fb).toBe(3);
    expect(z.qs).toBe(1);
  });

  it('zählt neutrale Einträge separat, statt sie einer Rolle zuzuschlagen', () => {
    const z = rollenZaehler(chronik, new Set());
    expect(z.pa + z.jur).toBe(0);
    expect(neutralZaehler(chronik, new Set())).toBe(1);
  });

  it('folgt der Bereichswahl', () => {
    expect(rollenZaehler(chronik, new Set(['TV1'])).ab).toBe(1);
    expect(rollenZaehler(chronik, new Set([BEREICH_VERBUND])).ab).toBe(0);
    expect(neutralZaehler(chronik, new Set(['TV1']))).toBe(0);
  });

  it('zählt je Bereich unter der Rollenwahl', () => {
    const z = bereichZaehler(chronik, NUR_QS);
    // AB/FB fällt weg, der neutrale Verbund-Eintrag bleibt.
    expect(z.get('TV1')).toBe(1);
    expect(z.get('TV2')).toBeUndefined();
    expect(z.get(BEREICH_VERBUND)).toBe(1);
  });

  it('bilanziert eine Bahn nach derselben Regel wie die Leiste', () => {
    // Die Bilanz zählt Einträge (Termine der Bahn), nicht Zellen — aber
    // mehrrollig zählt für jede Rolle, und neutral zählt nirgends. Zwei Zahlen
    // für dieselbe Frage wären zwei Wahrheiten.
    const b = rollenBilanz([
      { rollen: ['ab', 'fb'] }, { rollen: ['qs'] }, { rollen: [] },
    ]);
    expect(b).toEqual({ ab: 1, fb: 1, qs: 1, pa: 0, jur: 0 });
  });

  it('gibt für eine Bahn ohne Termine überall null', () => {
    expect(rollenBilanz([])).toEqual({ ab: 0, fb: 0, qs: 0, pa: 0, jur: 0 });
  });
});

describe('verlauf-filter — Klickverhalten', () => {
  const alle = ['a', 'b', 'c'];

  it('isoliert beim ersten Klick', () => {
    expect([...schalteAuswahl(new Set(alle), 'b', alle)]).toEqual(['b']);
    expect([...schalteAuswahl(new Set<string>(), 'b', alle)]).toEqual(['b']);
  });

  it('addiert beim zweiten', () => {
    expect([...schalteAuswahl(new Set(['b']), 'c', alle)]).toEqual(['b', 'c']);
  });

  it('fällt beim Abwählen des letzten auf alle zurück, nie auf leer', () => {
    expect([...schalteAuswahl(new Set(['b']), 'b', alle)]).toEqual(alle);
    expect([...schalteAuswahl(new Set(['b', 'c']), 'c', alle)]).toEqual(['b']);
  });
});

describe('verlauf-filter — Lücken', () => {
  const paar = (rolle: Rolle | null, tvId: string): OffenesPaarJeTv =>
    ({ gesetzt: 'AT4', fehlt: 'AK4', fehltLabel: 'x', seit: '2026-05-05', tage: 9, rolle, tvId });

  it('behält eine neutrale Lücke unter jeder Rollenwahl', () => {
    expect(filterePaare([paar(null, 'TV1')], NUR_QS, new Set())).toHaveLength(1);
  });

  it('filtert eine fremde Rolle weg', () => {
    expect(filterePaare([paar('ab', 'TV1')], NUR_QS, new Set())).toHaveLength(0);
  });

  it('folgt der Bereichswahl', () => {
    expect(filterePaare([paar('qs', 'TV1')], ALLE, new Set(['TV2']))).toHaveLength(0);
    expect(filterePaare([paar('qs', 'TV1')], ALLE, new Set(['TV1']))).toHaveLength(1);
  });
});
