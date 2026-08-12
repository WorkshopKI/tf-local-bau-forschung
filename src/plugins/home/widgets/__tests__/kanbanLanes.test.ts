/**
 * Tests für die reine Kanban-Lane-Ableitung (Phase 2): Lane-Zuordnung über
 * getStatusCategory (Roh-Status-Fixtures), Verbund-Clustering, Kappung,
 * Sortierung, Schmalschienen-Erhalt leerer Lanes, Spalten-Passthrough,
 * Grundmengen-Filter, Akzent-Auflösung (Token-only) und Config-Aktivierung.
 */
import { describe, expect, it } from 'vitest';
import type { AntragListItem } from '@/core/services/csv/types';
import { parseBearbeiterFilter } from '@/plugins/antraege/bearbeiterFilter';
import {
  KANBAN_LANE_ACCENT,
  ZWEISPALTIG_AB,
  buildAlleAntragKanbanLanes,
  buildAntragKanbanLanes,
  filtereKanbanGrundmenge,
  laneAccent,
} from '../kanbanLanes';
import { defaultHomeWidgetConfig, sichtbareWidgets } from '../homeWidgetsStore';
import type { HomeWidgetConfig, KanbanLane } from '../types';

const NOW = Date.parse('2026-07-12T00:00:00.000Z');

function antrag(
  partial: Omit<Partial<AntragListItem>, 'status'> & { aktenzeichen: string; status?: string },
): AntragListItem {
  // Fixture-Cast: Roh-Status-Strings sind hier Testdaten (AntragStatusRaw ist
  // im echten Import-Pfad enger typisiert).
  return { programm_id: 'p1', ...partial } as AntragListItem;
}

// Roh-Status aus dem kanonischen Mapping (status-canonical.ts):
// 'beantragt' → offen, 'techn geprüft' → in_pruefung, '' → sonstige.
const LANES: KanbanLane[] = [
  { kategorie: 'offen', spalten: 1 },
  { kategorie: 'in_pruefung', spalten: 2 },
  { kategorie: 'entscheidung', spalten: 1 },
];

describe('buildAntragKanbanLanes — Lane-Zuordnung + Clustering', () => {
  it('ordnet über getStatusCategory zu und behält leere Lanes (Schmalschiene)', () => {
    const { lanes, gesamt } = buildAntragKanbanLanes([
      antrag({ aktenzeichen: 'A1', status: 'beantragt', antragsdatum: '2026-01-01' }),
      antrag({ aktenzeichen: 'A2', status: 'techn geprüft', antragsdatum: '2026-02-01' }),
    ], LANES, 4, NOW);
    expect(lanes.map(l => l.kategorie)).toEqual(['offen', 'in_pruefung', 'entscheidung']);
    expect(lanes[0]!.karten.map(k => k.aktenzeichen)).toEqual(['A1']);
    expect(lanes[1]!.karten.map(k => k.aktenzeichen)).toEqual(['A2']);
    // Leere Lane bleibt ERHALTEN (Board rendert die 46px-Schiene)
    expect(lanes[2]!.karten).toEqual([]);
    expect(lanes[2]!.gesamt).toBe(0);
    expect(gesamt).toBe(2);
  });

  it('nicht konfigurierte Kategorien erscheinen nicht', () => {
    const { lanes, gesamt } = buildAntragKanbanLanes([
      antrag({ aktenzeichen: 'A1', status: 'irgendwas unbekanntes' }), // → sonstige
    ], LANES, 4, NOW);
    expect(lanes.every(l => l.karten.length === 0)).toBe(true);
    expect(gesamt).toBe(0);
  });

  it('clustert Verbünde: ein Eintrag, Repräsentant = ältester Eingang, tvCount', () => {
    const { lanes } = buildAntragKanbanLanes([
      antrag({ aktenzeichen: 'TV2', status: 'beantragt', verbund_id: 'VB1', antragsdatum: '2026-03-01', akronym: 'JUNG' }),
      antrag({ aktenzeichen: 'TV1', status: 'beantragt', verbund_id: 'VB1', antragsdatum: '2026-01-01', akronym: 'ALT' }),
      antrag({ aktenzeichen: 'SOLO', status: 'beantragt', antragsdatum: '2026-02-01' }),
    ], LANES, 4, NOW);
    const offen = lanes[0]!;
    expect(offen.gesamt).toBe(2);
    const vb = offen.karten.find(k => k.verbundId === 'VB1')!;
    expect(vb.aktenzeichen).toBe('TV1');
    expect(vb.label).toBe('ALT');
    expect(vb.tvCount).toBe(2);
    const solo = offen.karten.find(k => k.verbundId === null)!;
    expect(solo.tvCount).toBe(1);
  });

  it('kappt auf maxKartenProLane, gesamt bleibt die volle Zahl, ältester zuerst', () => {
    const { lanes } = buildAntragKanbanLanes([
      antrag({ aktenzeichen: 'A1', status: 'beantragt', antragsdatum: '2026-06-01' }),
      antrag({ aktenzeichen: 'A2', status: 'beantragt', antragsdatum: '2026-01-01' }),
      antrag({ aktenzeichen: 'A3', status: 'beantragt', antragsdatum: '2026-03-01' }),
    ], LANES, 2, NOW);
    const offen = lanes[0]!;
    expect(offen.gesamt).toBe(3);
    expect(offen.karten.map(k => k.aktenzeichen)).toEqual(['A2', 'A3']); // älteste zuerst
    expect(offen.karten[0]!.alterTage).toBeGreaterThan(offen.karten[1]!.alterTage!);
  });

  it('reicht spalten (1|2) durch', () => {
    const { lanes } = buildAntragKanbanLanes([], LANES, 4, NOW);
    expect(lanes.map(l => l.spalten)).toEqual([1, 2, 1]);
  });
});

