import { describe, expect, it } from 'vitest';
import { groupConversations } from '../conversation-groups';
import type { ConversationMeta } from '../types';

const NOW = new Date('2026-06-11T12:00:00Z').getTime();

function conv(over: Partial<ConversationMeta> & { id: string }): ConversationMeta {
  return {
    title: over.id, createdAt: '2026-06-11T10:00:00Z', updatedAt: '2026-06-11T10:00:00Z',
    messageCount: 2, ...over,
  };
}

describe('groupConversations', () => {
  it('zählt Alle/Anträge/Angeheftet', () => {
    const convs = [
      conv({ id: 'a', pinned: true }),
      conv({ id: 'b', fkz: '16KN065210' }),
      conv({ id: 'c' }),
    ];
    const { counts } = groupConversations(convs, { filter: 'all', query: '', now: NOW });
    expect(counts).toEqual({ all: 3, antrag: 1, pinned: 1 });
  });

  it('filter=all: Angeheftet-Sektion zuerst, dann Datums-Gruppen der übrigen', () => {
    const convs = [
      conv({ id: 'pin', pinned: true, updatedAt: '2026-06-11T09:00:00Z' }),
      conv({ id: 'heute', updatedAt: '2026-06-11T08:00:00Z' }),
      conv({ id: 'woche', updatedAt: '2026-06-07T08:00:00Z' }),
      conv({ id: 'alt', updatedAt: '2026-05-01T08:00:00Z' }),
    ];
    const { sections } = groupConversations(convs, { filter: 'all', query: '', now: NOW });
    expect(sections.map(s => s.name)).toEqual(['Angeheftet', 'Heute', 'Letzte 7 Tage', 'Älter']);
    expect(sections[0]?.items.map(c => c.id)).toEqual(['pin']);
    expect(sections[1]?.items.map(c => c.id)).toEqual(['heute']);
  });

  it('filter=antrag: nur Konversationen mit fkz', () => {
    const convs = [conv({ id: 'a', fkz: '16KN065210' }), conv({ id: 'b' })];
    const { sections } = groupConversations(convs, { filter: 'antrag', query: '', now: NOW });
    const ids = sections.flatMap(s => s.items.map(c => c.id));
    expect(ids).toEqual(['a']);
  });

  it('filter=pinned: nur angeheftete (keine separate Angeheftet-Sektion davor)', () => {
    const convs = [conv({ id: 'a', pinned: true }), conv({ id: 'b' })];
    const { sections } = groupConversations(convs, { filter: 'pinned', query: '', now: NOW });
    const ids = sections.flatMap(s => s.items.map(c => c.id));
    expect(ids).toEqual(['a']);
    expect(sections.some(s => s.name === 'Angeheftet')).toBe(false);
  });

  it('query filtert über Titel und FKZ (case-insensitive)', () => {
    const convs = [
      conv({ id: 'a', title: 'Packoptimierung' }),
      conv({ id: 'b', title: 'Sonstiges', fkz: '16KN065210' }),
      conv({ id: 'c', title: 'Anderes' }),
    ];
    expect(groupConversations(convs, { filter: 'all', query: 'pack', now: NOW })
      .sections.flatMap(s => s.items.map(c => c.id))).toEqual(['a']);
    expect(groupConversations(convs, { filter: 'all', query: '16kn', now: NOW })
      .sections.flatMap(s => s.items.map(c => c.id))).toEqual(['b']);
  });

  it('leere Treffermenge → keine Sektionen', () => {
    const { sections } = groupConversations([conv({ id: 'a', title: 'X' })], { filter: 'all', query: 'zzz', now: NOW });
    expect(sections).toEqual([]);
  });
});
