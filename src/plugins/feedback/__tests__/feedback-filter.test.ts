import { describe, it, expect } from 'vitest';
import {
  matchesFeedbackFilters,
  countForCategory,
  countForStatus,
  type FeedbackFilterState,
} from '../feedback-filter';
import type { FeedbackCategory, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';

/**
 * Regressionsschutz für die Chip-Zähler-Bug: die Kategorie-/Bereich-Zähler zählten
 * über ALLE Tickets (inkl. archivierte), während die Liste archivierte standard-
 * mäßig ausblendet → "Bug 5" bei nur 1 sichtbaren Bug. Die Facetten-Zähler leiten
 * jetzt aus demselben Prädikat wie die Liste ab: die ausgewählte Chip-Zahl ==
 * Anzahl der angezeigten Listen-Elemente.
 */
function makeTicket(
  id: string,
  category: FeedbackCategory,
  status: FeedbackStatus,
  page: string,
): FeedbackItem {
  return {
    id,
    created_at: '2026-06-01T00:00:00.000Z',
    user_id: 'u1',
    category,
    text: `ticket ${id}`,
    kurator_status: status,
    context: {
      route: 'x',
      page,
      device: 'Desktop',
      viewport: '1920x1080',
      sessionDuration: 0,
      errors: [],
      timestamp: '2026-06-01T00:00:00.000Z',
    },
  };
}

// 5 Bugs (4 davon archiviert → 1 sichtbar), 3 Ideen (1 archiviert → 2 sichtbar).
const b1 = makeTicket('b1', 'problem', 'neu', 'Auslastung');
const b2 = makeTicket('b2', 'problem', 'archiviert', 'Auslastung');
const tickets: FeedbackItem[] = [
  b1,
  b2,
  makeTicket('b3', 'problem', 'archiviert', 'Home'),
  makeTicket('b4', 'problem', 'archiviert', 'Förderanträge'),
  makeTicket('b5', 'problem', 'archiviert', 'Home'),
  makeTicket('i1', 'idea', 'neu', 'Suche'),
  makeTicket('i2', 'idea', 'geplant', 'Home'),
  makeTicket('i3', 'idea', 'archiviert', 'Home'),
];

const EMPTY: FeedbackFilterState = { category: '', status: '', area: '', showArchived: false };

function listCount(f: FeedbackFilterState): number {
  return tickets.filter(t => matchesFeedbackFilters(t, f)).length;
}

describe('matchesFeedbackFilters', () => {
  it('blendet Archivierte aus, wenn showArchived=false und kein Status-Filter gesetzt', () => {
    expect(matchesFeedbackFilters(b2, EMPTY)).toBe(false); // b2 archiviert
    expect(matchesFeedbackFilters(b1, EMPTY)).toBe(true); // b1 neu
  });

  it('zeigt Archivierte, wenn der Status-Filter explizit "archiviert" ist (Checkbox egal)', () => {
    const f: FeedbackFilterState = { ...EMPTY, status: 'archiviert' };
    expect(matchesFeedbackFilters(b2, f)).toBe(true); // b2 archiviert
    expect(matchesFeedbackFilters(b1, f)).toBe(false); // b1 neu
  });
});

describe('Facetten-Zähler == Listen-Länge', () => {
  it('Kategorie-Zähler schließt Archivierte aus, wenn die Liste sie ausblendet (der gemeldete Bug)', () => {
    // "Bug"-Chip: 5 Bugs insgesamt, 4 archiviert → nur 1 sichtbar.
    expect(countForCategory(tickets, EMPTY, 'problem')).toBe(1);
    // ... und die tatsächlich angezeigte Liste bei ausgewähltem Bug-Filter zeigt exakt 1.
    expect(listCount({ ...EMPTY, category: 'problem' })).toBe(1);
  });

  it('zählt mit eingeblendeten Archivierten alle Mitglieder', () => {
    const f: FeedbackFilterState = { ...EMPTY, showArchived: true };
    expect(countForCategory(tickets, f, 'problem')).toBe(5);
    expect(listCount({ ...f, category: 'problem' })).toBe(5);
  });

  it('"Alle"-Kategorie-Zähler folgt dem Sichtbaren (nicht der Gesamtzahl)', () => {
    // 3 nicht-archivierte Tickets (b1, i1, i2).
    expect(countForCategory(tickets, EMPTY, '')).toBe(3);
    expect(listCount(EMPTY)).toBe(3);
  });

  it('eine Facette schränkt sich nicht selbst ein (Bug aktiv → Idee-Chip zeigt trotzdem Ideen)', () => {
    const bugActive: FeedbackFilterState = { ...EMPTY, category: 'problem' };
    expect(countForCategory(tickets, bugActive, 'idea')).toBe(2); // i1, i2 (i3 archiviert)
  });

  it('cross-facet: aktiver Status-Filter reduziert die Kategorie-Zähler', () => {
    const neuActive: FeedbackFilterState = { ...EMPTY, status: 'neu' };
    expect(countForCategory(tickets, neuActive, 'problem')).toBe(1); // nur b1
    expect(countForCategory(tickets, neuActive, 'idea')).toBe(1); // nur i1
    expect(listCount({ ...neuActive, category: 'problem' })).toBe(1);
  });

  it('Status-"Archiviert"-Chip zählt Archivierte (facettengefiltert nach Kategorie)', () => {
    expect(countForStatus(tickets, EMPTY, 'archiviert')).toBe(5); // b2,b3,b4,b5,i3
    const bugActive: FeedbackFilterState = { ...EMPTY, category: 'problem' };
    expect(countForStatus(tickets, bugActive, 'archiviert')).toBe(4); // b2,b3,b4,b5
  });

  it('Status-"Alle"-Chip folgt showArchived', () => {
    expect(countForStatus(tickets, EMPTY, '')).toBe(3); // nicht-archiviert
    expect(countForStatus(tickets, { ...EMPTY, showArchived: true }, '')).toBe(8); // alle
  });
});
