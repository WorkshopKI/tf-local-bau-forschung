/**
 * Tests für die reine Kanban-Lane-Ableitung: Lane-Zuordnung über
 * getStatusCategory (Roh-Status-Fixtures), Verbund-Clustering, Kappung,
 * Sortierung, Schmalschienen-Erhalt leerer Lanes, Spalten-Passthrough,
 * Grundmengen-Filter, Akzent-Auflösung (Token-only) und Config-Aktivierung.
 *
 * Dazu die drei Teile der FENSTER-Anordnung (v4.26): der Startvorschlag
 * (`seedVollbildLanes`), die Projektion der eingestellten Bahnen auf die Karten
 * (`projiziereVollbildLanes`) und der tolerante Leser des gespeicherten Standes
 * (`leseVollbildLanes`).
 */
import { describe, expect, it } from 'vitest';
import type { AntragListItem } from '@/core/services/csv/types';
import { parseBearbeiterFilter } from '@/plugins/antraege/bearbeiterFilter';
import {
  KANBAN_LANE_ACCENT,
  ZWEISPALTIG_AB,
  buildAntragKanbanLanes,
  filtereKanbanGrundmenge,
  kartenProKategorie,
  laneAccent,
  leseVollbildLanes,
  projiziereVollbildLanes,
  seedVollbildLanes,
  verschiebeVollbildLane,
} from '../kanbanLanes';
import { defaultHomeWidgetConfig, sichtbareWidgets } from '../homeWidgetsStore';
import type { HomeWidgetConfig, KanbanLane, VollbildLane } from '../types';

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

describe('seedVollbildLanes — der Startvorschlag des Fensters', () => {
  it('nimmt ALLE Kategorien, die konfigurierten zuerst', () => {
    const karten = kartenProKategorie([
      antrag({ aktenzeichen: 'A1', status: 'beantragt' }), // offen (konfiguriert)
      antrag({ aktenzeichen: 'A2', status: 'irgendwas unbekanntes' }), // sonstige
    ], NOW);
    const seed = seedVollbildLanes(karten, LANES);
    // Die drei konfigurierten vorn in IHRER Anordnung, dann der Rest in
    // Taxonomie-Reihenfolge — und zwar vollzaehlig, auch ohne Karten.
    expect(seed.slice(0, 3).map(l => l.kategorie)).toEqual(['offen', 'in_pruefung', 'entscheidung']);
    expect(seed).toHaveLength(9);
    expect(seed.every(l => l.sichtbar)).toBe(true);
  });

  it('schlaegt die zweite Spalte ab dem gemessenen Wert vor — die Widget-Config zaehlt nicht', () => {
    const mach = (n: number): AntragListItem[] => Array.from({ length: n }, (_, i) =>
      antrag({ aktenzeichen: `A${i}`, status: 'beantragt', antragsdatum: '2026-01-01' }));
    const spaltenVon = (n: number): number =>
      seedVollbildLanes(kartenProKategorie(mach(n), NOW), LANES)[0]!.spalten;
    expect(spaltenVon(ZWEISPALTIG_AB)).toBe(1);
    expect(spaltenVon(ZWEISPALTIG_AB + 1)).toBe(2);
    // LANES sagt fuer 'in_pruefung' spalten:2 — eine kurze Bahn bleibt einspaltig.
    const kurz = kartenProKategorie([antrag({ aktenzeichen: 'B1', status: 'techn geprüft' })], NOW);
    expect(seedVollbildLanes(kurz, LANES)[1]!.spalten).toBe(1);
  });

  it('erzeugt keine doppelte Bahn, wenn eine Kategorie doppelt konfiguriert ist', () => {
    const doppelt: KanbanLane[] = [
      { kategorie: 'offen', spalten: 1 },
      { kategorie: 'offen', spalten: 2 },
    ];
    const seed = seedVollbildLanes(new Map(), doppelt);
    expect(seed.filter(l => l.kategorie === 'offen')).toHaveLength(1);
    expect(seed).toHaveLength(9);
  });
});

