/**
 * Fixture-Builder für Feedback-Unit-Tests.
 *
 * Hält Defaults für Pflicht-Felder, damit die Tests nur die testrelevanten
 * Felder explizit setzen müssen. Im Stil des unterprogrammLabelXlsx.test
 * `makeUp()`-Helpers.
 */

import type {
  FeedbackContext,
  FeedbackItem,
  FeedbackSponsor,
} from '@/core/types/feedback';

const DEFAULT_CONTEXT: FeedbackContext = {
  route: 'home',
  page: 'Home',
  device: 'Desktop',
  viewport: '1920x1080',
  sessionDuration: 60,
  errors: [],
  timestamp: '2026-01-01T00:00:00Z',
};

let counter = 0;

/** Fixture-Builder. Default-Felder können per Override-Argument überschrieben werden. */
export function makeFeedback(overrides: Partial<FeedbackItem> = {}): FeedbackItem {
  counter++;
  return {
    id: `fb-test-${counter}`,
    created_at: '2026-01-01T00:00:00Z',
    user_id: 'tester',
    text: 'Default test feedback',
    context: { ...DEFAULT_CONTEXT, ...(overrides.context ?? {}) },
    kurator_status: 'neu',
    ...overrides,
    // context muss nach overrides bleiben, sonst überschreibt overrides nicht den Sub-Merge
    ...(overrides.context ? { context: { ...DEFAULT_CONTEXT, ...overrides.context } } : {}),
  };
}

export function makeSponsor(overrides: Partial<FeedbackSponsor> = {}): FeedbackSponsor {
  return {
    user_id: 'tester',
    user_display_name: 'Tester',
    type: 'points',
    amount: 1,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}
