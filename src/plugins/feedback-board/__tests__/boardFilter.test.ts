/**
 * Tests der reinen Board-Filter-/Sortier-Logik. Deckt die zwei Stufen
 * (Smart View → Facetten × Suche) und alle acht Ordnungen ab; der Gleichstand
 * fällt immer auf „neueste zuerst".
 */
import { describe, expect, it } from 'vitest';
import type { FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { DEFAULT_FEEDBACK_CONFIG } from '@/core/types/feedback';
import { baueIdentitaet } from '@/core/services/feedback/feedbackIdentitaet';
import {
  filterAndSortBoard,
  matchesBoardFilter,
  scopeBoard,
  suchHeuhaufen,
  type BoardFilterState,
} from '../boardFilter';
import { SMART_VIEWS_ENTWICKLER, SMART_VIEWS_NUTZER, type SmartViewKontext } from '../smartViews';
import { TYP_UNKLASSIFIZIERT } from '../boardZahlen';

const CONFIG: FeedbackConfig = DEFAULT_FEEDBACK_CONFIG;
const ME = 'THU';
/** Kürzel + Profilname — beide Schreibweisen gehören mir (feedbackIdentitaet). */
const ME_ALIAS = 'TH PL';
const ICH = baueIdentitaet(ME, ME_ALIAS);

const KTX: SmartViewKontext = { ich: ICH, heute: '2026-08-06', istUngelesen: () => false };

function fb(id: string, over: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id,
    created_at: '2026-07-01T10:00:00Z',
    user_id: ME,
    text: `Text ${id}`,
    category: 'idea',
    kurator_status: 'neu',
    context: {
      route: 'r', page: 'Förderanträge', device: 'Desktop', viewport: '1x1',
      sessionDuration: 0, errors: [], timestamp: '2026-07-01T10:00:00Z',
    },
    ...over,
  };
}

const view = (key: string) =>
  SMART_VIEWS_NUTZER.find(v => v.key === key) ?? SMART_VIEWS_ENTWICKLER.find(v => v.key === key)!;

const BASIS: BoardFilterState = {
  view: view('alle'), ctx: KTX, typ: '', status: '', bereich: '', query: '', sort: 'neu',
};

describe('Smart Views', () => {
  it('„Meine Tickets" erkennt beide Schreibweisen der eigenen Identität', () => {
    const unterKuerzel = fb('A', { user_id: ME });
    const unterName = fb('B', { user_id: ME_ALIAS });
    const fremd = fb('C', { user_id: 'XYZ' });
    const f = { ...BASIS, view: view('meine') };
    expect([unterKuerzel, unterName, fremd].filter(t => matchesBoardFilter(t, f)).map(t => t.id))
      .toEqual(['A', 'B']);
  });

  it('„Wartet auf mich" nimmt nur EIGENE Tickets im Status Rückfrage', () => {
    const meineRueckfrage = fb('A', { kurator_status: 'rueckfrage' });
    const fremdeRueckfrage = fb('B', { user_id: 'XYZ', kurator_status: 'rueckfrage' });
    const meinNeu = fb('C');
    const f = { ...BASIS, view: view('wartet') };
    expect([meineRueckfrage, fremdeRueckfrage, meinNeu].filter(t => matchesBoardFilter(t, f)).map(t => t.id))
      .toEqual(['A']);
  });

  it('„Neu diese Woche" schneidet bei sieben Tagen', () => {
    const frisch = fb('A', { created_at: '2026-08-02T10:00:00Z' }); // 4 Tage
    const grenze = fb('B', { created_at: '2026-07-30T09:00:00Z' }); // 7 Tage
    const alt = fb('C', { created_at: '2026-07-20T10:00:00Z' });
    const f = { ...BASIS, view: view('neu7') };
    expect([frisch, grenze, alt].filter(t => matchesBoardFilter(t, f)).map(t => t.id))
      .toEqual(['A', 'B']);
  });

  it('„Alles offen" enthält Rückfragen — ein wartendes Ticket ist unerledigt, nicht fertig', () => {
    const items = [
      fb('A', { kurator_status: 'neu' }),
      fb('B', { kurator_status: 'rueckfrage' }),
      fb('C', { kurator_status: 'in_bearbeitung' }),
      fb('D', { kurator_status: 'umgesetzt' }),
      fb('E', { kurator_status: 'abgelehnt' }),
    ];
    expect(scopeBoard(items, view('offen'), KTX).map(t => t.id)).toEqual(['A', 'B', 'C']);
  });

  it('„Mir zugewiesen" vergleicht den Assignee tolerant gegen die eigene Identität', () => {
    const items = [
      fb('A', { assignee: ME }),
      fb('B', { assignee: ME_ALIAS }),
      fb('C', { assignee: 'XYZ' }),
      fb('D'),
    ];
    expect(scopeBoard(items, view('mir'), KTX).map(t => t.id)).toEqual(['A', 'B']);
  });

  it('„Triage" zeigt nur ungeschätzte NEUE Tickets', () => {
    const items = [
      fb('A'),
      fb('B', { effort_estimate: 'M' }),
      fb('C', { kurator_status: 'geplant' }),
    ];
    expect(scopeBoard(items, view('triage'), KTX).map(t => t.id)).toEqual(['A']);
  });

  it('„Meiste Unterstützer" erzwingt seine Ordnung gegen die Toolbar-Wahl', () => {
    const wenig = fb('A', { votes: [{ user_id: 'x', created_at: '2026-07-01T00:00:00Z' }] });
    const viel = fb('B', {
      created_at: '2026-06-01T10:00:00Z',
      votes: [
        { user_id: 'x', created_at: '2026-07-01T00:00:00Z' },
        { user_id: 'y', created_at: '2026-07-01T00:00:00Z' },
      ],
    });
    // sort: 'neu' würde A zuerst zeigen — die Sicht überschreibt das.
    const f = { ...BASIS, view: view('top'), sort: 'neu' as const };
    expect(filterAndSortBoard([wenig, viel], f, CONFIG).map(t => t.id)).toEqual(['B', 'A']);
  });
});

