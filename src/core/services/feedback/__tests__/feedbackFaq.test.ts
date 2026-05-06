import { describe, expect, it } from 'vitest';
import { matchFaqEntries } from '../feedbackFaq';
import { makeFeedback } from './fixtures';

describe('matchFaqEntries', () => {
  it('liefert leeres Array wenn input nur Stoppwörter enthält', () => {
    const faqs = [makeFeedback({ id: 'f1', is_faq: true, text: 'Wie funktioniert die Suche?' })];
    expect(matchFaqEntries('was ist das?', faqs)).toEqual([]);
  });

  it('ignoriert Items ohne is_faq=true', () => {
    const items = [
      makeFeedback({ id: 'a', is_faq: false, text: 'Suche funktioniert nicht' }),
      makeFeedback({ id: 'b', text: 'Suche funktioniert nicht' }), // is_faq fehlt
    ];
    expect(matchFaqEntries('Suche funktioniert nicht', items)).toEqual([]);
  });

  it('matcht bei min. 2 überlappenden Tokens', () => {
    const faqs = [
      makeFeedback({
        id: 'f1',
        is_faq: true,
        llm_summary: 'Volltextsuche findet Dokumente nicht',
      }),
    ];
    const matches = matchFaqEntries('Volltextsuche findet keine Dokumente', faqs);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.item.id).toBe('f1');
    expect(matches[0]?.score).toBeGreaterThanOrEqual(2);
  });

  it('sortiert absteigend nach Score', () => {
    // Query enthält 4 contentful Tokens: Volltextsuche, Dokumente, Treffer, Index.
    // (`werden`, `nicht` sind Stoppwörter, deshalb keine guten Tokens.)
    const faqs = [
      makeFeedback({
        id: 'low',
        is_faq: true,
        llm_summary: 'Volltextsuche Dokumente', // 2 Treffer
      }),
      makeFeedback({
        id: 'high',
        is_faq: true,
        llm_summary: 'Volltextsuche Dokumente Treffer Index', // 4 Treffer
      }),
    ];
    const matches = matchFaqEntries('Volltextsuche Dokumente Treffer Index', faqs);
    expect(matches).toHaveLength(2);
    expect(matches[0]?.item.id).toBe('high');
    expect(matches[1]?.item.id).toBe('low');
    expect(matches[0]!.score).toBeGreaterThan(matches[1]!.score);
  });

  it('zieht faq_keywords zusätzlich zur summary in Token-Set', () => {
    const faqs = [
      makeFeedback({
        id: 'f1',
        is_faq: true,
        llm_summary: 'kurzer Hinweis',
        faq_keywords: ['volltextsuche', 'kuration'],
      }),
    ];
    const matches = matchFaqEntries('volltextsuche kuration', faqs);
    expect(matches).toHaveLength(1);
  });

  it('limitiert auf maximal 4 Treffer', () => {
    const faqs = Array.from({ length: 10 }, (_, i) =>
      makeFeedback({
        id: `f${i}`,
        is_faq: true,
        llm_summary: 'Volltextsuche Dokumente Treffer Index',
      }),
    );
    const matches = matchFaqEntries('Volltextsuche Dokumente Treffer', faqs);
    expect(matches.length).toBeLessThanOrEqual(4);
  });

  it('Token unter 3 Zeichen werden ignoriert', () => {
    // "wo" und "es" wären 2 Zeichen → fallen raus, kein Match.
    const faqs = [makeFeedback({ id: 'f1', is_faq: true, llm_summary: 'wo es klemmt' })];
    expect(matchFaqEntries('wo es', faqs)).toEqual([]);
  });

  it('case-insensitiv', () => {
    const faqs = [makeFeedback({ id: 'f1', is_faq: true, llm_summary: 'Volltextsuche Treffer' })];
    const matches = matchFaqEntries('VOLLTEXTSUCHE TREFFER', faqs);
    expect(matches).toHaveLength(1);
  });
});
