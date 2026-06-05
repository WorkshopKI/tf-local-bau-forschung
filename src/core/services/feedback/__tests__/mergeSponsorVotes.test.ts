import { describe, expect, it } from 'vitest';
import { mergeSponsorVotesIntoItems } from '../mergeSponsorVotes';
import type { SponsorVoteFile } from '../feedbackSponsorOutbox';
import { makeFeedback, makeSponsor } from './fixtures';

function voteFile(kuerzel: string, votes: Record<string, number>, updatedAt = '2026-06-05T10:00:00Z'): SponsorVoteFile {
  return { version: 1, kuerzel, votes, updatedAt };
}

describe('mergeSponsorVotesIntoItems', () => {
  it('aktualisiert eine bestehende Punkte-Stimme auf den neuen Betrag', () => {
    const item = makeFeedback({
      id: 't1',
      sponsors: [makeSponsor({ user_id: 'AAA', user_display_name: 'AAA', amount: 3 })],
    });
    const { items, aktualisiert, neu, entfernt } = mergeSponsorVotesIntoItems(
      [item],
      [voteFile('AAA', { t1: 5 })],
    );
    expect(aktualisiert).toBe(1);
    expect(neu).toBe(0);
    expect(entfernt).toBe(0);
    const s = items[0]?.sponsors?.find(x => x.user_id === 'AAA' && x.type === 'points');
    expect(s?.amount).toBe(5);
    expect(items[0]?.sponsor_points_total).toBe(5);
  });

  it('legt eine neue Punkte-Stimme an (created_at = Datei-Zeitstempel)', () => {
    const item = makeFeedback({ id: 't1', sponsors: [] });
    const { items, neu } = mergeSponsorVotesIntoItems(
      [item],
      [voteFile('CCC', { t1: 2 }, '2026-06-05T12:00:00Z')],
    );
    expect(neu).toBe(1);
    const s = items[0]?.sponsors?.find(x => x.user_id === 'CCC');
    expect(s?.amount).toBe(2);
    expect(s?.type).toBe('points');
    expect(s?.created_at).toBe('2026-06-05T12:00:00Z');
  });

  it('retrahiert: gelesener User ohne (oder mit 0) Stimme → Eintrag entfernt', () => {
    const item = makeFeedback({
      id: 't1',
      sponsors: [makeSponsor({ user_id: 'AAA', amount: 3 })],
    });
    // AAA hat die Datei abgegeben, aber t1 ist nicht mehr drin (zurückgezogen).
    const { items, entfernt } = mergeSponsorVotesIntoItems([item], [voteFile('AAA', {})]);
    expect(entfernt).toBe(1);
    expect(items[0]?.sponsors?.some(x => x.user_id === 'AAA')).toBe(false);
    expect(items[0]?.sponsor_points_total).toBe(0);
  });

  it('retrahiert bei Punkte 0 explizit', () => {
    const item = makeFeedback({ id: 't1', sponsors: [makeSponsor({ user_id: 'AAA', amount: 2 })] });
    const { items, entfernt } = mergeSponsorVotesIntoItems([item], [voteFile('AAA', { t1: 0 })]);
    expect(entfernt).toBe(1);
    expect(items[0]?.sponsors?.length).toBe(0);
  });

  it('lässt User unangetastet, deren Datei NICHT im Batch ist', () => {
    const item = makeFeedback({
      id: 't1',
      sponsors: [
        makeSponsor({ user_id: 'AAA', amount: 3 }),
        makeSponsor({ user_id: 'BBB', amount: 1 }),
      ],
    });
    // nur AAA im Batch (auf 4); BBB bleibt
    const { items } = mergeSponsorVotesIntoItems([item], [voteFile('AAA', { t1: 4 })]);
    const bbb = items[0]?.sponsors?.find(x => x.user_id === 'BBB');
    expect(bbb?.amount).toBe(1);
    const aaa = items[0]?.sponsors?.find(x => x.user_id === 'AAA');
    expect(aaa?.amount).toBe(4);
  });

  it('fasst Stunden-Sponsoring NIE an', () => {
    const item = makeFeedback({
      id: 't1',
      sponsors: [
        makeSponsor({ user_id: 'AAA', type: 'hours', amount: 8, project_ref: 'BA-1' }),
      ],
    });
    // AAA gibt eine Punkte-Stimme ab; der Stunden-Eintrag bleibt unberührt.
    const { items } = mergeSponsorVotesIntoItems([item], [voteFile('AAA', { t1: 2 })]);
    const hours = items[0]?.sponsors?.find(x => x.type === 'hours');
    expect(hours?.amount).toBe(8);
    const pts = items[0]?.sponsors?.find(x => x.type === 'points');
    expect(pts?.amount).toBe(2);
  });

  it('ignoriert Stimmen für nicht vorhandene Tickets', () => {
    const item = makeFeedback({ id: 't1', sponsors: [] });
    const { items, neu } = mergeSponsorVotesIntoItems([item], [voteFile('AAA', { tX: 3 })]);
    expect(neu).toBe(0);
    expect(items[0]?.sponsors?.length).toBe(0);
  });

  it('reicht unveränderte Items als gleiche Referenz durch', () => {
    const item = makeFeedback({ id: 't1', sponsors: [makeSponsor({ user_id: 'ZZZ', amount: 1 })] });
    const { items } = mergeSponsorVotesIntoItems([item], [voteFile('AAA', { t2: 1 })]);
    expect(items[0]).toBe(item);
  });
});
