import { describe, it, expect } from 'vitest';
import { aggregate } from '../aggregate';
import type { FeedbackEvent, UsageEvent } from '../types';

const usage = (skillId: string, ts: string, v = 1): UsageEvent => ({
  skillId, skillVersion: v, event: 'lauf', ts, userId: 'U',
});
const fb = (skillId: string, rating: 'up' | 'down', ts: string, notiz?: string, v = 1): FeedbackEvent => ({
  skillId, skillVersion: v, rating, ts, userId: 'U', ...(notiz ? { notiz } : {}),
});

describe('aggregate — rein', () => {
  it('leere Eingabe → leere Map', () => {
    expect(aggregate([]).size).toBe(0);
  });

  it('zählt Nutzung, up/down, jüngste Nutzung und sammelt Kommentare', () => {
    const map = aggregate([
      usage('s1', '2026-06-01T00:00:00Z'),
      usage('s1', '2026-06-03T00:00:00Z'),
      usage('s1', '2026-06-02T00:00:00Z'),
      fb('s1', 'up', '2026-06-04T00:00:00Z', 'gut'),
      fb('s1', 'down', '2026-06-05T00:00:00Z'),
      fb('s1', 'up', '2026-06-06T00:00:00Z', 'zu lang', 2),
    ]);
    const e = map.get('s1')!;
    expect(e.nutzung).toBe(3);
    expect(e.up).toBe(2);
    expect(e.down).toBe(1);
    expect(e.letzteNutzung).toBe('2026-06-03T00:00:00Z');
    expect(e.kommentare).toEqual([
      { notiz: 'gut', ts: '2026-06-04T00:00:00Z', userId: 'U', version: 1 },
      { notiz: 'zu lang', ts: '2026-06-06T00:00:00Z', userId: 'U', version: 2 },
    ]);
  });

  it('trennt verschiedene Skills', () => {
    const map = aggregate([usage('a', 't1'), usage('b', 't1'), fb('b', 'down', 't2')]);
    expect(map.get('a')!.nutzung).toBe(1);
    expect(map.get('b')!.nutzung).toBe(1);
    expect(map.get('b')!.down).toBe(1);
    expect(map.get('a')!.letzteNutzung).toBe('t1');
  });

  it('Skill ohne Nutzung behält letzteNutzung = null', () => {
    const map = aggregate([fb('only-feedback', 'up', 't')]);
    expect(map.get('only-feedback')!.letzteNutzung).toBeNull();
    expect(map.get('only-feedback')!.nutzung).toBe(0);
  });
});
