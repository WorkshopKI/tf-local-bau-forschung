import { describe, it, expect } from 'vitest';
import { stepNavDescriptor } from '../AbschnittNav';
import type { StepStatus } from '../types';

describe('stepNavDescriptor', () => {
  it('freigegeben → Haken, success', () => {
    expect(stepNavDescriptor('freigegeben')).toEqual({
      icon: 'check',
      statusLabel: 'freigegeben',
      tone: 'success',
    });
  });

  it('entwurf → Stift, in Arbeit', () => {
    expect(stepNavDescriptor('entwurf')).toEqual({
      icon: 'pencil',
      statusLabel: 'in Arbeit',
      tone: 'arbeit',
    });
  });

  it('leer → Kreis, offen', () => {
    expect(stepNavDescriptor('leer')).toEqual({
      icon: 'circle',
      statusLabel: 'offen',
      tone: 'offen',
    });
  });

  it('deckt alle StepStatus-Werte ab', () => {
    const all: StepStatus[] = ['leer', 'entwurf', 'freigegeben'];
    for (const s of all) {
      const d = stepNavDescriptor(s);
      expect(['check', 'pencil', 'circle']).toContain(d.icon);
      expect(d.statusLabel.length).toBeGreaterThan(0);
    }
  });
});
