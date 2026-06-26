import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FEEDBACK_CONFIG,
  DEFAULT_HOURS_TO_POINTS_FACTOR,
} from '@/core/types/feedback';
import type { FeedbackConfig } from '@/core/types/feedback';
import {
  getSponsoringProgress,
  isSponsorableCategory,
  isSponsoringOpen,
} from '../feedbackSponsoring';
import { makeFeedback, makeSponsor } from './fixtures';

const baseConfig: FeedbackConfig = { ...DEFAULT_FEEDBACK_CONFIG };

describe('isSponsorableCategory', () => {
  it('idea + ux sind sponsorbar', () => {
    expect(isSponsorableCategory('idea')).toBe(true);
    expect(isSponsorableCategory('ux')).toBe(true);
  });

  it('problem, praise, question, undefined sind nicht sponsorbar', () => {
    expect(isSponsorableCategory('problem')).toBe(false);
    expect(isSponsorableCategory('praise')).toBe(false);
    expect(isSponsorableCategory('question')).toBe(false);
    expect(isSponsorableCategory(undefined)).toBe(false);
  });
});

describe('isSponsoringOpen — sponsorbare Kategorien', () => {
  it('öffnet für UX-Tickets mit Aufwand + offenem Status (wie Features)', () => {
    expect(isSponsoringOpen(makeFeedback({ category: 'ux', effort_estimate: 'M', kurator_status: 'neu' }))).toBe(true);
    expect(isSponsoringOpen(makeFeedback({ category: 'idea', effort_estimate: 'M', kurator_status: 'geplant' }))).toBe(true);
  });

  it('bleibt zu für Bugs', () => {
    expect(isSponsoringOpen(makeFeedback({ category: 'problem', effort_estimate: 'M', kurator_status: 'neu' }))).toBe(false);
  });
});

describe('getSponsoringProgress', () => {
  it('leere Sponsoren → 0/0', () => {
    const ticket = makeFeedback({ category: 'idea', effort_estimate: 'M' });
    const p = getSponsoringProgress(ticket, baseConfig);
    expect(p.pointsTotal).toBe(0);
    expect(p.hoursTotal).toBe(0);
    expect(p.combinedPoints).toBe(0);
    expect(p.percentage).toBe(0);
    expect(p.thresholdReached).toBe(false);
    expect(p.sponsorCount).toBe(0);
    expect(p.threshold).toBe(15); // M = 15 (Default)
  });

  it('Punkte summieren über mehrere Sponsoren', () => {
    const ticket = makeFeedback({
      category: 'idea',
      effort_estimate: 'S',
      sponsors: [
        makeSponsor({ type: 'points', amount: 2 }),
        makeSponsor({ type: 'points', amount: 3, user_id: 'b' }),
      ],
    });
    const p = getSponsoringProgress(ticket, baseConfig);
    expect(p.pointsTotal).toBe(5);
    expect(p.threshold).toBe(5); // S = 5
    expect(p.thresholdReached).toBe(true);
    expect(p.percentage).toBe(100);
  });

  it('Stunden × Faktor in combined einrechnen', () => {
    const ticket = makeFeedback({
      category: 'idea',
      effort_estimate: 'L',
      sponsors: [
        makeSponsor({ type: 'hours', amount: 4, project_ref: 'P1' }),
      ],
    });
    const p = getSponsoringProgress(ticket, baseConfig);
    expect(p.hoursTotal).toBe(4);
    expect(p.combinedPoints).toBe(4 * DEFAULT_HOURS_TO_POINTS_FACTOR); // 4 * 3 = 12
    expect(p.threshold).toBe(30); // L = 30
    expect(p.percentage).toBe(40);
    expect(p.thresholdReached).toBe(false);
  });

  it('Punkte + Stunden mischen', () => {
    const ticket = makeFeedback({
      category: 'idea',
      effort_estimate: 'M',
      sponsors: [
        makeSponsor({ type: 'points', amount: 6 }),
        makeSponsor({ type: 'hours', amount: 3, project_ref: 'P1', user_id: 'b' }),
      ],
    });
    const p = getSponsoringProgress(ticket, baseConfig);
    expect(p.combinedPoints).toBe(6 + 3 * 3); // 15
    expect(p.threshold).toBe(15);
    expect(p.thresholdReached).toBe(true);
    expect(p.sponsorCount).toBe(2);
  });

  it('percentage cap bei 100', () => {
    const ticket = makeFeedback({
      category: 'idea',
      effort_estimate: 'S',
      sponsors: [makeSponsor({ type: 'points', amount: 999 })],
    });
    expect(getSponsoringProgress(ticket, baseConfig).percentage).toBe(100);
  });

  it('threshold=0 wenn effort_estimate fehlt', () => {
    const ticket = makeFeedback({ category: 'idea' });
    const p = getSponsoringProgress(ticket, baseConfig);
    expect(p.threshold).toBe(0);
    expect(p.percentage).toBe(0);
    expect(p.thresholdReached).toBe(false);
  });

  it('berücksichtigt config-Override für Faktor und Schwellen', () => {
    const cfg: FeedbackConfig = {
      ...baseConfig,
      hours_to_points_factor: 5,
      sponsoring_thresholds: { XS: 5, S: 10, M: 20, L: 40, XL: 80, XXL: 120, Epic: 200 },
    };
    const ticket = makeFeedback({
      category: 'idea',
      effort_estimate: 'M',
      sponsors: [makeSponsor({ type: 'hours', amount: 2, project_ref: 'P1' })],
    });
    const p = getSponsoringProgress(ticket, cfg);
    expect(p.combinedPoints).toBe(2 * 5);
    expect(p.threshold).toBe(20);
    expect(p.percentage).toBe(50);
  });
});

describe('isSponsoringOpen', () => {
  it('false bei category !== idea', () => {
    expect(isSponsoringOpen(makeFeedback({ category: 'problem', effort_estimate: 'M' }))).toBe(false);
    expect(isSponsoringOpen(makeFeedback({ category: 'praise', effort_estimate: 'M' }))).toBe(false);
    expect(isSponsoringOpen(makeFeedback({ category: undefined, effort_estimate: 'M' }))).toBe(false);
  });

  it('false ohne effort_estimate', () => {
    expect(isSponsoringOpen(makeFeedback({ category: 'idea' }))).toBe(false);
  });

  it('true bei idea + effort + status=neu', () => {
    expect(isSponsoringOpen(makeFeedback({
      category: 'idea',
      effort_estimate: 'M',
      kurator_status: 'neu',
    }))).toBe(true);
  });

  it('true bei idea + effort + status=geplant', () => {
    expect(isSponsoringOpen(makeFeedback({
      category: 'idea',
      effort_estimate: 'M',
      kurator_status: 'geplant',
    }))).toBe(true);
  });

  it('false sobald in_bearbeitung / umgesetzt / abgelehnt / archiviert', () => {
    for (const s of ['in_bearbeitung', 'umgesetzt', 'abgelehnt', 'archiviert'] as const) {
      expect(isSponsoringOpen(makeFeedback({
        category: 'idea',
        effort_estimate: 'M',
        kurator_status: s,
      }))).toBe(false);
    }
  });
});
