/**
 * Regression: ein Kommentar darf NIE still verschwinden.
 *
 * Der gemeldete Fehler (v2.416.1): Kommentar schreiben → speichern → Ticket
 * schließen → wieder öffnen → weg, ohne jede Meldung. Ursache ist eine
 * Verwechslung eine Ebene tiefer: `readText` schluckt jeden Fehler und liefert
 * `null` — ununterscheidbar von „Datei gibt es nicht". `readSharedFile` machte
 * daraus „keine geteilten Daten", und `addComment` schloss daraus „das Ticket
 * existiert nicht" (`{ok:false}`) und verwarf den Kommentar wortlos.
 *
 * Wen es trifft: Rollen mit Schreibrecht (PL/Kurator/dev). Deren eigene Tickets
 * stehen NUR in der geteilten Datei — `submitFeedback` legt sie auf dem
 * Shared-Pfad nicht zusätzlich in den localStorage. Ist die Datei einen Moment
 * nicht lesbar (paralleler `atomicWrite` eines zweiten Clients, SMB-Aussetzer),
 * findet `addComment` das Ticket nirgends mehr.
 *
 * Zweite, schwerere Folge derselben Verwechslung: aus „unlesbar" wurde eine
 * LEERE Basis, auf der weitergerechnet und geschrieben wurde — der Schreibvorgang
 * hätte die geteilte Datei auf den lokalen Teilbestand eingedampft.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FeedbackItem } from '@/core/types/feedback';

const state = vi.hoisted(() => ({
  local: [] as FeedbackItem[],
  shared: [] as FeedbackItem[],
  /** Was `readSharedFileLage` melden soll. */
  lage: 'ok' as 'ok' | 'leer' | 'unlesbar',
  writes: [] as FeedbackItem[][],
}));

vi.mock('../feedbackStorage', () => ({
  loadLocalItems: vi.fn(() => state.local),
  saveLocalItems: vi.fn((items: FeedbackItem[]) => { state.local = items; }),
  emitFeedbackUpdated: vi.fn(),
}));
vi.mock('@/core/services/infrastructure/smb-handle', () => ({
  getPersoenlichHandle: vi.fn(async () => null),
}));
vi.mock('../feedbackSharedFile', async (importActual) => {
  const actual = await importActual<typeof import('../feedbackSharedFile')>();
  return {
    ...actual,
    readSharedFileLage: vi.fn(async () =>
      state.lage === 'ok'
        ? { status: 'ok' as const, datei: { version: 1 as const, updated_at: '', items: state.shared } }
        : { status: state.lage as 'leer' | 'unlesbar' },
    ),
    readSharedFile: vi.fn(async () =>
      state.lage === 'ok' ? { version: 1 as const, updated_at: '', items: state.shared } : null,
    ),
    writeSharedFile: vi.fn(async (_s: unknown, items: FeedbackItem[]) => {
      state.writes.push(items);
      state.shared = items;
      return true;
    }),
  };
});

import { addComment } from '../feedbackComments';
import { makeFeedback } from './fixtures';
import type { StorageService } from '@/core/services/storage';

const storage = { idb: {} } as unknown as StorageService;

/** Ticket einer schreibenden Rolle: existiert NUR geteilt, nie lokal. */
function nurGeteilt(): void {
  state.local = [];
  state.shared = [makeFeedback({ id: 'fb-1', user_id: 'THÜ' })];
}

beforeEach(() => {
  state.local = [];
  state.shared = [];
  state.writes = [];
  state.lage = 'ok';
});

describe('addComment — geteilte Datei lesbar', () => {
  it('haengt den Kommentar an und schreibt ihn in die geteilte Datei', async () => {
    nurGeteilt();
    const res = await addComment(storage, 'fb-1', 'THÜ', 'Mein Kommentar');
    expect(res.ok).toBe(true);
    const geschrieben = state.shared.find(i => i.id === 'fb-1');
    expect(geschrieben?.comments?.map(c => c.text)).toEqual(['Mein Kommentar']);
  });
});

describe('addComment — geteilte Datei UNLESBAR', () => {
  it('meldet den Fehlschlag, statt den Kommentar still zu verwerfen', async () => {
    nurGeteilt();
    state.lage = 'unlesbar';
    const res = await addComment(storage, 'fb-1', 'THÜ', 'Mein Kommentar');
    expect(res.ok).toBe(false);
    // 'invalid' hiesse „das Ticket gibt es nicht" — eine Falschaussage, die die
    // Oberflaeche nicht von einem echten Bedienfehler unterscheiden kann.
    expect(res.error).toBe('share_unreadable');
  });

  it('schreibt NICHT — sonst ersetzt der lokale Teilbestand den geteilten', async () => {
    nurGeteilt();
    state.local = [makeFeedback({ id: 'fb-lokal', user_id: 'THÜ' })];
    state.lage = 'unlesbar';
    await addComment(storage, 'fb-lokal', 'THÜ', 'Mein Kommentar');
    expect(state.writes).toEqual([]);
    expect(state.shared.map(i => i.id)).toEqual(['fb-1']);
  });
});

describe('addComment — ohne geteilte Datei (leer/erster Lauf)', () => {
  it('bleibt beim lokalen Pfad und speichert den Kommentar', async () => {
    state.local = [makeFeedback({ id: 'fb-1', user_id: 'THÜ' })];
    state.shared = [];
    state.lage = 'leer';
    const res = await addComment(storage, 'fb-1', 'THÜ', 'Mein Kommentar');
    expect(res.ok).toBe(true);
    expect(state.local.find(i => i.id === 'fb-1')?.comments?.map(c => c.text)).toEqual(['Mein Kommentar']);
  });
});
