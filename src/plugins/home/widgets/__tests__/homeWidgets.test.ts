/**
 * Tests fuer das Home-Widget-Fundament (Phase 0):
 * Default-Factory (heutige Homepage), toleranter Read + Migrations-Stub,
 * LWW-Merge (kv vs. PersonalEinstellungen-Mirror), Legacy-Collapse-Seed,
 * Sortierung/Sichtbarkeitsfilter, move-Semantik, Save-Roundtrip inkl. Mirror.
 *
 * `fake-indexeddb` als Polyfill (vitest node env) — analog recorder.test.ts.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '@/core/services/storage/idb-store';
import { DEFAULT_EINSTELLUNGEN } from '@/core/services/personal-storage/sync';
import {
  PERSONAL_EINSTELLUNGEN_IDB_KEY,
  type PersonalEinstellungen,
} from '@/core/services/personal-storage/types';
import {
  HOME_WIDGETS_IDB_KEY,
  MEINE_ANTRAEGE_COLLAPSE_LEGACY_KEY,
  defaultHomeWidgetConfig,
  leseHomeWidgetConfig,
  loadHomeWidgets,
  moveInstanz,
  reconcileVerfuegbareWidgets,
  saveHomeWidgets,
  sichtbareWidgets,
  sortiereInstanzen,
} from '../homeWidgetsStore';
import type { HomeWidgetConfig } from '../types';
import { WIDGET_KATALOG } from '../widgetCatalog';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

async function frischeIdb(): Promise<IDBStore> {
  const idb = new IDBStore();
  await idb.open();
  return idb;
}

function cfgMit(updatedAt: string, marker: string): HomeWidgetConfig {
  const cfg = defaultHomeWidgetConfig();
  return {
    ...cfg,
    updatedAt,
    // Marker-Instanz-ID, um im Test zu erkennen welche Quelle gewonnen hat
    widgets: cfg.widgets.map((w, i) => (i === 0 ? { ...w, id: marker } : w)),
  };
}

describe('defaultHomeWidgetConfig — heutige Homepage exakt', () => {
  it('bildet Reihenfolge, Bereiche und Sichtbarkeit der heutigen Homepage ab', () => {
    const cfg = defaultHomeWidgetConfig();
    const sortiert = sortiereInstanzen(cfg.widgets);
    expect(sortiert.map(w => w.typ)).toEqual([
      'weitermachen', 'meine-antraege', 'kanban',
      'antragseingang', 'ai-assistent', 'notizen',
    ]);
    // Haupt vs. Seite wie heute
    expect(sortiert.filter(w => w.bereich === 'haupt').map(w => w.typ))
      .toEqual(['weitermachen', 'meine-antraege', 'kanban']);
    expect(sortiert.filter(w => w.bereich === 'seite').map(w => w.typ))
      .toEqual(['antragseingang', 'ai-assistent', 'notizen']);
    // Neue Widgets sind Opt-in — heutiges Pixel-Verhalten unveraendert
    const sichtbarkeit = Object.fromEntries(sortiert.map(w => [w.typ, w.sichtbar]));
    expect(sichtbarkeit).toEqual({
      weitermachen: true,
      'meine-antraege': true,
      kanban: false,
      antragseingang: true,
      'ai-assistent': true,
      notizen: false,
    });
    // LWW: Default verliert gegen jeden echten Save
    expect(cfg.updatedAt).toBe(new Date(0).toISOString());
  });

  it('uebernimmt den Legacy-Collapse-Seed fuer meine-antraege', () => {
    const cfg = defaultHomeWidgetConfig({ meineAntraegeEingeklappt: true });
    const ma = cfg.widgets.find(w => w.typ === 'meine-antraege')!;
    expect(ma.eingeklappt).toBe(true);
    expect(cfg.widgets.filter(w => w.typ !== 'meine-antraege').every(w => !w.eingeklappt)).toBe(true);
  });
});

describe('leseHomeWidgetConfig — toleranter Read + Migrations-Stub', () => {
  it('verwirft Nicht-Objekte und kaputte Shapes', () => {
    expect(leseHomeWidgetConfig(null)).toBeNull();
    expect(leseHomeWidgetConfig('quatsch')).toBeNull();
    expect(leseHomeWidgetConfig({ version: 1 })).toBeNull();
    expect(leseHomeWidgetConfig({ version: 1, updatedAt: 5, widgets: [] })).toBeNull();
  });

  it('verwirft unbekannte Versionen (Migrations-Einstieg: nie raten)', () => {
    expect(leseHomeWidgetConfig({ version: 2, updatedAt: 'x', widgets: [] })).toBeNull();
  });

  it('filtert defekte Instanzen, behaelt valide', () => {
    const valide = defaultHomeWidgetConfig().widgets[0]!;
    const gelesen = leseHomeWidgetConfig({
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      widgets: [valide, { id: 'kaputt' }, 42],
    });
    expect(gelesen?.widgets).toEqual([valide]);
  });
});

describe('loadHomeWidgets — LWW kv vs. PersonalEinstellungen-Mirror', () => {
  it('ohne Daten: Default', async () => {
    const idb = await frischeIdb();
    const cfg = await loadHomeWidgets(idb);
    expect(cfg.widgets.map(w => w.typ)).toContain('weitermachen');
    expect(cfg.updatedAt).toBe(new Date(0).toISOString());
  });

  it('kv neuer als Mirror → kv gewinnt', async () => {
    const idb = await frischeIdb();
    await idb.set(HOME_WIDGETS_IDB_KEY, cfgMit('2026-07-12T10:00:00.000Z', 'aus-kv'));
    const einstellungen: PersonalEinstellungen = {
      ...DEFAULT_EINSTELLUNGEN,
      homeWidgets: cfgMit('2026-07-01T10:00:00.000Z', 'aus-mirror'),
    };
    await idb.set(PERSONAL_EINSTELLUNGEN_IDB_KEY, einstellungen);
    const cfg = await loadHomeWidgets(idb);
    expect(cfg.widgets[0]!.id).toBe('aus-kv');
  });

  it('Mirror neuer als kv → Mirror gewinnt (anderes Geraet hat gespeichert)', async () => {
    const idb = await frischeIdb();
    await idb.set(HOME_WIDGETS_IDB_KEY, cfgMit('2026-07-01T10:00:00.000Z', 'aus-kv'));
    const einstellungen: PersonalEinstellungen = {
      ...DEFAULT_EINSTELLUNGEN,
      homeWidgets: cfgMit('2026-07-12T10:00:00.000Z', 'aus-mirror'),
    };
    await idb.set(PERSONAL_EINSTELLUNGEN_IDB_KEY, einstellungen);
    const cfg = await loadHomeWidgets(idb);
    expect(cfg.widgets[0]!.id).toBe('aus-mirror');
  });

  it('nur Mirror vorhanden → Mirror', async () => {
    const idb = await frischeIdb();
    const einstellungen: PersonalEinstellungen = {
      ...DEFAULT_EINSTELLUNGEN,
      homeWidgets: cfgMit('2026-07-12T10:00:00.000Z', 'aus-mirror'),
    };
    await idb.set(PERSONAL_EINSTELLUNGEN_IDB_KEY, einstellungen);
    const cfg = await loadHomeWidgets(idb);
    expect(cfg.widgets[0]!.id).toBe('aus-mirror');
  });

  it('liest den Legacy-Collapse-Seed aus localStorage (nur beim Default)', async () => {
    const idb = await frischeIdb();
    const stub = new Map<string, string>();
    stub.set(MEINE_ANTRAEGE_COLLAPSE_LEGACY_KEY, '1');
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => stub.get(k) ?? null,
    };
    try {
      const cfg = await loadHomeWidgets(idb);
      expect(cfg.widgets.find(w => w.typ === 'meine-antraege')!.eingeklappt).toBe(true);
    } finally {
      delete (globalThis as Record<string, unknown>).localStorage;
    }
  });
});

describe('saveHomeWidgets — kv verbatim + Mirror in den Einstellungen-Sync', () => {
  it('schreibt kv-Key und spiegelt in PERSONAL_EINSTELLUNGEN (ohne Handle: nur Cache)', async () => {
    const idb = await frischeIdb();
    const cfg = cfgMit('2026-07-12T11:00:00.000Z', 'gespeichert');
    await saveHomeWidgets(idb, cfg);
    const kv = await idb.get<HomeWidgetConfig>(HOME_WIDGETS_IDB_KEY);
    expect(kv?.updatedAt).toBe('2026-07-12T11:00:00.000Z');
    expect(kv?.widgets[0]!.id).toBe('gespeichert');
    const einstellungen = await idb.get<PersonalEinstellungen>(PERSONAL_EINSTELLUNGEN_IDB_KEY);
    expect(einstellungen?.homeWidgets?.widgets[0]!.id).toBe('gespeichert');
    expect(einstellungen?.version).toBe(1);
  });
});

describe('sichtbareWidgets — Katalog- + Flag-Filter', () => {
  it('filtert nach bereich, sichtbar, verfuegbar und sichtbarWenn', () => {
    const cfg = defaultHomeWidgetConfig();
    // Alles sichtbar schalten, um die Katalog-Filter isoliert zu testen
    const alleSichtbar: HomeWidgetConfig = {
      ...cfg,
      widgets: cfg.widgets.map(w => ({ ...w, sichtbar: true })),
    };
    const katalog = {
      ...WIDGET_KATALOG,
      kanban: { ...WIDGET_KATALOG.kanban, verfuegbar: false },
      'ai-assistent': { ...WIDGET_KATALOG['ai-assistent'], sichtbarWenn: () => false },
    };
    expect(sichtbareWidgets(alleSichtbar, 'haupt', katalog).map(w => w.typ))
      .toEqual(['weitermachen', 'meine-antraege']);
    expect(sichtbareWidgets(alleSichtbar, 'seite', katalog).map(w => w.typ))
      .toEqual(['antragseingang', 'notizen']);
  });

  it('unbekannte Typen aus zukuenftigen Config-Staenden fallen still raus', () => {
    const cfg = defaultHomeWidgetConfig();
    const mitFremdem: HomeWidgetConfig = {
      ...cfg,
      widgets: [
        ...cfg.widgets,
        { ...cfg.widgets[0]!, id: 'w-fremd', typ: 'zukunft' as never, position: 99 },
      ],
    };
    expect(sichtbareWidgets(mitFremdem, 'haupt').some(w => w.id === 'w-fremd')).toBe(false);
  });

  it('respektiert die konfigurierte Position (kein Notizen-Pin mehr, v2.239.1)', () => {
    const base = defaultHomeWidgetConfig();
    const cfg: HomeWidgetConfig = {
      ...base,
      widgets: base.widgets.map(w => {
        if (w.bereich !== 'seite') return w;
        // alle Seiten-Widgets sichtbar; Notizen bewusst ganz nach vorne (Pos 0)
        return w.typ === 'notizen' ? { ...w, sichtbar: true, position: 0 } : { ...w, sichtbar: true };
      }),
    };
    const seite = sichtbareWidgets(cfg, 'seite').map(w => w.typ);
    // Position 0 → Notizen jetzt VORNE (Pin entfernt: verschiebbar statt fixiert)
    expect(seite).toEqual(['notizen', 'antragseingang', 'ai-assistent']);
  });
});

describe('reconcileVerfuegbareWidgets — Opt-in + defaultEingeklappt', () => {
  it('zieht fehlende verfügbare Typen als sichtbar:false nach', () => {
    const auslast = reconcileVerfuegbareWidgets(defaultHomeWidgetConfig())
      .widgets.find(w => w.typ === 'auslastung');
    expect(auslast).toBeDefined();
    expect(auslast!.sichtbar).toBe(false);
  });

  it('Auslastung startet eingeklappt (defaultEingeklappt), Default-Widgets ausgeklappt', () => {
    const cfg = reconcileVerfuegbareWidgets(defaultHomeWidgetConfig());
    expect(cfg.widgets.find(w => w.typ === 'auslastung')!.eingeklappt).toBe(true);
    // kanban steht im Default (ohne defaultEingeklappt) → bleibt ausgeklappt
    expect(cfg.widgets.find(w => w.typ === 'kanban')!.eingeklappt).toBe(false);
  });

  it('hebt Notizen ans Spaltenende (Default unten, v2.239.1) — über die neu angehängten Seiten-Widgets', () => {
    // Default hat notizen an Pos 5; reconcile hängt weitere Seiten-Widgets
    // (auslastung, feedback-news …) an — notizen muss danach die höchste
    // Position behalten, sonst rutschte ein aktiviertes Widget darunter.
    const cfg = reconcileVerfuegbareWidgets(defaultHomeWidgetConfig());
    const maxPos = Math.max(...cfg.widgets.map(w => w.position));
    const notizen = cfg.widgets.find(w => w.typ === 'notizen')!;
    expect(notizen.position).toBe(maxPos);
    // konkret: ein (später aktiviertes) Auslastungs-Widget landet ÜBER Notizen
    const auslast = cfg.widgets.find(w => w.typ === 'auslastung')!;
    expect(auslast.position).toBeLessThan(notizen.position);
  });
});

describe('moveInstanz — pro Spalte (bereich) unabhängig', () => {
  const bereichOrder = (cfg: ReturnType<typeof defaultHomeWidgetConfig>, bereich: 'haupt' | 'seite') =>
    sortiereInstanzen(cfg.widgets).filter(w => w.bereich === bereich).map(w => w.typ);

  it('tauscht mit dem Nachbarn derselben Spalte (haupt)', () => {
    const cfg = defaultHomeWidgetConfig();
    const bewegt = moveInstanz(cfg, 'w-meine-antraege', 'hoch');
    expect(bereichOrder(bewegt, 'haupt')).toEqual(['meine-antraege', 'weitermachen', 'kanban']);
    // Seiten-Spalte unberührt.
    expect(bereichOrder(bewegt, 'seite')).toEqual(bereichOrder(cfg, 'seite'));
  });

  it('überspringt Widgets der anderen Spalte (Nachbar-Bereich bleibt)', () => {
    // ai-assistent (seite, global hinter kanban) tauscht mit antragseingang
    // (seite), NICHT mit kanban (haupt) — die andere Spalte ändert sich nicht.
    const cfg = defaultHomeWidgetConfig();
    const bewegt = moveInstanz(cfg, 'w-ai-assistent', 'hoch');
    expect(bereichOrder(bewegt, 'seite')).toEqual(['ai-assistent', 'antragseingang', 'notizen']);
    expect(bereichOrder(bewegt, 'haupt')).toEqual(['weitermachen', 'meine-antraege', 'kanban']);
  });

  it('am Spalten-Anfang/-Ende ein No-op — auch wenn global nicht Rand', () => {
    const cfg = defaultHomeWidgetConfig();
    // antragseingang ist erstes seite-Widget (global aber an Position 3).
    expect(moveInstanz(cfg, 'w-antragseingang', 'hoch')).toBe(cfg);
    // kanban ist letztes haupt-Widget (global aber an Position 2).
    expect(moveInstanz(cfg, 'w-kanban', 'runter')).toBe(cfg);
    expect(moveInstanz(cfg, 'gibt-es-nicht', 'hoch')).toBe(cfg);
  });

  it('bereich bleibt beim Verschieben unveraendert', () => {
    const cfg = defaultHomeWidgetConfig();
    const bewegt = moveInstanz(cfg, 'w-ai-assistent', 'hoch');
    expect(bewegt.widgets.find(w => w.id === 'w-ai-assistent')!.bereich).toBe('seite');
  });
});
