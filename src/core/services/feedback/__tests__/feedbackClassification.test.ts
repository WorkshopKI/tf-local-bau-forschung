import { describe, expect, it } from 'vitest';
import {
  AUSLASTUNG_PLUGIN_ID,
  classifyByKeywords,
  getFeedbackClassification,
  isAuslastungFeedback,
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
      const cat: 'praise' | 'problem' | 'idea' | 'ux' | 'question' = item.category;
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

describe('isAuslastungFeedback', () => {
  // route auf einem vollständigen Default-Context überschreiben (Typ erwartet
  // full FeedbackContext, daher über das fertige Item spreaden).
  const withRoute = (route: string) => {
    const item = makeFeedback();
    return { ...item, context: { ...item.context, route } };
  };

  it('true wenn context.route das Auslastungs-Modul ist', () => {
    expect(isAuslastungFeedback(withRoute(AUSLASTUNG_PLUGIN_ID))).toBe(true);
  });

  it('false für anderes Modul (z.B. Förderanträge)', () => {
    expect(isAuslastungFeedback(withRoute('antraege'))).toBe(false);
  });

  it('blendet als Array.filter Auslastungs-Feedback aus', () => {
    const items = [
      withRoute(AUSLASTUNG_PLUGIN_ID),
      withRoute('antraege'),
      withRoute('home'),
    ];
    const ohneAuslastung = items.filter(i => !isAuslastungFeedback(i));
    expect(ohneAuslastung).toHaveLength(2);
    expect(ohneAuslastung.some(isAuslastungFeedback)).toBe(false);
  });
});

describe('classifyByKeywords', () => {
  it('erkennt Bugs an Defekt-Signalen', () => {
    expect(classifyByKeywords('Die Suche funktioniert nicht')).toBe('problem');
    expect(classifyByKeywords('Seite stürzt ab beim Öffnen')).toBe('problem');
  });

  it('erkennt Feature-Wünsche', () => {
    expect(classifyByKeywords('Ich wünsche mir einen Dark Mode')).toBe('idea');
    expect(classifyByKeywords('müll, nach alter sortieren')).toBe('idea');
    expect(classifyByKeywords('in der suche Filter für Antragstyp')).toBe('idea');
  });

  it('erkennt UX-Wünsche an Umständlich-Signalen — und vor idea', () => {
    expect(classifyByKeywords('Das ist viel zu umständlich')).toBe('ux');
    expect(classifyByKeywords('Die Maske ist unübersichtlich')).toBe('ux');
    // UX schlägt idea: "umständlich" (ux) gewinnt gegen "sortieren" (idea)
    expect(classifyByKeywords('umständlich zu sortieren')).toBe('ux');
  });

  it('erkennt Fragen an abschließendem ?', () => {
    expect(classifyByKeywords('Wie exportiere ich die Liste?')).toBe('question');
  });

  it('erkennt Lob — aber nicht an bloßem "gut"', () => {
    expect(classifyByKeywords('homeage sehr gut')).toBe('praise');
    expect(classifyByKeywords('Ich finde gut, dass die Seite aktuell ist')).toBe('praise');
    expect(classifyByKeywords('seite gut')).toBeUndefined();
  });

  it('Feature-Signal schlägt Lob (Reihenfolge)', () => {
    // "fehlt" (feature) gewinnt gegen "toll" (praise)
    expect(classifyByKeywords('Wäre toll, aber mir fehlt ein Filter')).toBe('idea');
  });

  it('kein Treffer → undefined (bleibt unklassifiziert)', () => {
    expect(classifyByKeywords('asdf qwer')).toBeUndefined();
  });
});
