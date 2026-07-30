/**
 * Tests fuer die `updated_at`-Regel in mergeItems (v2.364).
 *
 * Hintergrund: `addComment` legt beim Kommentieren eines FREMDEN Tickets eine
 * Vollkopie davon in den localStorage (saveOwnCommentsLocally). Bis v2.363 gewann
 * `local_item.text` bedingungslos — solange Texte unveraenderlich waren, harmlos.
 * Mit dem „Ergaenzen"-Ablauf haette jeder frueherere Kommentator dauerhaft die
 * alte Fassung gesehen und sie bei jedem eigenen Schreibvorgang zurueckgespielt.
 *
 * Regel: der lokale Nutzertext gewinnt, solange er nicht AELTER ist als der
 * geteilte. Ohne `updated_at` auf beiden Seiten (alle Bestandsdaten) bleibt das
 * Verhalten unveraendert.
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackItem } from '@/core/types/feedback';
import { mergeItems } from '../feedbackSharedFile';

function base(id: string, over: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id,
    created_at: '2026-07-07T10:00:00Z',
    user_id: 'ANNA',
    text: 'Ursprungstext',
    context: {
      route: 'x', page: 'p', device: 'Desktop', viewport: '1x1',
      sessionDuration: 0, errors: [], timestamp: '2026-07-07T10:00:00Z',
    },
    kurator_status: 'neu',
    ...over,
  };
}

describe('mergeItems — Nutzertext-Precedence per updated_at', () => {
  it('ohne updated_at auf beiden Seiten bleibt es beim lokalen Text (kein Verhaltenswechsel)', () => {
    const local = base('A', { text: 'lokal' });
    const shared = base('A', { text: 'geteilt', kurator_status: 'geplant' });
    const merged = mergeItems([local], [shared]);
    expect(merged[0]?.text).toBe('lokal');
    expect(merged[0]?.kurator_status).toBe('geplant'); // Kurator-Felder weiter shared-wins
  });

  it('VERALTETE lokale Vollkopie verliert gegen den neueren geteilten Stand', () => {
    // So sieht der localStorage eines Kommentators aus: Snapshot von damals,
    // ohne updated_at, weil er den Text nie angefasst hat.
    const staleLokal = base('A', {
      text: 'Ursprungstext',
      comments: [{ id: 'c1', user_id: 'TH', text: 'Mitgedacht', created_at: '2026-07-08T09:00:00Z' }],
    });
    const sharedNeu = base('A', {
      text: 'Vom Autor ergaenzte Fassung',
      title: 'Neuer Titel',
      structured: { goal: 'praeziser' },
      updated_at: '2026-07-09T08:00:00Z',
    });
    const merged = mergeItems([staleLokal], [sharedNeu]);
    expect(merged[0]?.text).toBe('Vom Autor ergaenzte Fassung');
    expect(merged[0]?.title).toBe('Neuer Titel');
    expect(merged[0]?.structured).toEqual({ goal: 'praeziser' });
    expect(merged[0]?.updated_at).toBe('2026-07-09T08:00:00Z');
    // Der eigene Kommentar geht dabei NICHT verloren (Union-by-id, unabhaengig).
    expect(merged[0]?.comments?.map(c => c.id)).toEqual(['c1']);
  });

  it('frischer eigener Edit gewinnt gegen den aelteren geteilten Stand', () => {
    const local = base('A', { text: 'gerade ergaenzt', updated_at: '2026-07-10T12:00:00Z' });
    const shared = base('A', { text: 'alte Fassung', updated_at: '2026-07-09T08:00:00Z' });
    expect(mergeItems([local], [shared])[0]?.text).toBe('gerade ergaenzt');
  });

  it('gleicher Zeitstempel (eigener Write hat beide Seiten gesetzt) → lokal gewinnt', () => {
    const stamp = '2026-07-10T12:00:00Z';
    const local = base('A', { text: 'meine Fassung', updated_at: stamp });
    const shared = base('A', { text: 'meine Fassung', updated_at: stamp });
    expect(mergeItems([local], [shared])[0]?.text).toBe('meine Fassung');
  });

  it('lokal-only Item (noch nicht eingesammelt) bleibt unangetastet', () => {
    const local = base('NEU', { text: 'noch in der Outbox', updated_at: '2026-07-10T12:00:00Z' });
    const merged = mergeItems([local], []);
    expect(merged[0]?.text).toBe('noch in der Outbox');
  });
});
