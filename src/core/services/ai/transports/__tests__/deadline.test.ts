/**
 * Tests für die aktivitätsbasierte Transport-Deadline (deadline.ts) — ersetzt
 * die starren Response-Timeouts der Streamlit-Bridge (v2.203).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createActivityDeadline } from '../deadline';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createActivityDeadline', () => {
  it('feuert nach idleMs ohne touch()', () => {
    const onExpire = vi.fn();
    createActivityDeadline({ idleMs: 1000, hardMs: 10_000, onExpire });
    vi.advanceTimersByTime(999);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('touch() schiebt den Idle-Timer beliebig oft unterhalb des Hard-Caps', () => {
    const onExpire = vi.fn();
    const d = createActivityDeadline({ idleMs: 1000, hardMs: 10_000, onExpire });
    for (let i = 0; i < 8; i++) {
      vi.advanceTimersByTime(900);
      d.touch();
    }
    // 7200ms vergangen, Aktivität alle 900ms → nie idle-expired
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('Hard-Cap feuert trotz kontinuierlicher Aktivität', () => {
    const onExpire = vi.fn();
    const d = createActivityDeadline({ idleMs: 1000, hardMs: 5000, onExpire });
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(500);
      d.touch();
    }
    // Bei t=5000 (10 × 500) hat der Hard-Timer bereits gefeuert
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('cancel() unterdrückt onExpire dauerhaft', () => {
    const onExpire = vi.fn();
    const d = createActivityDeadline({ idleMs: 1000, hardMs: 5000, onExpire });
    d.cancel();
    vi.advanceTimersByTime(20_000);
    expect(onExpire).not.toHaveBeenCalled();
    // touch nach cancel ist ein No-op (armiert nichts neu)
    d.touch();
    vi.advanceTimersByTime(20_000);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('onExpire feuert höchstens einmal (idle + hard konkurrieren nicht)', () => {
    const onExpire = vi.fn();
    createActivityDeadline({ idleMs: 1000, hardMs: 1000, onExpire });
    vi.advanceTimersByTime(5000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
