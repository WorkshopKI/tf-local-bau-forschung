import { describe, it, expect } from 'vitest';
import { extractPlatzhalter, type TextbausteinRecord } from '@/core/services/skills';
import { filterBausteine, LEERER_FILTER, zaehleStatus } from '../textbausteinFilter';

function b(over: Partial<TextbausteinRecord>): TextbausteinRecord {
  const text = over.text ?? 'Text.';
  return {
    id: 'X', artefaktTyp: 'nf', scope: 'tv', thema: 'Thema', kategorie: '',
    aspekte: [], stichworte: [], text, platzhalter: extractPlatzhalter(text),
    status: 'freigegeben', version: 1, historie: [], geaendertAm: 'x', ...over,
  };
}

const KATALOG = [
  b({ id: 'G1.10', artefaktTyp: 'nf', thema: 'Zehntes', aspekte: ['H'], status: 'freigegeben' }),
  b({ id: 'G1.2', artefaktTyp: 'nf', thema: 'Zweites', stichworte: ['patent'], status: 'entwurf' }),
  b({ id: 'RNE-A1', artefaktTyp: 'rne', thema: 'Rücknahme', status: 'freigegeben' }),
  b({ id: 'ABL-C1', artefaktTyp: 'abl', thema: 'Ablehnung', status: 'stillgelegt' }),
];

describe('filterBausteine', () => {
  it('sortiert nach Typ und dann natürlich nach ID (G1.2 vor G1.10)', () => {
    const ids = filterBausteine(KATALOG, LEERER_FILTER).map(x => x.id);
    expect(ids).toEqual(['G1.2', 'G1.10', 'RNE-A1', 'ABL-C1']);
  });

  it('filtert nach Typ', () => {
    expect(filterBausteine(KATALOG, { ...LEERER_FILTER, typ: 'rne' }).map(x => x.id)).toEqual(['RNE-A1']);
  });

  it('filtert nach Status', () => {
    expect(filterBausteine(KATALOG, { ...LEERER_FILTER, status: 'freigegeben' }).map(x => x.id)).toEqual(['G1.10', 'RNE-A1']);
  });

  it('filtert nach Aspekt', () => {
    expect(filterBausteine(KATALOG, { ...LEERER_FILTER, aspekt: 'H' }).map(x => x.id)).toEqual(['G1.10']);
  });

  it('sucht über ID, Thema und Stichworte', () => {
    expect(filterBausteine(KATALOG, { ...LEERER_FILTER, suche: 'patent' }).map(x => x.id)).toEqual(['G1.2']);
    expect(filterBausteine(KATALOG, { ...LEERER_FILTER, suche: 'rückna' }).map(x => x.id)).toEqual(['RNE-A1']);
  });

  it('zählt je Status', () => {
    expect(zaehleStatus(KATALOG)).toEqual({ entwurf: 1, freigegeben: 2, stillgelegt: 1 });
  });
});
