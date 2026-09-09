/**
 * Verlauf-Sidebar: Filtern (Suche + Alle/Anträge/Angeheftet) und Gruppieren
 * (Angeheftet / Heute / Letzte 7 Tage / Älter) der Konversations-Metas.
 * Pure — `now` wird übergeben (deterministisch testbar).
 */
import type { ConversationMeta } from './types';
import { MS_TAG } from '@/core/utils/zeitEinheiten';

export type ConversationFilter = 'all' | 'antrag' | 'pinned';

export interface ConversationSection {
  name: string;
  items: ConversationMeta[];
}

export interface GroupedConversations {
  sections: ConversationSection[];
  counts: { all: number; antrag: number; pinned: number };
}


function dateBucket(updatedAt: string, now: number): string {
  const ts = new Date(updatedAt).getTime();
  const sameDay = new Date(ts).toDateString() === new Date(now).toDateString();
  if (sameDay) return 'Heute';
  if (now - ts <= 7 * MS_TAG) return 'Letzte 7 Tage';
  return 'Älter';
}

const BUCKET_ORDER = ['Heute', 'Letzte 7 Tage', 'Älter'];

function byDate(list: ConversationMeta[], now: number): ConversationSection[] {
  const map = new Map<string, ConversationMeta[]>();
  for (const c of list) {
    const b = dateBucket(c.updatedAt, now);
    (map.get(b) ?? map.set(b, []).get(b)!).push(c);
  }
  return BUCKET_ORDER.filter(b => map.has(b)).map(b => ({ name: b, items: map.get(b)! }));
}

export function groupConversations(
  convs: ConversationMeta[],
  opts: { filter: ConversationFilter; query: string; now: number },
): GroupedConversations {
  const { filter, query, now } = opts;
  const counts = {
    all: convs.length,
    antrag: convs.filter(c => c.fkz).length,
    pinned: convs.filter(c => c.pinned).length,
  };

  const q = query.trim().toLowerCase();
  let pool = convs.filter(c =>
    !q || c.title.toLowerCase().includes(q) || (c.fkz?.toLowerCase().includes(q) ?? false));
  if (filter === 'antrag') pool = pool.filter(c => c.fkz);
  if (filter === 'pinned') pool = pool.filter(c => c.pinned);

  const sections: ConversationSection[] = [];
  if (filter === 'all') {
    const pinned = pool.filter(c => c.pinned);
    if (pinned.length) sections.push({ name: 'Angeheftet', items: pinned });
    sections.push(...byDate(pool.filter(c => !c.pinned), now));
  } else {
    sections.push(...byDate(pool, now));
  }
  return { sections, counts };
}
