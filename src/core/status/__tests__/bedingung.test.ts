/**
 * Der Bedingungs-Evaluator ist seit dem Meilenstein-Fundament ein eigenes,
 * geteiltes Modul (Nächste-Schritte-Regeln UND Bearbeitungs-Meilensteine nutzen
 * ihn). Diese Tests halten sein Verhalten fest, damit ein späterer Eingriff nicht
 * still eine der beiden Seiten verschiebt.
 */
import { describe, it, expect } from 'vitest';
import { baueKontext, pruefeBedingung } from '@/core/status/bedingung';
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
