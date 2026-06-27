/** Phase 9 — Recall-Scoring-Logik (gegen synthetische Anonymisierungs-Ergebnisse). */
import { describe, expect, it } from 'vitest';
import { aggregiereRecall, bewerteFixture } from '../recall';
import { ANFRAGE_EVAL_FIXTURES, type AnfrageEvalFixture } from '../fixtures';
import type { AnonymisierungErgebnis } from '../../services/anonymisierung';
import type { PiiTyp } from '../../types';

const fix = ANFRAGE_EVAL_FIXTURES[0]!; // fix-exoskelett (7 Spans)

/** „Perfekte" Anonymisierung: jedes Original → Platzhalter, Mapping vollständig. */
function perfectErgebnis(f: AnfrageEvalFixture): AnonymisierungErgebnis {
  const mapping = f.groundTruth.map((s, i) => ({
    platzhalter: `[${s.typ.toUpperCase()}_${i + 1}]`, original: s.text, typ: s.typ,
  }));
  let text = f.text;
  for (const m of mapping) text = text.split(m.original).join(m.platzhalter);
  return { anonymisiertMd: text, mapping, verallgemeinerungen: [] };
}

describe('Recall-Scoring', () => {
  it('perfekte Anonymisierung → Recall 100 %, keine Leaks', () => {
    const r = aggregiereRecall([bewerteFixture(fix, perfectErgebnis(fix))]);
    expect(r.gesamtRecall).toBe(1);
    expect(r.leakRate).toBe(0);
    expect(r.leaks).toEqual([]);
    expect(r.mappingLuecken).toEqual([]);
  });

  it('PII noch im Text → Leak, Recall < 100 %', () => {
    const leaky = perfectErgebnis(fix);
    // FKZ-Platzhalter rückgängig (Original wieder im Text) + aus Mapping entfernen.
    const fkz = fix.groundTruth.find(s => s.typ === 'fkz')!;
    const ph = leaky.mapping.find(m => m.original === fkz.text)!.platzhalter;
    leaky.anonymisiertMd = leaky.anonymisiertMd.split(ph).join(fkz.text);
    leaky.mapping = leaky.mapping.filter(m => m.original !== fkz.text);

    const r = aggregiereRecall([bewerteFixture(fix, leaky)]);
    expect(r.gesamtRecall).toBeLessThan(1);
    expect(r.leaks.some(l => l.span.typ === 'fkz')).toBe(true);
    expect(r.proTyp.find(t => t.typ === 'fkz')?.recall).toBe(0);
  });

  it('entfernt, aber nicht im Mapping → Mapping-Lücke (nicht wiedereinsetzbar)', () => {
    const e = perfectErgebnis(fix);
    const person = fix.groundTruth.find(s => s.typ === 'person')!;
    e.mapping = e.mapping.filter(m => m.original !== person.text); // Platzhalter bleibt im Text
    const r = aggregiereRecall([bewerteFixture(fix, e)]);
    expect(r.leaks).toEqual([]); // nicht im Text → kein Leak
    expect(r.mappingLuecken.some(l => l.span.typ === 'person')).toBe(true);
  });

  it('Mapping-Eintrag ohne Ground-Truth → False Positive (Over-Anonymisierung)', () => {
    const e = perfectErgebnis(fix);
    e.mapping = [...e.mapping, { platzhalter: '[ORT_9]', original: 'Berlin', typ: 'ort' }];
    const r = aggregiereRecall([bewerteFixture(fix, e)]);
    expect(r.falsePositives).toBe(1);
  });
});

describe('Eval-Fixtures', () => {
  it('decken alle PiiTyp-Klassen ab', () => {
    const alle: PiiTyp[] = ['person', 'firma', 'ort', 'fkz', 'email', 'telefon', 'iban', 'x500', 'hostname', 'sonstiges'];
    const vorhanden = new Set(ANFRAGE_EVAL_FIXTURES.flatMap(f => f.groundTruth.map(s => s.typ)));
    for (const typ of alle) expect(vorhanden.has(typ), `Typ ${typ} fehlt in den Fixtures`).toBe(true);
  });
});
