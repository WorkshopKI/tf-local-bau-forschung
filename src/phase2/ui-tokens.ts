/**
 * Design-Tokens für Phase-2-UI (Review-Queue).
 *
 * In dieser Phase nur die Konstanten — die eigentliche UI kommt in einem
 * Folge-Patch und konsumiert sie. Konvention: `text-{color}-800 bg-{color}-50`
 * (warm-gray dark mode, monochrome-first wie in DESIGN_GUIDE.md).
 */

import type { ClassifierSource, MatchConfidence } from './types';

export const CONFIDENCE_BADGE_CLASSES: Record<NonNullable<MatchConfidence>, string> = {
  high: 'text-emerald-800 bg-emerald-50',
  medium: 'text-amber-800 bg-amber-50',
  low: 'text-orange-800 bg-orange-50',
  orphan: 'text-rose-800 bg-rose-50',
};

export const TRIAGE_SOURCE_BADGE_CLASSES: Record<ClassifierSource, string> = {
  dms_csv: 'text-sky-800 bg-sky-50',
  stage1: 'text-slate-800 bg-slate-50',
  stage2: 'text-slate-800 bg-slate-50',
  stage3: 'text-violet-800 bg-violet-50',
  manual: 'text-indigo-800 bg-indigo-50',
};
