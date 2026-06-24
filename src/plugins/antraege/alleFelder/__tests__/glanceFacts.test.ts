import { describe, it, expect } from 'vitest';
import { buildGlanceFacts, sumBeantragteKosten } from '../glanceFacts';
import type { GlanceFact } from '../glanceFacts';
import type { Antrag } from '@/core/services/csv/types';

function antrag(fields: Record<string, unknown>): Antrag {
  return { aktenzeichen: 'A', programm_id: 'p', _field_sources: {}, _updated_at: '', ...fields } as unknown as Antrag;
}

const fact = (facts: GlanceFact[], label: string): string =>
  facts.find(f => f.label === label)?.value ?? '';

describe('sumBeantragteKosten', () => {
  it('summiert über TVs, null ohne Werte', () => {
    expect(sumBeantragteKosten([antrag({ beantragte_kosten: '280000' }), antrag({ beantragte_kosten: '420000' })])).toBe(700000);
    expect(sumBeantragteKosten([antrag({})])).toBeNull();
  });
});

describe('buildGlanceFacts', () => {
  it('leitet die 8 Fakten aus den TVs ab', () => {
    const facts = buildGlanceFacts({
      verbundId: 'ZKN1',
      unterprogramm: '138',
      tvs: [
        antrag({ vb_phase: 3, netzwerkname: '"INTSPA"', laufzeitbeginn: '2026-04-01', laufzeitende: '2028-03-31', antragsdatum: '2026-02-24', beantragte_kosten: '280000' }),
        antrag({ vb_phase: 3, antragsdatum: '2026-03-06', beantragte_kosten: '420000' }),
      ],
    });
    expect(facts).toHaveLength(8);
    expect(fact(facts, 'Verbund')).toBe('"INTSPA" · ZKN1');
    expect(fact(facts, 'Phase')).toBe('FuE · Unterprogramm 138');
    expect(fact(facts, 'Teilvorhaben')).toBe('2 Partner');
    expect(fact(facts, 'beantragte Kosten')).toBe('700.000 €');
    // Antragsdatum = spätestes TV-Datum (06.03. > 24.02.)
    expect(fact(facts, 'Antragsdatum')).toBe('06.03.2026');
    expect(fact(facts, 'Laufzeit')).toBe('01.04.2026 – 31.03.2028');
  });

  it('fehlende Custom-Felder (Kosten/Pre-Check/NF) → „—"', () => {
    const facts = buildGlanceFacts({ verbundId: 'ZKN2', unterprogramm: null, tvs: [antrag({ vb_phase: 3 })] });
    expect(fact(facts, 'Verbund')).toBe('ZKN2'); // kein Netzwerkname
    expect(fact(facts, 'beantragte Kosten')).toBe('—');
    expect(fact(facts, 'Pre-Check')).toBe('—');
    expect(fact(facts, 'Nachforderung')).toBe('—');
  });

  it('crasht nicht bei leerer TV-Liste', () => {
    expect(() => buildGlanceFacts({ verbundId: 'X', unterprogramm: null, tvs: [] })).not.toThrow();
  });
});
