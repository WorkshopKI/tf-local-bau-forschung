/**
 * Der Bedingungs-Evaluator ist seit dem Meilenstein-Fundament ein eigenes,
 * geteiltes Modul (Nächste-Schritte-Regeln UND Bearbeitungs-Meilensteine nutzen
 * ihn). Diese Tests halten sein Verhalten fest, damit ein späterer Eingriff nicht
 * still eine der beiden Seiten verschiebt.
 */
import { describe, it, expect } from 'vitest';
import { baueKontext, bedingungFeldRefs, pruefeBedingung } from '@/core/status/bedingung';
import type { Bedingung } from '@/core/status/typen';

const HEUTE = '2026-07-25T00:00:00.000Z';

describe('baueKontext', () => {
  it('sammelt Verbund-Felder und je-TV-Felder unter demselben Feld-Key', () => {
    const ctx = baueKontext(
      { verbund_status: 'bewilligt' },
      { 'AZ-1': { status: 'beantragt' }, 'AZ-2': { status: 'bewilligt' } },
    );
    expect(ctx.get('verbund_status')).toEqual(['bewilligt']);
    expect(ctx.get('status')).toEqual(['beantragt', 'bewilligt']);
  });

  it('liefert für unbekannte Felder nichts (Prädikate sehen dann eine leere Liste)', () => {
    expect(baueKontext({}).get('status')).toBeUndefined();
  });
});

describe('pruefeBedingung — Blatt-Prädikate', () => {
  const ctx = baueKontext({ status: 'Gutachten fertig', leerfeld: '   ', datum: '01.03.2026' });

  it('„ist" vergleicht normalisiert (trim + lowercase)', () => {
    expect(pruefeBedingung({ feldId: 'status', op: 'ist', wert: 'gutachten FERTIG' }, ctx)).toBe(true);
    expect(pruefeBedingung({ feldId: 'status', op: 'ist', wert: 'bewilligt' }, ctx)).toBe(false);
  });

  it('„istNicht" ist die Negation von „ist"', () => {
    expect(pruefeBedingung({ feldId: 'status', op: 'istNicht', wert: 'bewilligt' }, ctx)).toBe(true);
    expect(pruefeBedingung({ feldId: 'status', op: 'istNicht', wert: 'Gutachten fertig' }, ctx)).toBe(false);
  });

  it('„gefuellt" ignoriert reinen Whitespace', () => {
    expect(pruefeBedingung({ feldId: 'status', op: 'gefuellt' }, ctx)).toBe(true);
    expect(pruefeBedingung({ feldId: 'leerfeld', op: 'gefuellt' }, ctx)).toBe(false);
    expect(pruefeBedingung({ feldId: 'leerfeld', op: 'leer' }, ctx)).toBe(true);
    expect(pruefeBedingung({ feldId: 'fehlt', op: 'leer' }, ctx)).toBe(true);
  });

  it('bei mehreren TV-Werten genügt EIN Treffer', () => {
    const multi = baueKontext({}, { a: { status: 'beantragt' }, b: { status: 'bewilligt' } });
    expect(pruefeBedingung({ feldId: 'status', op: 'ist', wert: 'bewilligt' }, multi)).toBe(true);
    // istNicht negiert über ALLE Werte — ein Treffer genügt zum Kippen.
    expect(pruefeBedingung({ feldId: 'status', op: 'istNicht', wert: 'bewilligt' }, multi)).toBe(false);
  });
});

describe('pruefeBedingung — Datums-Operatoren', () => {
  const ctx = baueKontext({ datum: '01.03.2026' });

  it('vergleicht gegen heute + tageRelativHeute', () => {
    expect(pruefeBedingung({ feldId: 'datum', op: 'datumVor', tageRelativHeute: 0 }, ctx, HEUTE)).toBe(true);
    expect(pruefeBedingung({ feldId: 'datum', op: 'datumNach', tageRelativHeute: 0 }, ctx, HEUTE)).toBe(false);
    // 01.03.2026 liegt nach heute − 180 Tage.
    expect(pruefeBedingung({ feldId: 'datum', op: 'datumNach', tageRelativHeute: -180 }, ctx, HEUTE)).toBe(true);
  });

  it('evaluiert ohne `heute` zu false statt zu werfen', () => {
    expect(pruefeBedingung({ feldId: 'datum', op: 'datumVor', tageRelativHeute: 0 }, ctx)).toBe(false);
  });

  it('evaluiert ohne parsbares Datum zu false', () => {
    const kaputt = baueKontext({ datum: 'demnächst' });
    expect(pruefeBedingung({ feldId: 'datum', op: 'datumVor', tageRelativHeute: 0 }, kaputt, HEUTE)).toBe(false);
  });
});

