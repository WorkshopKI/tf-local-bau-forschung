import { describe, it, expect } from 'vitest';
import { navLayout, nextStepId, NAV_VERTICAL_MIN_WIDTH } from '../nav-layout';

describe('navLayout', () => {
  it('vertikal ab der Schwelle, kompakt darunter', () => {
    expect(navLayout(NAV_VERTICAL_MIN_WIDTH)).toBe('vertikal');
    expect(navLayout(NAV_VERTICAL_MIN_WIDTH - 1)).toBe('kompakt');
    expect(navLayout(1200)).toBe('vertikal');
    expect(navLayout(320)).toBe('kompakt');
    expect(navLayout(0)).toBe('kompakt');
  });
});

describe('nextStepId', () => {
  const steps = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];

  it('geht vor und zurück', () => {
    expect(nextStepId(steps, 'A', 1)).toBe('B');
    expect(nextStepId(steps, 'B', 1)).toBe('C');
    expect(nextStepId(steps, 'C', -1)).toBe('B');
  });

  it('klemmt an den Enden (kein Wrap)', () => {
    expect(nextStepId(steps, 'A', -1)).toBe('A');
    expect(nextStepId(steps, 'C', 1)).toBe('C');
  });

  it('unbekannte current → erster Step; leere Liste → current', () => {
    expect(nextStepId(steps, 'Z', 1)).toBe('A');
    expect(nextStepId([], 'A', 1)).toBe('A');
  });
});
