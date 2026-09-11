/**
 * Frist-Satz und Frist-Zahl des Verbunds: der Kontext-Chip zählt nur, was der
 * Faktenblock auch sagt.
 *
 * Anlass CALYPSO: Verbund „abgelehnt/zurückgezogen", das einzige Teilvorhaben
 * im „Widerspruch zur Ablehnung" mit laufender Uhr. Faktenblock und Vorgangsakte
 * schwiegen zur Frist, der Chip meldete „1 Frist".
 */
import { describe, expect, it } from 'vitest';
import type { AntragListItem } from '@/core/services/csv/types';
import { MS_TAG } from '@/core/utils/zeitEinheiten';

import { verbundFrist } from '../kontextSnapshot';

const NOW = new Date('2026-07-16T00:00:00.000Z').getTime();

/** Teilvorhaben, dessen 90-Tage-Frist `restTage` von NOW entfernt liegt. */
function tv(aktenzeichen: string, restTage: number, status = 'techn geprüft'): AntragListItem {
  const antragsdatum = new Date(NOW - (90 - restTage) * MS_TAG).toISOString();
  return { aktenzeichen, programm_id: 'P', verbund_id: 'V1', status, antragsdatum } as AntragListItem;
}

describe('verbundFrist', () => {
  it('zählt die laufenden Uhren eines offenen Verbunds und nennt die knappste', () => {
    const f = verbundFrist('techn geprüft', [tv('A', 30), tv('B', 10)], NOW);
    expect(f.anzahl).toBe(2);
    expect(f.hinweis).toMatch(/dringend/);
  });

  it('ein abgeschlossener Verbund hat weder Frist-Satz noch Frist-Zahl', () => {
    const f = verbundFrist('abgelehnt/zurückgezogen', [tv('A', -304)], NOW);
    expect(f.hinweis).toBeUndefined();
    expect(f.anzahl).toBe(0);
  });
});
