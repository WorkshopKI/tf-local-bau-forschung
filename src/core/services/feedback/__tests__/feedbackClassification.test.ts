import { describe, expect, it } from 'vitest';
import {
  getFeedbackClassification,
  isClassifiedAs,
  isClassifiedFeedback,
} from '../feedbackClassification';
import { makeFeedback } from './fixtures';

describe('getFeedbackClassification', () => {
  it('liefert pending wenn category undefined ist', () => {
    const item = makeFeedback({ category: undefined });
    const c = getFeedbackClassification(item);
    expect(c).toEqual({ state: 'pending' });
  });

  it('liefert classified mit category wenn gesetzt', () => {
    const item = makeFeedback({ category: 'idea' });
    const c = getFeedbackClassification(item);
    expect(c).toEqual({ state: 'classified', category: 'idea' });
  });

  it('Discriminator narrowed im switch', () => {
    const item = makeFeedback({ category: 'problem' });
    const c = getFeedbackClassification(item);
    // Compiler-Test: in classified-Branch ist category typsicher zugreifbar
    if (c.state === 'classified') {
      expect(c.category).toBe('problem');
    } else {
      throw new Error('Expected classified state');
    }
  });
});

describe('isClassifiedFeedback', () => {
  it('false wenn category undefined', () => {
    const item = makeFeedback({ category: undefined });
    expect(isClassifiedFeedback(item)).toBe(false);
  });

  it('true wenn category gesetzt', () => {
    const item = makeFeedback({ category: 'praise' });
    expect(isClassifiedFeedback(item)).toBe(true);
  });

  it('narrowed type für nachgelagerte Lookups', () => {
    const item = makeFeedback({ category: 'question' });
    if (isClassifiedFeedback(item)) {
      // category ist hier nicht mehr optional
      const cat: 'praise' | 'problem' | 'idea' | 'question' = item.category;
      expect(cat).toBe('question');
    }
  });
});

describe('isClassifiedAs', () => {
  it('matcht nur die exakte Kategorie', () => {
    const isFeature = isClassifiedAs('idea');
    expect(isFeature(makeFeedback({ category: 'idea' }))).toBe(true);
    expect(isFeature(makeFeedback({ category: 'problem' }))).toBe(false);
    expect(isFeature(makeFeedback({ category: undefined }))).toBe(false);
  });

  it('funktioniert als Array.filter Type-Guard', () => {
    const items = [
      makeFeedback({ category: 'idea' }),
      makeFeedback({ category: undefined }),
      makeFeedback({ category: 'idea' }),
      makeFeedback({ category: 'problem' }),
    ];
    const features = items.filter(isClassifiedAs('idea'));
    expect(features).toHaveLength(2);
    // Type-Narrowing: kein optional mehr
    for (const f of features) {
      expect(f.category).toBe('idea');
    }
  });

  it('schließt Pending immer aus — selbst bei Lob/Frage-Filter', () => {
    const items = [
      makeFeedback({ category: 'praise' }),
      makeFeedback({ category: undefined }),
      makeFeedback({ category: 'question' }),
    ];
    expect(items.filter(isClassifiedAs('praise'))).toHaveLength(1);
    expect(items.filter(isClassifiedAs('question'))).toHaveLength(1);
  });
});
