/**
 * Guard für die persönliche Kanban-Einstellung des Feedback-Boards: der Default
 * zeigt den vollen Lane-Katalog in Design-Reihenfolge (einspaltig, bunt), und das
 * Lesen muss fremde/kaputte Werte still auffangen — eine defekte localStorage-Zeile
 * darf die Seite nie kippen.
 *
 * Seit v3.41 trägt die Liste zusätzlich die REIHENFOLGE des Boards und führt auch
 * die ausgeblendeten Lanes mit (`sichtbar: false`). Der Alt-Stand kannte das Feld
 * nicht und ließ ausgeblendete Lanes einfach weg — deshalb steht hier eine
 * Migrationsprobe: was fehlt, kommt ausgeblendet dazu, ohne die eingestellte
 * Folge der übrigen anzufassen.
 */
import { describe, expect, it } from 'vitest';
import { FEEDBACK_STATUS } from '@/core/services/feedback';
import {
  defaultBoardKanbanConfig,
  parseBoardKanbanConfig,
  sichtbareLanes,
  verschiebeLane,
  type BoardLane,
} from '../boardKanbanConfig';

const lane = (
  status: BoardLane['status'],
  sichtbar = true,
  spalten: BoardLane['spalten'] = 1,
): BoardLane =>
  ({ status, spalten, sichtbar });

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
    expect(cfg.lanes.every(l => l.sichtbar)).toBe(true);
    expect(cfg.farbmodus).toBe('bunt');
  });
});

describe('parseBoardKanbanConfig', () => {
  it('übernimmt eine vollständige Config unverändert (Round-Trip)', () => {
    const cfg = {
      lanes: [
        lane(FEEDBACK_STATUS.in_bearbeitung, true, 2),
        lane(FEEDBACK_STATUS.neu),
        lane(FEEDBACK_STATUS.rueckfrage, false),
        lane(FEEDBACK_STATUS.geplant),
        lane(FEEDBACK_STATUS.umgesetzt),
        lane(FEEDBACK_STATUS.abgelehnt, false),
      ],
      farbmodus: 'monochrom' as const,
    };
    expect(parseBoardKanbanConfig(JSON.parse(JSON.stringify(cfg)))).toEqual(cfg);
  });

  it.each([null, undefined, 42, 'quatsch', [], {}])('fällt bei %p auf den Default zurück', roh => {
    expect(parseBoardKanbanConfig(roh)).toEqual(defaultBoardKanbanConfig());
  });

  // Der Alt-Stand (bis v3.40): „steht in der Liste" hieß sichtbar, eine
  // ausgeblendete Lane FEHLTE. Beides muss der Leser ohne Key-Bump mitziehen.
  it('zieht den Alt-Stand mit: fehlende Lanes kommen ausgeblendet dazu', () => {
    const cfg = parseBoardKanbanConfig({
      lanes: [
        { status: FEEDBACK_STATUS.in_bearbeitung, spalten: 2 },
        { status: FEEDBACK_STATUS.neu, spalten: 1 },
      ],
    });
    // Die eingestellte Folge der beiden bleibt vorn, der Rest hängt hinten dran.
    expect(cfg.lanes.map(l => l.status)).toEqual([
      FEEDBACK_STATUS.in_bearbeitung,
      FEEDBACK_STATUS.neu,
      FEEDBACK_STATUS.rueckfrage,
      FEEDBACK_STATUS.geplant,
      FEEDBACK_STATUS.umgesetzt,
      FEEDBACK_STATUS.abgelehnt,
    ]);
    expect(cfg.lanes.filter(l => l.sichtbar).map(l => l.status)).toEqual([
      FEEDBACK_STATUS.in_bearbeitung,
      FEEDBACK_STATUS.neu,
    ]);
    // Wer damals etwas ausgeblendet hatte, sieht es weiterhin nicht.
    expect(cfg.lanes.find(l => l.status === FEEDBACK_STATUS.geplant)?.sichtbar).toBe(false);
  });

  it('liest einen Eintrag ohne `sichtbar` als sichtbar (kein dritter Zustand)', () => {
    const cfg = parseBoardKanbanConfig({
      lanes: [{ status: FEEDBACK_STATUS.neu, spalten: 1 }],
    });
    expect(cfg.lanes.find(l => l.status === FEEDBACK_STATUS.neu)?.sichtbar).toBe(true);
  });

  it('verwirft unbekannte und nie-als-Spalte-gedachte Status', () => {
    const cfg = parseBoardKanbanConfig({
      lanes: [
        { status: 'gibts-nicht', spalten: 1 },
        { status: FEEDBACK_STATUS.archiviert, spalten: 1 },
        { status: FEEDBACK_STATUS.neu, spalten: 1 },
      ],
    });
    expect(cfg.lanes.map(l => l.status)).not.toContain(FEEDBACK_STATUS.archiviert);
    expect(cfg.lanes.filter(l => l.sichtbar).map(l => l.status)).toEqual([FEEDBACK_STATUS.neu]);
  });

  it('verwirft Dubletten (eine Lane je Status)', () => {
    const cfg = parseBoardKanbanConfig({
      lanes: [
        { status: FEEDBACK_STATUS.neu, spalten: 2 },
        { status: FEEDBACK_STATUS.neu, spalten: 1 },
      ],
    });
    expect(cfg.lanes.filter(l => l.status === FEEDBACK_STATUS.neu)).toEqual([
      lane(FEEDBACK_STATUS.neu, true, 2),
    ]);
  });

  it('klemmt die Spaltenzahl auf 1, 2 oder 3', () => {
    const cfg = parseBoardKanbanConfig({
      lanes: [
        { status: FEEDBACK_STATUS.neu, spalten: 7 },
        { status: FEEDBACK_STATUS.geplant, spalten: 0 },
        { status: FEEDBACK_STATUS.umgesetzt, spalten: '2' },
        { status: FEEDBACK_STATUS.abgelehnt, spalten: 2 },
        // Die dritte Spalte kam mit v4.21 dazu. Vor dem Umbau prüfte diese
        // Stelle exakt auf `=== 2` — eine gespeicherte 3 wäre still zur 1
        // geworden, obwohl der Schalter sie anbietet.
        { status: FEEDBACK_STATUS.rueckfrage, spalten: 3 },
      ],
    });
    expect(cfg.lanes.slice(0, 5).map(l => l.spalten)).toEqual([1, 1, 1, 2, 3]);
  });

  it('nimmt den Default, wenn nach dem Filtern keine Lane übrig bleibt', () => {
    // Sonst stünde der User vor einem leeren Board ohne Weg zurück.
    const cfg = parseBoardKanbanConfig({ lanes: [{ status: 'weg' }], farbmodus: 'monochrom' });
    expect(cfg.lanes).toEqual(defaultBoardKanbanConfig().lanes);
    expect(cfg.farbmodus).toBe('monochrom');
  });

  it('heilt ein Board, in dem KEINE Lane mehr sichtbar wäre', () => {
    // Eine leere Fläche, deren Grund nur im Popover steht — lieber alles zeigen.
    const cfg = parseBoardKanbanConfig({
      lanes: [
        lane(FEEDBACK_STATUS.neu, false),
        lane(FEEDBACK_STATUS.umgesetzt, false),
      ],
    });
    expect(cfg.lanes).toEqual(defaultBoardKanbanConfig().lanes);
  });

  it('fällt bei unbekanntem Farbmodus auf bunt zurück', () => {
    const cfg = parseBoardKanbanConfig({
      lanes: [{ status: FEEDBACK_STATUS.neu, spalten: 1 }],
      farbmodus: 'neon',
    });
    expect(cfg.farbmodus).toBe('bunt');
  });
});

