/**
 * Pure Layout-/Navigations-Helfer für die Abschnitts-Navigation — ohne React,
 * damit sie unter `environment: 'node'` unit-testbar sind.
 */
import type { StepId } from './types';

/** Ab dieser Container-Breite (px) wird die vertikale Nav statt des kompakten Steppers gezeigt. */
export const NAV_VERTICAL_MIN_WIDTH = 640;

/** Welche Nav-Darstellung passt zur gegebenen Container-Breite? */
export function navLayout(width: number): 'vertikal' | 'kompakt' {
  return width >= NAV_VERTICAL_MIN_WIDTH ? 'vertikal' : 'kompakt';
}

/**
 * Nächste/vorige Step-ID für die Tastatur-Navigation (↓ = +1, ↑ = −1). Klemmt an
 * den Enden (kein Wrap); unbekannte `current` → erster Step; leere Liste → `current`.
 */
export function nextStepId(steps: readonly { id: StepId }[], current: StepId, dir: 1 | -1): StepId {
  if (steps.length === 0) return current;
  const idx = steps.findIndex(s => s.id === current);
  if (idx < 0) return steps[0]!.id;
  const next = idx + dir;
  if (next < 0 || next >= steps.length) return current;
  return steps[next]!.id;
}
