import { describe, it, expect } from 'vitest';
import type { CollapsibleSegItem } from '../CollapsibleSeg';
import { segAnzeige, sichtbareSegmente } from '../segAnzeige';

/** Der Projektart-Fall: „Einzelprojekt" steht im Menue NOCH EINMAL. */
const EINZEL: CollapsibleSegItem = {
  label: 'Einzelprojekt',
  count: 397,
  unterpunkte: [
    { label: 'Einzelprojekt', menuLabel: 'alle Einzelprojekte', count: 397 },
    { label: 'mit NW Bezug', count: 38 },
    { label: 'ohne NW Bezug', count: 192 },
  ],
};
const KOOP: CollapsibleSegItem = { label: 'Kooperationsprojekt', count: 441 };

describe('segAnzeige', () => {
  it('der Oberpunkt findet sich NICHT selbst als Unterpunkt', () => {
    // Sonst liest der Knopf „Einzelprojekt · Einzelprojekt 397" (v3.13.0).
    const a = segAnzeige(EINZEL, 'Einzelprojekt');
    expect(a.aktiverUnterpunkt).toBeNull();
    expect(a.gezeigt).toBe(EINZEL);
    expect(a.active).toBe(true);
  });

  it('ein echter Unterpunkt faerbt den Oberpunkt und stellt die Zahl', () => {
    const a = segAnzeige(EINZEL, 'mit NW Bezug');
    expect(a.aktiverUnterpunkt?.label).toBe('mit NW Bezug');
    expect(a.gezeigt.count).toBe(38);
    expect(a.active).toBe(true);
  });

  it('ein fremder Wert laesst den Knopf unbeteiligt — mit seiner eigenen Zahl', () => {
    const a = segAnzeige(EINZEL, 'Kooperationsprojekt');
    expect(a.aktiverUnterpunkt).toBeNull();
    expect(a.active).toBe(false);
    expect(a.gezeigt.count).toBe(397);
  });

  it('ein Segment ohne Menue verhaelt sich wie zuvor', () => {
    expect(segAnzeige(KOOP, 'Kooperationsprojekt')).toEqual({
      aktiverUnterpunkt: null, gezeigt: KOOP, active: true,
    });
    expect(segAnzeige(KOOP, 'Alle').active).toBe(false);
  });
});

/** Der Fall aus der Antragsphase: der Reiter schneidet bereits nach Status,
 *  also koennen „Bewilligt", „Begleitung" und „Beendet" darin gar nicht
 *  vorkommen — sie standen trotzdem mit einer 0 da. */
const STATUS_IN_ANTRAGSPHASE: CollapsibleSegItem[] = [
  { label: 'Alle', count: 38 },
  { label: 'Vor Entsch.', count: 37 },
  { label: 'Bei Antragst.', count: 1 },
  { label: 'Bewilligt', count: 0 },
  { label: 'Begleitung', count: 0 },
  { label: 'Beendet', count: 0 },
];

describe('sichtbareSegmente', () => {
  it('laesst nur stehen, was in dieser Sicht auch etwas liefert', () => {
    expect(sichtbareSegmente(STATUS_IN_ANTRAGSPHASE, 'Alle').map(i => i.label))
      .toEqual(['Alle', 'Vor Entsch.', 'Bei Antragst.']);
  });

  it('der Anker bleibt, auch wenn er selbst 0 zaehlt', () => {
    // Sonst gaebe es aus einer Auswahl keinen Rueckweg mehr.
    const leer = STATUS_IN_ANTRAGSPHASE.map(i => ({ ...i, count: 0 }));
    expect(sichtbareSegmente(leer, 'Alle').map(i => i.label)).toEqual(['Alle']);
  });

  it('das GEWAEHLTE Segment bleibt, auch bei 0', () => {
    // Es filtert ja gerade — verschwaende es, staende die Pille auf einem Wert,
    // den ihre eigene Liste nicht kennt.
    expect(sichtbareSegmente(STATUS_IN_ANTRAGSPHASE, 'Begleitung').map(i => i.label))
      .toEqual(['Alle', 'Vor Entsch.', 'Bei Antragst.', 'Begleitung']);
  });

  it('Segmente ohne Zaehler machen keine Mengenaussage und bleiben', () => {
    const items: CollapsibleSegItem[] = [
      { label: 'Alle', count: 5 },
      { label: 'Leer', count: 0 },
      { label: 'Eigene Auswahl' },
    ];
    expect(sichtbareSegmente(items, 'Eigene Auswahl').map(i => i.label))
      .toEqual(['Alle', 'Eigene Auswahl']);
  });

  it('raeumt auch im Untermenue auf', () => {
    const einzel: CollapsibleSegItem = {
      ...EINZEL,
      unterpunkte: [
        { label: 'Einzelprojekt', menuLabel: 'alle Einzelprojekte', count: 397 },
        { label: 'mit NW Bezug', count: 0 },
        { label: 'ohne NW Bezug', count: 192 },
      ],
    };
    const [gezeigt] = sichtbareSegmente([einzel, KOOP], 'Alle');
    expect(gezeigt!.unterpunkte?.map(u => u.label)).toEqual(['Einzelprojekt', 'ohne NW Bezug']);
  });

  it('nimmt dem Segment das Menue, wenn nur noch es selbst darin stuende', () => {
    const einzel: CollapsibleSegItem = {
      ...EINZEL,
      unterpunkte: [
        { label: 'Einzelprojekt', menuLabel: 'alle Einzelprojekte', count: 397 },
        { label: 'mit NW Bezug', count: 0 },
        { label: 'ohne NW Bezug', count: 0 },
      ],
    };
    const [gezeigt] = sichtbareSegmente([einzel, KOOP], 'Alle');
    expect(gezeigt!.unterpunkte).toBeUndefined();
    // Der Knopf selbst bleibt natuerlich waehlbar.
    expect(gezeigt!.label).toBe('Einzelprojekt');
  });

  it('laesst eine Liste ohne Nullen unveraendert', () => {
    const items = [{ label: 'Alle', count: 5 }, { label: 'A', count: 2 }];
    expect(sichtbareSegmente(items, 'Alle')).toEqual(items);
  });
});