describe('sichtbareLanes', () => {
  it('gibt nur die sichtbaren Lanes in ihrer Reihenfolge — ohne das Flag', () => {
    const cfg = {
      lanes: [
        lane(FEEDBACK_STATUS.umgesetzt, true, 2),
        lane(FEEDBACK_STATUS.neu, false),
        lane(FEEDBACK_STATUS.geplant),
      ],
      farbmodus: 'bunt' as const,
    };
    expect(sichtbareLanes(cfg)).toEqual([
      { status: FEEDBACK_STATUS.umgesetzt, spalten: 2 },
      { status: FEEDBACK_STATUS.geplant, spalten: 1 },
    ]);
  });
});

describe('verschiebeLane', () => {
  const start = (): BoardLane[] => [
    lane(FEEDBACK_STATUS.neu),
    lane(FEEDBACK_STATUS.rueckfrage, false),
    lane(FEEDBACK_STATUS.geplant),
  ];

  it('schiebt eine Lane einen Platz nach vorn', () => {
    expect(verschiebeLane(start(), FEEDBACK_STATUS.geplant, -1).map(l => l.status)).toEqual([
      FEEDBACK_STATUS.neu,
      FEEDBACK_STATUS.geplant,
      FEEDBACK_STATUS.rueckfrage,
    ]);
  });

  it('schiebt eine Lane einen Platz nach hinten', () => {
    expect(verschiebeLane(start(), FEEDBACK_STATUS.neu, 1).map(l => l.status)).toEqual([
      FEEDBACK_STATUS.rueckfrage,
      FEEDBACK_STATUS.neu,
      FEEDBACK_STATUS.geplant,
    ]);
  });

  // Der Nachbar zählt auch, wenn er ausgeblendet ist: das Popover zeigt ihn als
  // Zeile, und ein Klick, der dort nichts bewegt, sähe kaputt aus.
  it('tauscht auch mit einer ausgeblendeten Nachbarzeile', () => {
    const nachher = verschiebeLane(start(), FEEDBACK_STATUS.rueckfrage, -1);
    expect(nachher.map(l => l.status)).toEqual([
      FEEDBACK_STATUS.rueckfrage,
      FEEDBACK_STATUS.neu,
      FEEDBACK_STATUS.geplant,
    ]);
    expect(nachher[0]?.sichtbar).toBe(false);
  });

  it('lässt die Liste am Rand unverändert — und liefert dieselbe Referenz', () => {
    const vorher = start();
    expect(verschiebeLane(vorher, FEEDBACK_STATUS.neu, -1)).toBe(vorher);
    expect(verschiebeLane(vorher, FEEDBACK_STATUS.geplant, 1)).toBe(vorher);
  });

  it('lässt eine unbekannte Lane unverändert', () => {
    const vorher = start();
    expect(verschiebeLane(vorher, FEEDBACK_STATUS.umgesetzt, -1)).toBe(vorher);
  });
});