describe('pruefeBedingung — tageSeit (Vorgangssystem)', () => {
  // 31-Tage-Widerspruchsfrist aus R6/R11: an Tag 31 laeuft sie noch, ab Tag 32
  // ist sie abgelaufen. Der Stichtag wird injiziert — nie `new Date()`.
  const gesetztAm = '24.06.2026';                    // 31 Tage vor dem 25.07.2026
  const ctx = baueKontext({ D_ARZ: gesetztAm });

  it('ist an Tag 31 noch NICHT erfuellt (echtes > N, nicht >= N)', () => {
    expect(pruefeBedingung({ feldId: 'D_ARZ', op: 'tageSeit', tage: 31 }, ctx, HEUTE)).toBe(false);
  });

  it('ist an Tag 32 erfuellt', () => {
    const tagSpaeter = '2026-07-26T00:00:00.000Z';
    expect(pruefeBedingung({ feldId: 'D_ARZ', op: 'tageSeit', tage: 31 }, ctx, tagSpaeter)).toBe(true);
  });

  it('liefert bei demselben Stichtag immer dasselbe Ergebnis (Determinismus)', () => {
    const b: Bedingung = { feldId: 'D_ARZ', op: 'tageSeit', tage: 10 };
    expect(pruefeBedingung(b, ctx, HEUTE)).toBe(pruefeBedingung(b, ctx, HEUTE));
    expect(pruefeBedingung(b, ctx, HEUTE)).toBe(true);
  });

  it('evaluiert ohne Stichtag oder ohne lesbares Datum zu false', () => {
    expect(pruefeBedingung({ feldId: 'D_ARZ', op: 'tageSeit', tage: 1 }, ctx)).toBe(false);
    const kaputt = baueKontext({ D_ARZ: 'irgendwann' });
    expect(pruefeBedingung({ feldId: 'D_ARZ', op: 'tageSeit', tage: 1 }, kaputt, HEUTE)).toBe(false);
  });
});

describe('pruefeBedingung — datumNachFeld (Vorgangssystem)', () => {
  // R22: Nachlieferung eingegangen = `D_AL` liegt nach `D_AN`.
  it('vergleicht zwei Felder ohne Stichtag', () => {
    const ctx = baueKontext({ D_AN: '01.05.2026', D_AL: '20.05.2026' });
    expect(pruefeBedingung({ feldId: 'D_AL', op: 'datumNachFeld', vergleichFeldId: 'D_AN' }, ctx)).toBe(true);
    expect(pruefeBedingung({ feldId: 'D_AN', op: 'datumNachFeld', vergleichFeldId: 'D_AL' }, ctx)).toBe(false);
  });

  it('ist false, wenn eines der beiden Daten fehlt (nicht belegt ist nicht wahr)', () => {
    const ctx = baueKontext({ D_AL: '20.05.2026' });
    expect(pruefeBedingung({ feldId: 'D_AL', op: 'datumNachFeld', vergleichFeldId: 'D_AN' }, ctx)).toBe(false);
  });
});

describe('pruefeBedingung — foerdervarianteIn (Vorgangssystem)', () => {
  // R23 gilt nur fuer FuE (3) und DS (5) — DL/NW haben keinen PreCheck.
  it('trifft die genannten Varianten und sonst nichts', () => {
    const fue = baueKontext({ vb_phase: '3' });
    const dl = baueKontext({ vb_phase: '4' });
    expect(pruefeBedingung({ feldId: 'vb_phase', op: 'foerdervarianteIn', varianten: [3, 5] }, fue)).toBe(true);
    expect(pruefeBedingung({ feldId: 'vb_phase', op: 'foerdervarianteIn', varianten: [3, 5] }, dl)).toBe(false);
  });

  it('liest auch numerische und leere Werte tolerant', () => {
    const leer = baueKontext({ vb_phase: '' });
    expect(pruefeBedingung({ feldId: 'vb_phase', op: 'foerdervarianteIn', varianten: [3] }, leer)).toBe(false);
    const unsinn = baueKontext({ vb_phase: 'FuE' });
    expect(pruefeBedingung({ feldId: 'vb_phase', op: 'foerdervarianteIn', varianten: [3] }, unsinn)).toBe(false);
  });
});

describe('bedingungFeldRefs', () => {
  it('sammelt dedupliziert und in stabiler Reihenfolge', () => {
    const b: Bedingung = {
      alle: [
        { feldId: 'status', op: 'gefuellt' },
        { einige: [{ feldId: 'D_AN', op: 'leer' }, { feldId: 'status', op: 'leer' }] },
      ],
    };
    expect(bedingungFeldRefs(b)).toEqual(['status', 'D_AN']);
  });

  it('nennt BEIDE Felder von datumNachFeld — sonst fehlte das Vergleichsfeld im Kontext', () => {
    expect(bedingungFeldRefs({ feldId: 'D_AL', op: 'datumNachFeld', vergleichFeldId: 'D_AN' }))
      .toEqual(['D_AL', 'D_AN']);
  });
});

describe('pruefeBedingung — Gruppen', () => {
  const ctx = baueKontext({ status: 'bewilligt', datum: '01.03.2026' });

  it('„alle" ist UND, „einige" ist ODER', () => {
    const und: Bedingung = {
      alle: [
        { feldId: 'status', op: 'ist', wert: 'bewilligt' },
        { feldId: 'datum', op: 'gefuellt' },
      ],
    };
    const oder: Bedingung = {
      einige: [
        { feldId: 'status', op: 'ist', wert: 'abgelehnt' },
        { feldId: 'datum', op: 'gefuellt' },
      ],
    };
    expect(pruefeBedingung(und, ctx, HEUTE)).toBe(true);
    expect(pruefeBedingung(oder, ctx, HEUTE)).toBe(true);
  });

  it('leeres „alle" ist wahr, leeres „einige" ist falsch (Sammel-Knoten-Kontrakt)', () => {
    expect(pruefeBedingung({ alle: [] }, ctx, HEUTE)).toBe(true);
    expect(pruefeBedingung({ einige: [] }, ctx, HEUTE)).toBe(false);
  });

  it('verschachtelt beliebig tief', () => {
    const b: Bedingung = {
      alle: [
        { einige: [{ feldId: 'status', op: 'ist', wert: 'abgelehnt' }, { feldId: 'status', op: 'ist', wert: 'bewilligt' }] },
        { alle: [{ feldId: 'datum', op: 'gefuellt' }] },
      ],
    };
    expect(pruefeBedingung(b, ctx, HEUTE)).toBe(true);
  });
});