describe('Facetten', () => {
  it('Typ-Facette trennt klassifiziert von unklassifiziert', () => {
    const idee = fb('A', { category: 'idea' });
    const ohne = fb('B', { category: undefined });
    expect(matchesBoardFilter(idee, { ...BASIS, typ: 'idea' })).toBe(true);
    expect(matchesBoardFilter(ohne, { ...BASIS, typ: 'idea' })).toBe(false);
    expect(matchesBoardFilter(ohne, { ...BASIS, typ: TYP_UNKLASSIFIZIERT })).toBe(true);
    expect(matchesBoardFilter(idee, { ...BASIS, typ: TYP_UNKLASSIFIZIERT })).toBe(false);
  });

  it('Status-Facette vergleicht exakt', () => {
    const t = fb('A', { kurator_status: 'rueckfrage' });
    expect(matchesBoardFilter(t, { ...BASIS, status: 'rueckfrage' })).toBe(true);
    expect(matchesBoardFilter(t, { ...BASIS, status: 'neu' })).toBe(false);
  });

  it('Bereichs-Facette nimmt das kuratierte Feld VOR der Meldung des Erstellers', () => {
    const korrigiert = fb('A', {
      bereich: 'suche',
      context: { ...fb('x').context, screenRef: 'antraege' },
    });
    expect(matchesBoardFilter(korrigiert, { ...BASIS, bereich: 'suche' })).toBe(true);
    expect(matchesBoardFilter(korrigiert, { ...BASIS, bereich: 'antraege' })).toBe(false);
  });
});

describe('Suche', () => {
  it('findet Titel, Text, Team-Antwort, Autor und Zuständigen', () => {
    const t = fb('A', {
      title: 'Spaltenbreiten gehen verloren',
      text: 'Nach dem Reload steht alles zurück',
      kurator_response: 'Kommt mit dem Hotfix',
      user_display_name: 'Petra Vogt',
      assignee: 'MKE',
    });
    for (const q of ['spaltenbreiten', 'reload', 'hotfix', 'petra', 'mke']) {
      expect(matchesBoardFilter(t, { ...BASIS, query: q }), q).toBe(true);
    }
    expect(matchesBoardFilter(t, { ...BASIS, query: 'kaffee' })).toBe(false);
  });

  it('findet das Kurz-Handle mit und ohne Raute', () => {
    const t = fb('fb-1754300000000-a7k2z');
    const nummer = suchHeuhaufen(t).slice(-4);
    expect(matchesBoardFilter(t, { ...BASIS, query: nummer })).toBe(true);
    expect(matchesBoardFilter(t, { ...BASIS, query: `#${nummer.toUpperCase()}` })).toBe(true);
  });
});

describe('compareBoardTickets', () => {
  it('„Zuletzt bewegt" nutzt updated_at, fällt auf created_at zurück', () => {
    const alt = fb('A', { created_at: '2026-01-01T10:00:00Z', updated_at: '2026-08-05T10:00:00Z' });
    const neu = fb('B', { created_at: '2026-07-01T10:00:00Z' });
    expect(filterAndSortBoard([neu, alt], { ...BASIS, sort: 'bewegt' }, CONFIG).map(t => t.id))
      .toEqual(['A', 'B']);
  });

  it('„Kleinster Aufwand" sortiert ungeschätzte ans Ende', () => {
    const gross = fb('A', { effort_estimate: 'XL' });
    const klein = fb('B', { effort_estimate: 'XS' });
    const ohne = fb('C');
    expect(filterAndSortBoard([gross, ohne, klein], { ...BASIS, sort: 'aufwand' }, CONFIG).map(t => t.id))
      .toEqual(['B', 'A', 'C']);
  });

  it('bei Gleichstand entscheidet „neueste zuerst"', () => {
    const aelter = fb('A', { created_at: '2026-06-01T10:00:00Z' });
    const juenger = fb('B', { created_at: '2026-07-15T10:00:00Z' });
    expect(filterAndSortBoard([aelter, juenger], { ...BASIS, sort: 'stimmen' }, CONFIG).map(t => t.id))
      .toEqual(['B', 'A']);
  });
});
