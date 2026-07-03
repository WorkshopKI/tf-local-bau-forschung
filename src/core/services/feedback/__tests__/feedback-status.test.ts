import { describe, it, expect } from 'vitest';
import { toggleUmgesetzt } from '../feedback-status';
import type { FeedbackStatus } from '@/core/types/feedback';

/**
 * `toggleUmgesetzt` treibt den 1-Klick-„Abhaken"-Knopf in der Kurator-Ticket-
 * Liste: ein Klick setzt „umgesetzt", nochmal klicken macht rückgängig (→ „neu").
 * Feinere Stati bleiben dem Detail-Dropdown vorbehalten.
 */
describe('toggleUmgesetzt', () => {
  it('setzt einen nicht-umgesetzten Status auf "umgesetzt"', () => {
    const others: FeedbackStatus[] = ['neu', 'geplant', 'in_bearbeitung', 'abgelehnt', 'archiviert'];
    for (const s of others) {
      expect(toggleUmgesetzt(s)).toBe('umgesetzt');
    }
  });

  it('schaltet "umgesetzt" zurück auf "neu"', () => {
    expect(toggleUmgesetzt('umgesetzt')).toBe('neu');
  });
});
