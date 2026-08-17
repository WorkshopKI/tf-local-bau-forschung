/**
 * Reine Tests des Arbeitsvorrat-Übersicht-Bauers (Assistent-Panel v1.1). `now`
 * injiziert (statt `Date.now()`), damit die frist-relativen Buckets deterministisch
 * sind. Frist = antragsdatum + 90 Tage (Antragsphase, Status nicht in Begleitphase).
 */
import { describe, expect, it } from 'vitest';
import type { AntragListItem } from '@/core/services/csv/types';
import { MS_PER_DAY } from '@/core/services/csv/frist';
import { baueArbeitsvorratUebersicht, NAECHSTE_FRISTEN_CAP } from '../arbeitsvorratUebersicht';

const NOW = new Date('2026-07-16T00:00:00.000Z').getTime();

/** Antrag, dessen 90-Tage-Frist `restTage` von NOW entfernt liegt (`null` = kein
 *  Antragsdatum → keine berechenbare Frist). Status default „techn geprüft"
 *  (in_pruefung, Antragsphase → stabile Aktion, keine PreCheck-Interferenz). */
function antrag(
  aktenzeichen: string,
  opts: { restTage: number | null; status?: string; akronym?: string },
): AntragListItem {
  const { restTage, status = 'techn geprüft', akronym } = opts;
  const antragsdatum = restTage === null ? '' : new Date(NOW - (90 - restTage) * MS_PER_DAY).toISOString();
  return { aktenzeichen, programm_id: 'P', status, antragsdatum, akronym } as AntragListItem;
}

describe('baueArbeitsvorratUebersicht', () => {
  it('bucketet nach Frist-Ampel, sortiert nach nächster Frist, exkludiert Terminale', () => {
    const u = baueArbeitsvorratUebersicht([
      antrag('A-gruen', { restTage: 60, akronym: 'GRUEN' }),
      antrag('A-rot', { restTage: -10, akronym: 'ROT' }),
      antrag('A-orange', { restTage: 10, akronym: 'ORANGE' }),
      antrag('A-gelb', { restTage: 25, akronym: 'GELB' }),
      antrag('A-fristlos', { restTage: null, akronym: 'FRISTLOS' }),
      antrag('A-terminal', { restTage: 5, status: 'Schlussvermerk', akronym: 'TERM' }),
    ], NOW);

    expect(u.gesamtInArbeit).toBe(5); // 4 mit Frist + 1 fristlos; terminal exkludiert
    expect(u.ueberfaellig).toBe(1);   // rot
    expect(u.dringend).toBe(2);       // orange + gelb
    // Nächste Frist zuerst (überfällig ganz vorn), fristlos nicht gelistet.
    expect(u.naechsteFristen.map(f => f.titel)).toEqual(['ROT', 'ORANGE', 'GELB', 'GRUEN']);
    expect(u.naechsteFristen.map(f => f.hinweis)).toEqual([
      'seit 10 T (überfällig)',
      'in 10 T (dringend)',
      'in 25 T (näher rückend)',
      'in 60 T (im Zeitplan)',
    ]);
    // Aktion aus naechsterSchritt (techn geprüft → „Gutachten beginnen").
    expect(u.naechsteFristen.every(f => f.aktion === 'Gutachten beginnen')).toBe(true);
  });

  it('kappt die Liste bei NAECHSTE_FRISTEN_CAP, zählt aber ALLE Fristen in die Buckets', () => {
    const many = Array.from({ length: 7 }, (_, i) => antrag(`A${i}`, { restTage: i + 1, akronym: `A${i}` }));
    const u = baueArbeitsvorratUebersicht(many, NOW);
    expect(u.naechsteFristen).toHaveLength(NAECHSTE_FRISTEN_CAP); // 5 gelistet
    expect(u.dringend).toBe(7);        // aber alle 7 (restTage 1..7 ≤ 14 → orange) gezählt
    expect(u.gesamtInArbeit).toBe(7);
    // Die 5 gelisteten sind die frühesten Fristen.
    expect(u.naechsteFristen.map(f => f.titel)).toEqual(['A0', 'A1', 'A2', 'A3', 'A4']);
  });

  it('leerer/rein-terminaler Bestand → leere Übersicht (Assembler omittet den Block)', () => {
    expect(baueArbeitsvorratUebersicht([], NOW))
      .toEqual({ gesamtInArbeit: 0, ueberfaellig: 0, dringend: 0, naechsteFristen: [] });
    const nurTerminal = [
      antrag('T1', { restTage: 5, status: 'Schlussvermerk' }),
      // NICHT `abgebrochen`: der ist seit v4.87 Begleitung, also in Arbeit.
      antrag('T2', { restTage: -3, status: 'abgelehnt/zurückgezogen' }),
    ];
    expect(baueArbeitsvorratUebersicht(nurTerminal, NOW).gesamtInArbeit).toBe(0);
  });

  it('ist deterministisch bei fixem now; ein verschobenes now verschiebt die Ampel', () => {
    const eine = [antrag('A', { restTage: 10 })];
    expect(baueArbeitsvorratUebersicht(eine, NOW)).toEqual(baueArbeitsvorratUebersicht(eine, NOW));
    // 20 Tage später ist die (ehemals in 10 T fällige) Frist überfällig.
    expect(baueArbeitsvorratUebersicht(eine, NOW + 20 * MS_PER_DAY).ueberfaellig).toBe(1);
  });
});