describe('filtereKanbanGrundmenge — Bearbeiter-Semantik wie useEingangAmpelCounts', () => {
  it('wirft Irrläufer raus und wendet den Kürzel-Filter an', () => {
    const mode = parseBearbeiterFilter('MUE', false);
    const basis = filtereKanbanGrundmenge([
      antrag({ aktenzeichen: 'OK', status: 'beantragt', tib_kuerz: 'MUE' }),
      antrag({ aktenzeichen: 'FREMD', status: 'beantragt', tib_kuerz: 'ABC' }),
      antrag({ aktenzeichen: 'IRR', status: 'beantragt', tib_kuerz: 'MUE', vb_phase: 9 }),
    ], mode);
    expect(basis.map(a => a.aktenzeichen)).toEqual(['OK']);
  });

  it('ohne aktiven Filter bleibt alles (außer Irrläufern)', () => {
    const mode = parseBearbeiterFilter('alle', false);
    const basis = filtereKanbanGrundmenge([
      antrag({ aktenzeichen: 'A', status: 'beantragt' }),
      antrag({ aktenzeichen: 'IRR', status: 'beantragt', vb_phase: 9 }),
    ], mode);
    expect(basis.map(a => a.aktenzeichen)).toEqual(['A']);
  });
});

describe('laneAccent — Token-only Farbauflösung', () => {
  it('bunt: feste Kategorie→Token-Zuordnung', () => {
    expect(laneAccent('bunt', 'offen', 0)).toBe('var(--tf-kanban-offen)');
    expect(laneAccent('bunt', 'bewilligt', 5)).toBe('var(--tf-kanban-bewilligt)');
  });

  it('monochrom: zykliert die 3 Primär-Hue-Abstufungen nach Lane-Index', () => {
    expect(laneAccent('monochrom', 'offen', 0)).toBe('var(--tf-kanban-mono-1)');
    expect(laneAccent('monochrom', 'bewilligt', 1)).toBe('var(--tf-kanban-mono-2)');
    expect(laneAccent('monochrom', 'abgelehnt', 2)).toBe('var(--tf-kanban-mono-3)');
    expect(laneAccent('monochrom', 'offen', 3)).toBe('var(--tf-kanban-mono-1)');
  });

  it('alle Akzente sind Theme-Tokens (kein Hex im Widget-Code)', () => {
    for (const wert of Object.values(KANBAN_LANE_ACCENT)) {
      expect(wert).toMatch(/^var\(--tf-kanban-[a-z-]+\)$/);
    }
  });
});

