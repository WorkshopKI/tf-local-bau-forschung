import { describe, it, expect } from 'vitest';
import { typVorschlag, AUFNAHME_TYPEN, type AufnahmeTyp } from '../dateiTyp';

describe('typVorschlag', () => {
  it('vorhabensbeschreibung / vb', () => {
    expect(typVorschlag('Vorhabensbeschreibung_16EP.pdf')).toBe('vorhabensbeschreibung');
    expect(typVorschlag('16EP001234-VB.docx')).toBe('vorhabensbeschreibung');
  });
  it('teilvorhaben / tvb', () => {
    expect(typVorschlag('Teilvorhabenbeschreibung TV2.pdf')).toBe('teilvorhabensbeschreibung');
    expect(typVorschlag('tvb_partnerB.docx')).toBe('teilvorhabensbeschreibung');
  });
  it('stellungnahme', () => {
    expect(typVorschlag('Stellungnahme_Gutachter.pdf')).toBe('stellungnahme');
  });
  it('unklar als Fallback', () => {
    expect(typVorschlag('Anlage 3.pdf')).toBe('unklar');
  });
  it('trenner-/case-tolerant', () => {
    expect(typVorschlag('16EP__VORHABENS-BESCHREIBUNG.PDF')).toBe('vorhabensbeschreibung');
  });
  it('AUFNAHME_TYPEN enthält genau die vier Werte', () => {
    expect(AUFNAHME_TYPEN).toEqual<AufnahmeTyp[]>(
      ['vorhabensbeschreibung', 'teilvorhabensbeschreibung', 'stellungnahme', 'unklar']);
  });
});
