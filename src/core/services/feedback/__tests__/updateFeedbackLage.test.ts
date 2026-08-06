/**
 * Regression (v3.7): Verwaltungs-Änderungen dürfen weder still verpuffen noch
 * den Teambestand eindampfen.
 *
 * Zwei Defekte derselben Wurzel, beide bis hierher live:
 *
 *  1. `updateFeedback` wertete den Rückgabewert von `writeSharedFile` nicht aus.
 *     Der Verwaltungs-Block meldete „Gespeichert", auch wenn der Share-Write ein
 *     No-op oder ein Fehler war — die Team-Antwort blieb im localStorage liegen.
 *  2. Aus „geteilte Datei gerade nicht lesbar" machte `readSharedFile` ein
 *     `null`, und der Schreibzweig baute daraus eine geteilte Datei aus dem EINEN
 *     lokalen Item. Der gesamte Teambestand wäre auf ein Ticket geschrumpft.
 *     Gleiche Klasse wie der Kommentar-Verlust aus v3.0.1 (addComment.test.ts).
 *
 * Die Trennlinie: `kein-schreibrecht` ist der ERWARTETE Zustand read-only-
 * Clients (prod) und bleibt still; `fehler`/`unlesbar` werden gemeldet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FeedbackItem } from '@/core/types/feedback';
import type { SchreibLage } from '../feedbackSharedFile';

const state = vi.hoisted(() => ({
  local: [] as FeedbackItem[],
  shared: [] as FeedbackItem[],
  lage: 'ok' as 'ok' | 'leer' | 'unlesbar',
  schreibLage: 'geschrieben' as SchreibLage,
  writes: [] as FeedbackItem[][],
}));

vi.mock('../feedbackStorage', () => ({
  loadLocalItems: vi.fn(() => state.local),
  saveLocalItems: vi.fn((items: FeedbackItem[]) => { state.local = items; }),
  emitFeedbackUpdated: vi.fn(),
  generateFeedbackId: vi.fn(() => 'neu-1'),
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
    writeSharedFileLage: vi.fn(async (_s: unknown, items: FeedbackItem[]) => {
      if (state.schreibLage === 'geschrieben') {
        state.writes.push(items);
        state.shared = items;
      }
      return state.schreibLage;
    }),
    writeSharedFile: vi.fn(async (_s: unknown, items: FeedbackItem[]) => {
      if (state.schreibLage !== 'geschrieben') return false;
      state.writes.push(items);
      state.shared = items;
      return true;
    }),
  };
});

import { deleteFeedback, updateFeedback } from '../feedbackService';
import { makeFeedback } from './fixtures';
import type { StorageService } from '@/core/services/storage';

const storage = { idb: {} } as unknown as StorageService;

beforeEach(() => {
  state.local = [];
  state.shared = [];
  state.writes = [];
  state.lage = 'ok';
  state.schreibLage = 'geschrieben';
});

/** Bestand des Teams: drei Tickets, davon eines auch lokal. */
function teamBestand(): void {
  state.shared = [
    makeFeedback({ id: 'fb-1', user_id: 'THÜ' }),
    makeFeedback({ id: 'fb-2', user_id: 'AM' }),
    makeFeedback({ id: 'fb-3', user_id: 'BIB' }),
  ];
  state.local = [makeFeedback({ id: 'fb-1', user_id: 'THÜ' })];
}

describe('updateFeedback — Schreib-Lagen', () => {
  it('schreibt die Team-Antwort in den geteilten Bestand', async () => {
    teamBestand();
    await updateFeedback(storage, 'fb-2', { kurator_response: 'Kommt im nächsten Sprint' });

    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toHaveLength(3); // nichts verloren
    expect(state.writes[0]!.find(i => i.id === 'fb-2')?.kurator_response).toBe('Kommt im nächsten Sprint');
  });

  it('bricht bei UNLESBAREM Stand ab — und schreibt NICHTS', async () => {
    teamBestand();
    state.lage = 'unlesbar';

    await expect(updateFeedback(storage, 'fb-1', { kurator_response: 'x' })).rejects.toThrow(/nicht lesbar/);
    expect(state.writes).toHaveLength(0);
    // Der eigentliche Schaden, den der Abbruch verhindert: die geteilte Datei
    // wäre aus dem einen lokalen Item neu gebaut worden.
    expect(state.shared).toHaveLength(3);
  });

  it('meldet einen fehlgeschlagenen Share-Write, statt „gespeichert" zu quittieren', async () => {
    teamBestand();
    state.schreibLage = 'fehler';

    await expect(updateFeedback(storage, 'fb-2', { kurator_status: 'geplant' })).rejects.toThrow(/Daten-Share/);
  });

  it('bleibt still, wenn der Client gar kein Schreibrecht hat (read-only prod)', async () => {
    teamBestand();
    state.schreibLage = 'kein-schreibrecht';

    // Kein Wurf: das No-op ist hier der Normalfall, nicht der Fehler.
    await expect(updateFeedback(storage, 'fb-2', { kurator_status: 'geplant' })).resolves.toBeUndefined();
  });

  it('legt bei noch LEERER geteilter Datei die Erstfassung an', async () => {
    state.lage = 'leer';
    state.local = [makeFeedback({ id: 'fb-1', user_id: 'THÜ' })];

    await updateFeedback(storage, 'fb-1', { kurator_response: 'Erste Antwort' });

    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toHaveLength(1);
    expect(state.writes[0]![0]!.kurator_response).toBe('Erste Antwort');
  });
});

describe('deleteFeedback — Schreib-Lagen', () => {
  it('entfernt das Ticket aus dem geteilten Bestand', async () => {
    teamBestand();
    await deleteFeedback(storage, 'fb-2');

    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]!.map(i => i.id)).toEqual(['fb-1', 'fb-3']);
  });

  it('löscht bei unlesbarem Stand NICHTS — auch nicht lokal', async () => {
    teamBestand();
    state.lage = 'unlesbar';

    await expect(deleteFeedback(storage, 'fb-1')).rejects.toThrow(/nicht lesbar/);
    expect(state.writes).toHaveLength(0);
    expect(state.local.map(i => i.id)).toEqual(['fb-1']);
  });

  it('meldet einen fehlgeschlagenen Share-Write', async () => {
    teamBestand();
    state.schreibLage = 'fehler';

    await expect(deleteFeedback(storage, 'fb-2')).rejects.toThrow(/Daten-Share/);
  });
});
