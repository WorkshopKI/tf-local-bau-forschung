/**
 * Der gerätelokale Kommentar-Gelesen-Stand. Die wichtigste Zusage steht ganz
 * unten: nach dem Baseline-Nachtrag ist NICHTS neu — sonst leuchtete beim
 * ersten Start das halbe Board auf.
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackComment, FeedbackItem } from '@/core/types/feedback';
import { KEINE_IDENTITAET, baueIdentitaet } from '@/core/services/feedback/feedbackIdentitaet';
import {
  ergaenzeKommentarStand,
  standNach,
  zaehleFremdKommentare,
  zaehleNeueKommentare,
} from '../kommentarStand';

/** Kürzel = kanonische Schreib-Id, Profilname = Lese-Alias (feedbackIdentitaet). */
const ICH_NAME = 'THÜ';
const ICH_ALIAS = 'TH PL';
const ICH = baueIdentitaet(ICH_NAME, ICH_ALIAS);

function kommentar(id: string, user_id: string): FeedbackComment {
  return { id, user_id, text: `Text ${id}`, created_at: '2026-07-07T10:00:00Z' };
}

function ticket(id: string, comments: FeedbackComment[]): FeedbackItem {
  return {
    id,
    created_at: '2026-07-07T10:00:00Z',
    user_id: 'AM',
    text: '',
    context: {
      route: 'x', page: 'p', device: 'Desktop', viewport: '1x1',
      sessionDuration: 0, errors: [], timestamp: '2026-07-07T10:00:00Z',
    },
    kurator_status: 'neu',
    comments,
  };
}

describe('zaehleFremdKommentare', () => {
  it('lässt die eigenen Kommentare aus', () => {
    const t = ticket('t1', [kommentar('c1', 'AM'), kommentar('c2', ICH_NAME), kommentar('c3', 'BIB')]);
    expect(zaehleFremdKommentare(t, ICH)).toBe(2);
  });

  it('erkennt auch einen ALT-Kommentar unter dem Profilnamen als eigenen', () => {
    const t = ticket('t1', [kommentar('c1', 'AM'), kommentar('c2', ICH_ALIAS)]);
    expect(zaehleFremdKommentare(t, ICH)).toBe(1);
  });

  it('zählt ohne Identität alles', () => {
    expect(zaehleFremdKommentare(ticket('t1', [kommentar('c1', 'AM')]), KEINE_IDENTITAET)).toBe(1);
  });
});

describe('zaehleNeueKommentare', () => {
  const t = ticket('t1', [kommentar('c1', 'AM'), kommentar('c2', 'BIB'), kommentar('c3', 'AM')]);

  it('meldet bei unbekanntem Ticket NICHTS — „noch nie beobachtet" ≠ „alles neu"', () => {
    expect(zaehleNeueKommentare(t, {}, ICH)).toBe(0);
  });

  it('meldet den Zuwachs seit dem gemerkten Stand', () => {
    expect(zaehleNeueKommentare(t, { t1: 1 }, ICH)).toBe(2);
    expect(zaehleNeueKommentare(t, { t1: 3 }, ICH)).toBe(0);
  });

  it('wird nie negativ', () => {
    expect(zaehleNeueKommentare(t, { t1: 9 }, ICH)).toBe(0);
  });

  it('ist ohne Identität still', () => {
    expect(zaehleNeueKommentare(t, { t1: 0 }, KEINE_IDENTITAET)).toBe(0);
  });

  it('zählt eigene Kommentare nicht als neu', () => {
    const eigen = ticket('t1', [kommentar('c1', 'AM'), kommentar('c2', ICH_NAME)]);
    expect(zaehleNeueKommentare(eigen, { t1: 1 }, ICH)).toBe(0);
  });
});

describe('ergaenzeKommentarStand', () => {
  const items = [
    ticket('t1', [kommentar('c1', 'AM')]),
    ticket('t2', []),
  ];

  it('trägt unbekannte Tickets mit ihrem aktuellen Wert nach — auch die ohne Kommentare', () => {
    expect(ergaenzeKommentarStand({}, items, ICH)).toEqual({ t1: 1, t2: 0 });
  });

  it('rührt bestehende Stände nicht an', () => {
    expect(ergaenzeKommentarStand({ t1: 0 }, items, ICH)).toEqual({ t1: 0, t2: 0 });
  });

  it('meldet beim zweiten Lauf null (kein Write, kein Re-Render)', () => {
    const erst = ergaenzeKommentarStand({}, items, ICH);
    expect(erst).not.toBeNull();
    expect(ergaenzeKommentarStand(erst!, items, ICH)).toBeNull();
  });

  it('ist ohne Identität ein No-Op', () => {
    expect(ergaenzeKommentarStand({}, items, KEINE_IDENTITAET)).toBeNull();
  });

  it('macht nach dem Nachtrag NICHTS neu (die Erst-Start-Zusage)', () => {
    const stand = ergaenzeKommentarStand({}, items, ICH)!;
    expect(items.map(t => zaehleNeueKommentare(t, stand, ICH))).toEqual([0, 0]);
  });
});

describe('standNach', () => {
  it('hebt den Stand auf die aktuelle Fremd-Anzahl', () => {
    const t = ticket('t1', [kommentar('c1', 'AM'), kommentar('c2', 'BIB')]);
    expect(standNach({ t1: 0 }, t, ICH)).toEqual({ t1: 2 });
  });

  it('meldet null, wenn schon aktuell', () => {
    const t = ticket('t1', [kommentar('c1', 'AM')]);
    expect(standNach({ t1: 1 }, t, ICH)).toBeNull();
  });

  it('verschiebt den Stand nach einem EIGENEN Kommentar nicht', () => {
    const t = ticket('t1', [kommentar('c1', 'AM'), kommentar('c2', ICH_NAME)]);
    expect(standNach({ t1: 1 }, t, ICH)).toBeNull();
  });
});