describe('buildAlleAntragKanbanLanes — die Vollbild-Sicht', () => {
  it('zeigt AUCH die nicht konfigurierten Kategorien, konfigurierte zuerst', () => {
    const { lanes, gesamt } = buildAlleAntragKanbanLanes([
      antrag({ aktenzeichen: 'A1', status: 'beantragt' }), // offen (konfiguriert)
      antrag({ aktenzeichen: 'A2', status: 'irgendwas unbekanntes' }), // sonstige
      antrag({ aktenzeichen: 'A3', status: 'bewilligt' }), // bewilligt
    ], LANES, NOW);
    // 'offen' steht vorn (konfiguriert), der Rest in Taxonomie-Reihenfolge:
    // bewilligt kommt vor sonstige.
    expect(lanes.map(l => l.kategorie)).toEqual(['offen', 'bewilligt', 'sonstige']);
    // Genau die Karten, die das Widget mit derselben Config NICHT zeigt.
    expect(buildAntragKanbanLanes([
      antrag({ aktenzeichen: 'A2', status: 'irgendwas unbekanntes' }),
      antrag({ aktenzeichen: 'A3', status: 'bewilligt' }),
    ], LANES, 4, NOW).gesamt).toBe(0);
    expect(gesamt).toBe(3);
  });

  it('laesst LEERE Bahnen weg (anders als das Widget)', () => {
    const { lanes } = buildAlleAntragKanbanLanes(
      [antrag({ aktenzeichen: 'A1', status: 'beantragt' })], LANES, NOW,
    );
    expect(lanes.map(l => l.kategorie)).toEqual(['offen']);
  });

  it('kappt NICHT — maxKartenProLane ist eine Widget-Frage', () => {
    const viele = Array.from({ length: 40 }, (_, i) =>
      antrag({ aktenzeichen: `A${i}`, status: 'beantragt', antragsdatum: '2026-01-01' }));
    const { lanes } = buildAlleAntragKanbanLanes(viele, LANES, NOW);
    expect(lanes[0]!.karten).toHaveLength(40);
    expect(lanes[0]!.gesamt).toBe(40);
  });

  it('leitet die Spaltenzahl aus dem Bestand ab statt aus der Config', () => {
    const mach = (n: number): AntragListItem[] => Array.from({ length: n }, (_, i) =>
      antrag({ aktenzeichen: `A${i}`, status: 'beantragt', antragsdatum: '2026-01-01' }));
    // LANES sagt fuer 'offen' spalten:1 — die Ableitung ueberstimmt das.
    expect(buildAlleAntragKanbanLanes(mach(ZWEISPALTIG_AB), LANES, NOW).lanes[0]!.spalten).toBe(1);
    expect(buildAlleAntragKanbanLanes(mach(ZWEISPALTIG_AB + 1), LANES, NOW).lanes[0]!.spalten).toBe(2);
    // Umgekehrt: LANES sagt fuer 'in_pruefung' spalten:2 — eine kurze Bahn
    // bleibt trotzdem einspaltig.
    const kurz = [antrag({ aktenzeichen: 'B1', status: 'techn geprüft' })];
    expect(buildAlleAntragKanbanLanes(kurz, LANES, NOW).lanes[0]!.spalten).toBe(1);
  });

  it('erzeugt keine doppelte Bahn, wenn eine Kategorie doppelt konfiguriert ist', () => {
    const doppelt: KanbanLane[] = [
      { kategorie: 'offen', spalten: 1 },
      { kategorie: 'offen', spalten: 2 },
    ];
    const { lanes } = buildAlleAntragKanbanLanes(
      [antrag({ aktenzeichen: 'A1', status: 'beantragt' })], doppelt, NOW,
    );
    expect(lanes.map(l => l.kategorie)).toEqual(['offen']);
  });

  it('clustert Verbuende wie das Widget (eine Karte je verbund_id)', () => {
    const { lanes } = buildAlleAntragKanbanLanes([
      antrag({ aktenzeichen: 'V1', verbund_id: 'VB', status: 'beantragt', antragsdatum: '2026-01-01' }),
      antrag({ aktenzeichen: 'V2', verbund_id: 'VB', status: 'beantragt', antragsdatum: '2026-03-01' }),
    ], LANES, NOW);
    expect(lanes[0]!.karten).toHaveLength(1);
    expect(lanes[0]!.karten[0]!.aktenzeichen).toBe('V1'); // aeltester Eingang
    expect(lanes[0]!.karten[0]!.tvCount).toBe(2);
  });
});

describe('Kanban-Aktivierung über die Config', () => {
  it('Default ist unsichtbar; sichtbar:true bringt das Widget in den Haupt-Stack', () => {
    const cfg = defaultHomeWidgetConfig();
    expect(sichtbareWidgets(cfg, 'haupt').map(w => w.typ)).toEqual(['meine-antraege']);
    const aktiviert: HomeWidgetConfig = {
      ...cfg,
      widgets: cfg.widgets.map(w => (w.typ === 'kanban' ? { ...w, sichtbar: true } : w)),
    };
    expect(sichtbareWidgets(aktiviert, 'haupt').map(w => w.typ)).toEqual(['meine-antraege', 'kanban']);
  });
});