describe('kartenProKategorie / projiziereVollbildLanes — was das Fenster zeichnet', () => {
  const alle = (): ReturnType<typeof kartenProKategorie> => kartenProKategorie([
    antrag({ aktenzeichen: 'A1', status: 'beantragt' }),
    antrag({ aktenzeichen: 'A2', status: 'bewilligt' }),
  ], NOW);
  const lane = (kategorie: VollbildLane['kategorie'], sichtbar: boolean): VollbildLane =>
    ({ kategorie, spalten: 1, sichtbar });

  it('zeigt die sichtbaren Bahnen in LISTEN-Reihenfolge, abgewaehlte fehlen ganz', () => {
    const { lanes, gesamt } = projiziereVollbildLanes(alle(), [
      lane('bewilligt', true),
      lane('offen', false),
      lane('entscheidung', true),
    ]);
    expect(lanes.map(l => l.kategorie)).toEqual(['bewilligt', 'entscheidung']);
    // 'offen' ist abgewaehlt — seine Karte zaehlt auch im Kopf nicht mit.
    expect(gesamt).toBe(1);
  });

  it('behaelt LEERE sichtbare Bahnen (Schmalschiene) — angehakt heisst sichtbar', () => {
    const { lanes } = projiziereVollbildLanes(alle(), [lane('nachforderung', true)]);
    expect(lanes).toHaveLength(1);
    expect(lanes[0]!.karten).toEqual([]);
    expect(lanes[0]!.gesamt).toBe(0);
  });

  it('kappt NICHT — maxKartenProLane ist eine Widget-Frage', () => {
    const viele = Array.from({ length: 40 }, (_, i) =>
      antrag({ aktenzeichen: `A${i}`, status: 'beantragt', antragsdatum: '2026-01-01' }));
    const { lanes } = projiziereVollbildLanes(kartenProKategorie(viele, NOW), [lane('offen', true)]);
    expect(lanes[0]!.karten).toHaveLength(40);
    expect(lanes[0]!.gesamt).toBe(40);
  });

  it('clustert Verbuende wie das Widget (eine Karte je verbund_id)', () => {
    const karten = kartenProKategorie([
      antrag({ aktenzeichen: 'V1', verbund_id: 'VB', status: 'beantragt', antragsdatum: '2026-01-01' }),
      antrag({ aktenzeichen: 'V2', verbund_id: 'VB', status: 'beantragt', antragsdatum: '2026-03-01' }),
    ], NOW);
    const { lanes } = projiziereVollbildLanes(karten, [lane('offen', true)]);
    expect(lanes[0]!.karten).toHaveLength(1);
    expect(lanes[0]!.karten[0]!.aktenzeichen).toBe('V1'); // aeltester Eingang
    expect(lanes[0]!.karten[0]!.tvCount).toBe(2);
  });
});

