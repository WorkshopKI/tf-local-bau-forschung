/**
 * Stale-Guard: eine veraltete Datei aus der Ordnerleiche darf nichts zurückziehen.
 *
 * Seit v4.1 liegen die persönlichen Ordner unter mehreren Wurzeln. Bei einem
 * Gruppenwechsel bleibt der alte Ordner oft stehen — derselbe Anwender wird
 * dann ZWEIMAL gelesen, in zwei getrennten Aufrufen nacheinander. Ohne Guard
 * entschiede die Wurzel-Reihenfolge: käme die alte Datei als zweite, zöge sie
 * die frische Stimme wieder zurück. Genau das wird hier in beiden Richtungen
 * geprüft.
 */
import { describe, it, expect } from 'vitest';
import { mergeSponsorVotesIntoItems, istStrengAelter } from '../mergeSponsorVotes';
import { mergeVotesIntoItems } from '../mergeFeedbackVotes';
import type { SponsorVoteFile } from '../feedbackSponsorOutbox';
import type { VoteFile } from '../feedbackVoteOutbox';
import type { FeedbackItem } from '@/core/types/feedback';

const ALT = '2026-01-01T00:00:00Z';
const NEU = '2026-08-01T00:00:00Z';

const sponsorDatei = (updatedAt: string, votes: Record<string, number>): SponsorVoteFile =>
  ({ version: 1, kuerzel: 'MUE', updatedAt, votes } as SponsorVoteFile);

const voteDatei = (updatedAt: string, ticketIds: string[]): VoteFile =>
  ({ version: 1, kuerzel: 'MUE', updatedAt, ticketIds } as VoteFile);

function ticket(over: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id: 't1',
    title: 'Ticket',
    description: '',
    category: 'idea',
    status: 'open',
    created_at: ALT,
    updated_at: ALT,
    user_id: 'AAA',
    user_display_name: 'AAA',
    ...over,
  } as FeedbackItem;
}

describe('istStrengAelter', () => {
  it('nur STRIKT älter zählt — gleich oder unparsebar nicht', () => {
    // Damit verhalten sich Bestandsdaten und der Normalfall „dieselbe Datei
    // nochmal gelesen" exakt wie vor dem Guard.
    expect(istStrengAelter(ALT, NEU)).toBe(true);
    expect(istStrengAelter(NEU, ALT)).toBe(false);
    expect(istStrengAelter(NEU, NEU)).toBe(false);
    expect(istStrengAelter(undefined, NEU)).toBe(false);
    expect(istStrengAelter(ALT, undefined)).toBe(false);
    expect(istStrengAelter('gestern', NEU)).toBe(false);
  });
});

describe('mergeSponsorVotesIntoItems — Stale-Guard', () => {
  it('eine ältere Datei zieht die frische Stimme NICHT zurück', () => {
    const mitFrischerStimme = ticket({
      sponsors: [{ user_id: 'MUE', user_display_name: 'MUE', type: 'points', amount: 3, created_at: NEU }],
      sponsor_points_total: 3,
      sponsor_hours_total: 0,
    });
    // Zweiter Lauf, andere Wurzel: die alte Datei kennt das Ticket nicht mehr.
    const res = mergeSponsorVotesIntoItems([mitFrischerStimme], [
      sponsorDatei(ALT, {}),
    ]);
    expect(res.entfernt).toBe(0);
    expect(res.items[0]?.sponsors).toHaveLength(1);
    expect(res.items[0]?.sponsors?.[0]?.amount).toBe(3);
  });

  it('eine ältere Datei überschreibt die Punktzahl NICHT', () => {
    const mitFrischerStimme = ticket({
      sponsors: [{ user_id: 'MUE', user_display_name: 'MUE', type: 'points', amount: 3, created_at: NEU }],
      sponsor_points_total: 3,
      sponsor_hours_total: 0,
    });
    const res = mergeSponsorVotesIntoItems([mitFrischerStimme], [
      sponsorDatei(ALT, { t1: 9 }),
    ]);
    expect(res.aktualisiert).toBe(0);
    expect(res.items[0]?.sponsors?.[0]?.amount).toBe(3);
  });

  it('eine NEUERE Datei wirkt weiterhin — auch retrahierend', () => {
    const mitAlterStimme = ticket({
      sponsors: [{ user_id: 'MUE', user_display_name: 'MUE', type: 'points', amount: 3, created_at: ALT }],
      sponsor_points_total: 3,
      sponsor_hours_total: 0,
    });
    const res = mergeSponsorVotesIntoItems([mitAlterStimme], [
      sponsorDatei(NEU, {}),
    ]);
    expect(res.entfernt).toBe(1);
    expect(res.items[0]?.sponsors).toHaveLength(0);
  });

  it('gleicher Zeitstempel = heutiges Verhalten (Retraktion greift)', () => {
    const t = ticket({
      sponsors: [{ user_id: 'MUE', user_display_name: 'MUE', type: 'points', amount: 3, created_at: NEU }],
      sponsor_points_total: 3,
      sponsor_hours_total: 0,
    });
    const res = mergeSponsorVotesIntoItems([t], [sponsorDatei(NEU, {})]);
    expect(res.entfernt).toBe(1);
  });
});

describe('mergeVotesIntoItems — Stale-Guard', () => {
  it('eine ältere Datei zieht den frischen Vote NICHT zurück', () => {
    const mitVote = ticket({
      votes: [{ user_id: 'MUE', user_display_name: 'MUE', created_at: NEU }],
    });
    const res = mergeVotesIntoItems([mitVote], [voteDatei(ALT, [])]);
    expect(res.entfernt).toBe(0);
    expect(res.items[0]?.votes).toHaveLength(1);
  });

  it('eine NEUERE Datei retrahiert weiterhin', () => {
    const mitVote = ticket({
      votes: [{ user_id: 'MUE', user_display_name: 'MUE', created_at: ALT }],
    });
    const res = mergeVotesIntoItems([mitVote], [voteDatei(NEU, [])]);
    expect(res.entfernt).toBe(1);
    expect(res.items[0]?.votes).toHaveLength(0);
  });

  it('Reihenfolge der Wurzeln ändert das Endergebnis nicht', () => {
    // Frische Datei (Wurzel B) und Leiche (Wurzel A) — zwei Aufrufe, beide
    // Reihenfolgen muessen mit „Stimme steht" enden.
    const leer = ticket({ votes: [] });
    const frisch = voteDatei(NEU, ['t1']);
    const leiche = voteDatei(ALT, []);

    const abFolge = mergeVotesIntoItems(
      mergeVotesIntoItems([leer], [leiche]).items, [frisch],
    );
    const baFolge = mergeVotesIntoItems(
      mergeVotesIntoItems([leer], [frisch]).items, [leiche],
    );

    expect(abFolge.items[0]?.votes).toHaveLength(1);
    expect(baFolge.items[0]?.votes).toHaveLength(1);
  });
});
