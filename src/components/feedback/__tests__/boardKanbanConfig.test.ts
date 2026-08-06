/**
 * Guard für die persönliche Kanban-Einstellung des Feedback-Boards: der Default
 * zeigt den vollen Lane-Katalog in Design-Reihenfolge (einspaltig, bunt), und das
 * Lesen muss fremde/kaputte Werte still auffangen — eine defekte localStorage-Zeile
 * darf die Seite nie kippen.
 */
import { describe, expect, it } from 'vitest';
import { FEEDBACK_STATUS } from '@/core/services/feedback';
import {
  defaultBoardKanbanConfig,
  parseBoardKanbanConfig,
} from '../boardKanbanConfig';

describe('defaultBoardKanbanConfig', () => {
  // Reihenfolge = Fortschritt von links nach rechts, Abgelehnt als Endzustand
  // ganz rechts (v3.12, Handoff feedback-redesign). Rückfrage folgt auf Neu.
  it('zeigt alle sechs Lanes in Design-Reihenfolge, einspaltig und bunt', () => {
    const cfg = defaultBoardKanbanConfig();
    expect(cfg.lanes.map(l => l.status)).toEqual([
      FEEDBACK_STATUS.neu,
      FEEDBACK_STATUS.rueckfrage,
      FEEDBACK_STATUS.geplant,
      FEEDBACK_STATUS.in_bearbeitung,
      FEEDBACK_STATUS.umgesetzt,
      FEEDBACK_STATUS.abgelehnt,
    ]);
    expect(cfg.lanes.every(l => l.spalten === 1)).toBe(true);
    expect(cfg.farbmodus).toBe('bunt');
  });
});

describe('parseBoardKanbanConfig', () => {
  it('übernimmt eine gültige Config unverändert (Round-Trip)', () => {
    const cfg = {
      lanes: [
        { status: FEEDBACK_STATUS.neu, spalten: 2 as const },
        { status: FEEDBACK_STATUS.in_bearbeitung, spalten: 1 as const },
      ],
      farbmodus: 'monochrom' as const,
    };
    expect(parseBoardKanbanConfig(JSON.parse(JSON.stringify(cfg)))).toEqual(cfg);
  });

  it.each([null, undefined, 42, 'quatsch', [], {}])('fällt bei %p auf den Default zurück', roh => {
    expect(parseBoardKanbanConfig(roh)).toEqual(defaultBoardKanbanConfig());
  });

  it('verwirft unbekannte und nie-als-Spalte-gedachte Status', () => {
    const cfg = parseBoardKanbanConfig({
      lanes: [
        { status: 'gibts-nicht', spalten: 1 },
        { status: FEEDBACK_STATUS.archiviert, spalten: 1 },
        { status: FEEDBACK_STATUS.neu, spalten: 1 },
      ],
    });
    expect(cfg.lanes.map(l => l.status)).toEqual([FEEDBACK_STATUS.neu]);
  });

  it('verwirft Dubletten (eine Lane je Status)', () => {
    const cfg = parseBoardKanbanConfig({
      lanes: [
        { status: FEEDBACK_STATUS.neu, spalten: 2 },
        { status: FEEDBACK_STATUS.neu, spalten: 1 },
      ],
    });
    expect(cfg.lanes).toEqual([{ status: FEEDBACK_STATUS.neu, spalten: 2 }]);
  });

  it('klemmt die Spaltenzahl auf 1 oder 2', () => {
    const cfg = parseBoardKanbanConfig({
      lanes: [
        { status: FEEDBACK_STATUS.neu, spalten: 7 },
        { status: FEEDBACK_STATUS.geplant, spalten: 0 },
        { status: FEEDBACK_STATUS.umgesetzt, spalten: '2' },
        { status: FEEDBACK_STATUS.abgelehnt, spalten: 2 },
      ],
    });
    expect(cfg.lanes.map(l => l.spalten)).toEqual([1, 1, 1, 2]);
  });

  it('nimmt den Default, wenn nach dem Filtern keine Lane übrig bleibt', () => {
    // Sonst stünde der User vor einem leeren Board ohne Weg zurück.
    const cfg = parseBoardKanbanConfig({ lanes: [{ status: 'weg' }], farbmodus: 'monochrom' });
    expect(cfg.lanes).toEqual(defaultBoardKanbanConfig().lanes);
    expect(cfg.farbmodus).toBe('monochrom');
  });

  it('fällt bei unbekanntem Farbmodus auf bunt zurück', () => {
    const cfg = parseBoardKanbanConfig({
      lanes: [{ status: FEEDBACK_STATUS.neu, spalten: 1 }],
      farbmodus: 'neon',
    });
    expect(cfg.farbmodus).toBe('bunt');
  });
});