describe('leseVollbildLanes / verschiebeVollbildLane — gespeicherter Stand', () => {
  const seed = (): VollbildLane[] => seedVollbildLanes(new Map(), LANES);

  it('ohne gespeicherten Stand gilt der Seed', () => {
    expect(leseVollbildLanes(undefined, seed())).toEqual(seed());
    expect(leseVollbildLanes({ lanes: [] }, seed())).toEqual(seed());
  });

  it('behaelt Reihenfolge, Auswahl und Spaltenzahl des gespeicherten Standes', () => {
    const gelesen = leseVollbildLanes([
      { kategorie: 'bewilligt', spalten: 3, sichtbar: true },
      { kategorie: 'offen', spalten: 1, sichtbar: false },
    ], seed());
    expect(gelesen[0]).toEqual({ kategorie: 'bewilligt', spalten: 3, sichtbar: true });
    expect(gelesen[1]).toEqual({ kategorie: 'offen', spalten: 1, sichtbar: false });
  });

  it('wirft Unbekanntes und Dubletten raus, klemmt die Spaltenzahl', () => {
    const gelesen = leseVollbildLanes([
      { kategorie: 'offen', spalten: 7 },
      { kategorie: 'offen', spalten: 2 }, // Dublette
      { kategorie: 'gibt_es_nicht', spalten: 2 },
      'kaputt',
      null,
    ], seed());
    expect(gelesen.filter(l => l.kategorie === 'offen')).toHaveLength(1);
    expect(gelesen[0]).toEqual({ kategorie: 'offen', spalten: 1, sichtbar: true });
    expect(gelesen.map(l => l.kategorie)).not.toContain('gibt_es_nicht');
  });

  it('haengt fehlende Kategorien SICHTBAR an (nichts still verschlucken)', () => {
    const gelesen = leseVollbildLanes([{ kategorie: 'offen', spalten: 1, sichtbar: true }], seed());
    expect(gelesen).toHaveLength(9);
    expect(gelesen.slice(1).every(l => l.sichtbar)).toBe(true);
  });

  it('eine Liste ohne sichtbare Bahn bleibt stehen (Nutzer-Entscheidung, kein Fehler)', () => {
    const alleAus = seed().map(l => ({ ...l, sichtbar: false }));
    expect(leseVollbildLanes(alleAus, seed()).every(l => !l.sichtbar)).toBe(true);
  });

  it('verschiebt um einen Platz, am Rand referenzgleich', () => {
    const lanes = seed();
    expect(verschiebeVollbildLane(lanes, 'in_pruefung', -1).map(l => l.kategorie).slice(0, 2))
      .toEqual(['in_pruefung', 'offen']);
    expect(verschiebeVollbildLane(lanes, 'offen', -1)).toBe(lanes);
    expect(verschiebeVollbildLane(lanes, 'gibt_es_nicht' as VollbildLane['kategorie'], 1)).toBe(lanes);
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

/**
 * **Die Kopfzahl ist ein Auszug und sagt es** (v4.131). `gesamt` summiert nur
 * die konfigurierten Bahnen; was daneben liegt, stand nirgends — „25 Vorgänge"
 * las sich als Bestand, während 7 weitere in nicht geführten Kategorien lagen.
 */
describe('`ausserhalb` — was die Bahnen NICHT zeigen', () => {
  it('zählt die Karten der nicht konfigurierten Kategorien', () => {
    const { gesamt, ausserhalb } = buildAntragKanbanLanes([
      antrag({ aktenzeichen: 'A-1', status: 'beantragt' }),          // offen (Bahn)
      antrag({ aktenzeichen: 'A-2', status: 'techn geprüft' }),      // in_pruefung (Bahn)
      antrag({ aktenzeichen: 'A-3', status: 'bewilligt' }),          // bewilligt — KEINE Bahn
      antrag({ aktenzeichen: 'A-4', status: 'bewilligt' }),
    ], LANES, 4, NOW);
    expect(gesamt).toBe(2);
    expect(ausserhalb).toBe(2);
  });

  it('ist 0, wenn die Bahnen alles abdecken', () => {
    const { ausserhalb } = buildAntragKanbanLanes([
      antrag({ aktenzeichen: 'A-1', status: 'beantragt' }),
    ], LANES, 4, NOW);
    expect(ausserhalb).toBe(0);
  });

  it('zählt eine doppelt konfigurierte Bahn nur einmal in `gesamt`', () => {
    const doppelt: KanbanLane[] = [
      { kategorie: 'offen', spalten: 1 },
      { kategorie: 'offen', spalten: 1 },
    ];
    const { gesamt, ausserhalb } = buildAntragKanbanLanes([
      antrag({ aktenzeichen: 'A-1', status: 'beantragt' }),
      antrag({ aktenzeichen: 'A-2', status: 'beantragt' }),
    ], doppelt, 4, NOW);
    expect(gesamt).toBe(2);
    expect(ausserhalb).toBe(0);
  });

  it('das Fenster zählt abgewählte Bahnen als `ausserhalb`', () => {
    const karten = kartenProKategorie([
      antrag({ aktenzeichen: 'A-1', status: 'beantragt' }),
      antrag({ aktenzeichen: 'A-2', status: 'bewilligt' }),
    ], NOW);
    const bahnen: VollbildLane[] = [
      { kategorie: 'offen', spalten: 1, sichtbar: true },
      { kategorie: 'bewilligt', spalten: 1, sichtbar: false },
    ];
    const { gesamt, ausserhalb } = projiziereVollbildLanes(karten, bahnen);
    expect(gesamt).toBe(1);
    expect(ausserhalb).toBe(1);
  });
});

/**
 * **Der Inaktiv-Ausschluss gilt auch hier** (v4.131) — Dashboard und Zieltabelle
 * wandten ihn an, das Kanban nicht: im „alle"-Modus zählte es Anträge mit, die
 * die Liste nach dem Klick ausblendet.
 */
describe('filtereKanbanGrundmenge — inaktive MAs', () => {
  const bestand = [
    antrag({ aktenzeichen: 'A-1', status: 'beantragt', tib_kuerz: 'ALT' }),
    antrag({ aktenzeichen: 'A-2', status: 'beantragt', tib_kuerz: 'NEU' }),
  ];
  const ALLE = parseBearbeiterFilter(undefined, undefined);

  it('blendet im „alle"-Modus die Anträge inaktiver Kürzel aus', () => {
    const raus = filtereKanbanGrundmenge(bestand, ALLE, {
      kuerzel: new Set(['ALT']), zeigen: false,
    });
    expect(raus.map(a => a.aktenzeichen)).toEqual(['A-2']);
  });

  it('lässt sie stehen, wenn der Nutzer sie ausdrücklich sehen will', () => {
    const drin = filtereKanbanGrundmenge(bestand, ALLE, {
      kuerzel: new Set(['ALT']), zeigen: true,
    });
    expect(drin).toHaveLength(2);
  });

  it('ohne Angabe unverändert (bestehende Aufrufer, leeres Set)', () => {
    expect(filtereKanbanGrundmenge(bestand, ALLE)).toHaveLength(2);
    expect(filtereKanbanGrundmenge(bestand, ALLE, { kuerzel: new Set(), zeigen: false })).toHaveLength(2);
  });
});
