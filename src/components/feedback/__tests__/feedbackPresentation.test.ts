/**
 * Tests für die Redesign-Präsentationshelfer (v2.199): Titel-Ableitung,
 * Kurz-Labels in den Q&A-Segmenten, Avatar-Initialen/-Farbe.
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackComment, FeedbackItem } from '@/core/types/feedback';
import {
  berechneKommentarHoehe,
  clampKommentarHoehe,
  feedbackTitle,
  feedbackQaSegments,
  kuerzeKommentarText,
  waehleKommentarVorschau,
} from '../feedbackUi';
import { avatarInitials, avatarColor } from '../FeedbackAvatar';

function ticket(partial: Partial<FeedbackItem>): FeedbackItem {
  return {
    id: 't1',
    created_at: '2026-07-07T10:00:00Z',
    user_id: 'TH',
    text: '',
    context: {
      route: 'x', page: 'p', device: 'Desktop', viewport: '1x1',
      sessionDuration: 0, errors: [], timestamp: '2026-07-07T10:00:00Z',
    },
    kurator_status: 'neu',
    ...partial,
  };
}

describe('feedbackTitle', () => {
  it('bevorzugt den expliziten Titel', () => {
    expect(feedbackTitle(ticket({ title: 'Mein Titel' }))).toBe('Mein Titel');
  });

  it('leitet aus der Hauptantwort je Kategorie ab', () => {
    expect(feedbackTitle(ticket({ category: 'problem', structured: { actual: 'Sortierung falsch' } })))
      .toBe('Sortierung falsch');
    expect(feedbackTitle(ticket({ category: 'idea', structured: { goal: 'Spalte sortieren' } })))
      .toBe('Spalte sortieren');
    expect(feedbackTitle(ticket({ category: 'praise', structured: { text: 'Seite gut' } })))
      .toBe('Seite gut');
  });

  it('kürzt lange Titel mit Ellipse', () => {
    const long = 'x'.repeat(200);
    const out = feedbackTitle(ticket({ title: long }), 20);
    expect(out.length).toBe(20);
    expect(out.endsWith('…')).toBe(true);
  });

  it('kürzt mit maxLen = Infinity nie (normalisiert nur Whitespace)', () => {
    const long = `${'Wort '.repeat(60)}Ende`;
    const out = feedbackTitle(ticket({ title: `  ${long}  ` }), Infinity);
    expect(out).toBe(long.trim());
    expect(out.endsWith('…')).toBe(false);
  });

  it('fällt auf llm_summary / erste Textzeile zurück', () => {
    expect(feedbackTitle(ticket({ llm_summary: 'Zusammenfassung' }))).toBe('Zusammenfassung');
    expect(feedbackTitle(ticket({ text: 'erste Zeile\nzweite' }))).toBe('erste Zeile');
  });
});

describe('feedbackQaSegments — shortFrage', () => {
  it('liefert das Kurz-Label je Feld', () => {
    const segs = feedbackQaSegments(ticket({
      category: 'problem',
      structured: { steps: 'a', actual: 'b' },
    }));
    expect(segs.map(s => s.shortFrage)).toEqual(['Gemacht', 'Passiert']);
    expect(segs.map(s => s.frage)).toEqual(['Was hast du gemacht?', 'Was ist passiert?']);
  });
});

describe('clampKommentarHoehe', () => {
  it('liest nichts Gemerktes als undefined (Grundhöhe gilt)', () => {
    expect(clampKommentarHoehe(null, 56, 320)).toBeUndefined();
    expect(clampKommentarHoehe('', 56, 320)).toBeUndefined();
    expect(clampKommentarHoehe('abc', 56, 320)).toBeUndefined();
  });

  it('klemmt Alt-Einträge in die Grenzen', () => {
    expect(clampKommentarHoehe('20', 56, 320)).toBe(56);
    expect(clampKommentarHoehe('9999', 56, 320)).toBe(320);
    expect(clampKommentarHoehe('120', 56, 320)).toBe(120);
  });
});

describe('berechneKommentarHoehe', () => {
  it('hält das leere Feld auf Grundhöhe', () => {
    expect(berechneKommentarHoehe(20, 62, undefined, 320)).toBe(62);
  });

  it('wächst mit dem Inhalt', () => {
    expect(berechneKommentarHoehe(140, 62, undefined, 320)).toBe(140);
  });

  it('nimmt die gezogene Höhe als Mindesthöhe — nicht als feste Höhe', () => {
    // Gezogen auf 200, wenig Text → bleibt 200 (Ziehen überlebt das Tippen).
    expect(berechneKommentarHoehe(30, 62, 200, 320)).toBe(200);
    // Mehr Text als gezogen → Inhalt gewinnt (der Entwurf wird nicht abgeschnitten).
    expect(berechneKommentarHoehe(260, 62, 200, 320)).toBe(260);
  });

  it('deckelt bei max', () => {
    expect(berechneKommentarHoehe(900, 62, 400, 320)).toBe(320);
  });
});

describe('kuerzeKommentarText', () => {
  it('lässt Text unter der Grenze unverändert', () => {
    expect(kuerzeKommentarText('kurz und knapp', 100)).toBe('kurz und knapp');
  });

  it('schneidet an der letzten Wortgrenze und hängt eine Ellipse an', () => {
    const s = 'Das ist ein ziemlich langer Kommentar über die Sortierung der Tabelle';
    const gekuerzt = kuerzeKommentarText(s, 30);
    expect(gekuerzt.endsWith('…')).toBe(true);
    expect(gekuerzt.length).toBeLessThanOrEqual(31);
    // Wortgrenze: kein abgeschnittenes Wort vor der Ellipse.
    expect(s.startsWith(gekuerzt.slice(0, -1))).toBe(true);
    expect(gekuerzt.slice(0, -1).endsWith(' ')).toBe(false);
  });

  it('schneidet hart, wenn die letzte Wortgrenze zu früh käme', () => {
    // Ein einziges langes Wort → keine brauchbare Grenze ab 60 %.
    expect(kuerzeKommentarText(`kurz ${'x'.repeat(50)}`, 20)).toBe(`${'kurz '}${'x'.repeat(15)}…`);
  });

  it('zieht Leerzeilen-Kaskaden auf einen Absatz zusammen', () => {
    expect(kuerzeKommentarText('a\n\n\n\nb', 100)).toBe('a\n\nb');
  });

  it('gibt bei Infinity den Originaltext byte-gleich zurück', () => {
    const roh = 'a\n\n\n\nb   ';
    expect(kuerzeKommentarText(roh, Infinity)).toBe(roh);
  });
});

describe('waehleKommentarVorschau', () => {
  const c = (id: string, text = id): FeedbackComment => ({
    id, user_id: 'AM', text, created_at: '2026-07-07T10:00:00Z',
  });
  const fuenf = [c('1'), c('2'), c('3'), c('4'), c('5')];

  it('nimmt die LETZTEN N und meldet die ausgelassenen', () => {
    const v = waehleKommentarVorschau(fuenf, { maxEintraege: 2, maxZeichen: 100, neuAnzahl: 0 });
    expect(v.eintraege.map(e => e.comment.id)).toEqual(['4', '5']);
    expect(v.aeltereAnzahl).toBe(3);
  });

  it('markiert genau die letzten `neuAnzahl` als neu', () => {
    const v = waehleKommentarVorschau(fuenf, { maxEintraege: 4, maxZeichen: 100, neuAnzahl: 2 });
    expect(v.eintraege.map(e => e.neu)).toEqual([false, false, true, true]);
  });

  it('markiert nichts bei neuAnzahl 0', () => {
    const v = waehleKommentarVorschau(fuenf, { maxEintraege: 5, maxZeichen: 100, neuAnzahl: 0 });
    expect(v.eintraege.some(e => e.neu)).toBe(false);
  });

  it('verkraftet mehr neue als sichtbare Einträge', () => {
    const v = waehleKommentarVorschau(fuenf, { maxEintraege: 2, maxZeichen: 100, neuAnzahl: 4 });
    expect(v.eintraege.map(e => e.neu)).toEqual([true, true]);
    expect(v.aeltereAnzahl).toBe(3);
  });

  it('zeigt bei Infinity alles ungekürzt (Thread-Fall)', () => {
    const lang = c('6', 'x'.repeat(500));
    const v = waehleKommentarVorschau([...fuenf, lang], {
      maxEintraege: Infinity, maxZeichen: Infinity, neuAnzahl: 0,
    });
    expect(v.eintraege).toHaveLength(6);
    expect(v.aeltereAnzahl).toBe(0);
    expect(v.eintraege[v.eintraege.length - 1]?.text).toBe(lang.text);
  });

  it('kommt mit einer leeren Liste klar', () => {
    const v = waehleKommentarVorschau([], { maxEintraege: 4, maxZeichen: 100, neuAnzahl: 3 });
    expect(v.eintraege).toEqual([]);
    expect(v.aeltereAnzahl).toBe(0);
  });
});

describe('FeedbackAvatar helpers', () => {
  it('bildet Initialen (Du → DU, Vor-/Nachname → 2 Buchstaben)', () => {
    expect(avatarInitials('Du')).toBe('DU');
    expect(avatarInitials('Anna Merz')).toBe('AM');
    expect(avatarInitials('Jonas')).toBe('J');
    expect(avatarInitials('  ')).toBe('?');
  });

  it('ist deterministisch pro Name', () => {
    expect(avatarColor('Anna Merz')).toBe(avatarColor('Anna Merz'));
  });
});
