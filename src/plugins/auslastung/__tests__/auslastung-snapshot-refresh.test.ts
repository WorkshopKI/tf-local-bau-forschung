/**
 * Snapshot-getriebenes Cache-Refresh (v2.26.x): Das Auslastungs-Modul übernimmt
 * neue Anträge nach einem CSV-Refresh ohne App-Reload. Der Cache merkt sich die
 * Snapshot-Version (`snapshot-version-<programmId>`), gegen die er geladen wurde,
 * und lädt neu, sobald die IDB-Version abweicht.
 *
 * Hier getestet: die reine Entscheidung `needsSnapshotRefresh`.
 */
import { describe, it, expect } from 'vitest';
import { needsSnapshotRefresh } from '../hooks/useAntraegeCache';

describe('needsSnapshotRefresh', () => {
  it('true, wenn die IDB-Version von der gecachten abweicht', () => {
    expect(needsSnapshotRefresh('2026-06-05T08:00:00Z', '2026-06-04T08:00:00Z')).toBe(true);
  });

  it('false, wenn beide gleich sind (kein Refresh)', () => {
    expect(needsSnapshotRefresh('2026-06-04T08:00:00Z', '2026-06-04T08:00:00Z')).toBe(false);
  });

  it('false, wenn beide null sind (noch kein Snapshot — kein Churn)', () => {
    expect(needsSnapshotRefresh(null, null)).toBe(false);
  });

  it('true, sobald erstmals eine Version auftaucht (null → Wert)', () => {
    expect(needsSnapshotRefresh('2026-06-04T08:00:00Z', null)).toBe(true);
  });
});
