/**
 * Tests fuer das Home-Widget-Fundament:
 * Default-Factory (v2, Home optimiert — ohne weitermachen), toleranter Read +
 * v1→v2-Migration (weitermachen ausblenden), LWW-Merge (kv vs.
 * PersonalEinstellungen-Mirror), Legacy-Collapse-Seed, Sortierung/
 * Sichtbarkeitsfilter, move-Semantik, Save-Roundtrip inkl. Mirror.
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
  migriereV2NachtlaufAnsEnde,
  moveInstanz,
  reconcileVerfuegbareWidgets,
  saveHomeWidgets,
  sichtbareWidgets,
  sortiereInstanzen,
} from '../homeWidgetsStore';
import type { HomeWidgetConfig, WidgetInstanz, WidgetTyp } from '../types';
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

describe('defaultHomeWidgetConfig — v2 (Home optimiert)', () => {
  it('bildet Reihenfolge, Bereiche und Sichtbarkeit ab — OHNE weitermachen (Hero-Band)', () => {
    const cfg = defaultHomeWidgetConfig();
    expect(cfg.version).toBe(3);
    const sortiert = sortiereInstanzen(cfg.widgets);
    // weitermachen ist nicht mehr im Default — das Hero-Band ersetzt es.
    expect(sortiert.map(w => w.typ)).toEqual([
      'meine-antraege', 'kanban',
      'antragseingang', 'ai-assistent', 'notizen',
    ]);
    expect(sortiert.some(w => w.typ === 'weitermachen')).toBe(false);
    // Haupt vs. Seite
    expect(sortiert.filter(w => w.bereich === 'haupt').map(w => w.typ))
      .toEqual(['meine-antraege', 'kanban']);
    expect(sortiert.filter(w => w.bereich === 'seite').map(w => w.typ))
      .toEqual(['antragseingang', 'ai-assistent', 'notizen']);
    // Opt-in-Widgets sind sichtbar:false
    const sichtbarkeit = Object.fromEntries(sortiert.map(w => [w.typ, w.sichtbar]));
    expect(sichtbarkeit).toEqual({
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

describe('leseHomeWidgetConfig — toleranter Read + v1→v2-Migration', () => {
  it('verwirft Nicht-Objekte und kaputte Shapes', () => {
    expect(leseHomeWidgetConfig(null)).toBeNull();
    expect(leseHomeWidgetConfig('quatsch')).toBeNull();
    expect(leseHomeWidgetConfig({ version: 1 })).toBeNull();
    expect(leseHomeWidgetConfig({ version: 1, updatedAt: 5, widgets: [] })).toBeNull();
  });

  it('verwirft unbekannte Versionen (Migrations-Einstieg: nie raten)', () => {
    expect(leseHomeWidgetConfig({ version: 4, updatedAt: 'x', widgets: [] })).toBeNull();
    expect(leseHomeWidgetConfig({ version: 0, updatedAt: 'x', widgets: [] })).toBeNull();
  });

  it('liest v2 verbatim (normalisiert version, ergänzt die Hero-Karten)', () => {
    // `hero` kam mit v4.41 additiv dazu — ein Stand ohne das Feld bekommt beim
    // Lesen den bisherigen Zustand „alles an" (kein Versions-Bump).
    const gelesen = leseHomeWidgetConfig({ version: 2, updatedAt: 'x', widgets: [] });
    expect(gelesen).toEqual({
      version: 3,
      updatedAt: 'x',
      widgets: [],
      hero: {
        sichtbar: { resume: true, alert: true },
        chips: { kritisch: true, warnung: true, qs: true },
      },
    });
  });

  it('filtert defekte Instanzen, behaelt valide', () => {
    const valide = defaultHomeWidgetConfig().widgets[0]!;
    const gelesen = leseHomeWidgetConfig({
      version: 3,
      updatedAt: '2026-01-01T00:00:00.000Z',
      widgets: [valide, { id: 'kaputt' }, 42],
    });
    expect(gelesen?.version).toBe(3);
    expect(gelesen?.widgets).toEqual([valide]);
  });

  it('v1 → v2: blendet eine sichtbare weitermachen-Instanz einmalig aus', () => {
    const weiter = {
      id: 'w-weitermachen', typ: 'weitermachen', position: 0, bereich: 'haupt',
      sichtbar: true, eingeklappt: false, config: { art: 'keine' },
    };
    const meine = {
      id: 'w-meine-antraege', typ: 'meine-antraege', position: 1, bereich: 'haupt',
      sichtbar: true, eingeklappt: false, config: { art: 'keine' },
    };
    const gelesen = leseHomeWidgetConfig({
      version: 1, updatedAt: '2026-01-01T00:00:00.000Z', widgets: [weiter, meine],
    });
    expect(gelesen?.version).toBe(3);
    // weitermachen ausgeblendet, sonst unverändert; andere Widgets unberührt.
    expect(gelesen?.widgets.find(w => w.typ === 'weitermachen')?.sichtbar).toBe(false);
    expect(gelesen?.widgets.find(w => w.typ === 'meine-antraege')?.sichtbar).toBe(true);
  });

  it('v2 → v3: „Änderungen der letzten Nacht" rückt einmalig ans Ende', () => {
    const instanz = (typ: string, position: number) => ({
      id: `w-${typ}`, typ, position, bereich: 'haupt',
      sichtbar: true, eingeklappt: false, config: { art: 'keine' },
    });
    const gelesen = leseHomeWidgetConfig({
      version: 2,
      updatedAt: '2026-01-01T00:00:00.000Z',
      widgets: [instanz('meine-antraege', 0), instanz('nachtlauf', 1), instanz('fristen', 2)],
    });
    expect(gelesen?.version).toBe(3);
    expect(gelesen?.widgets.map(w => w.typ).sort()).toEqual(['fristen', 'meine-antraege', 'nachtlauf']);
    const nacht = gelesen?.widgets.find(w => w.typ === 'nachtlauf')!;
    const andere = gelesen!.widgets.filter(w => w.typ !== 'nachtlauf');
    expect(andere.every(w => w.position < nacht.position)).toBe(true);
  });

  it('v3 wird nicht noch einmal umsortiert — wer die Karte hochholt, behält sie oben', () => {
    const instanz = (typ: string, position: number) => ({
      id: `w-${typ}`, typ, position, bereich: 'haupt',
      sichtbar: true, eingeklappt: false, config: { art: 'keine' },
    });
    const gelesen = leseHomeWidgetConfig({
      version: 3,
      updatedAt: '2026-01-01T00:00:00.000Z',
      widgets: [instanz('nachtlauf', 0), instanz('meine-antraege', 1)],
    });
    expect(gelesen?.widgets.find(w => w.typ === 'nachtlauf')?.position).toBe(0);
  });

  it('v1 → v2: eine bereits ausgeblendete weitermachen-Instanz bleibt (idempotent)', () => {
    const weiter = {
      id: 'w-weitermachen', typ: 'weitermachen', position: 0, bereich: 'haupt',
      sichtbar: false, eingeklappt: false, config: { art: 'keine' },
    };
    const gelesen = leseHomeWidgetConfig({
      version: 1, updatedAt: '2026-01-01T00:00:00.000Z', widgets: [weiter],
    });
    expect(gelesen?.widgets.find(w => w.typ === 'weitermachen')?.sichtbar).toBe(false);
  });
});

describe('loadHomeWidgets — LWW kv vs. PersonalEinstellungen-Mirror', () => {
  it('ohne Daten: Default (v2) — weitermachen als Opt-in (sichtbar:false) nachgezogen', async () => {
    const idb = await frischeIdb();
    const cfg = await loadHomeWidgets(idb);
    expect(cfg.version).toBe(3);
    // meine-antraege ist sichtbar; weitermachen wird per reconcile als Opt-in
    // (sichtbar:false) ergänzt — der Hero zeigt „Weitermachen" prominent.
    expect(cfg.widgets.find(w => w.typ === 'meine-antraege')?.sichtbar).toBe(true);
    expect(cfg.widgets.find(w => w.typ === 'weitermachen')?.sichtbar).toBe(false);
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
      .toEqual(['meine-antraege']);
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
    const bewegt = moveInstanz(cfg, 'w-kanban', 'hoch');
    expect(bereichOrder(bewegt, 'haupt')).toEqual(['kanban', 'meine-antraege']);
    // Seiten-Spalte unberührt.
    expect(bereichOrder(bewegt, 'seite')).toEqual(bereichOrder(cfg, 'seite'));
  });

  it('überspringt Widgets der anderen Spalte (Nachbar-Bereich bleibt)', () => {
    // ai-assistent (seite, global hinter kanban) tauscht mit antragseingang
    // (seite), NICHT mit kanban (haupt) — die andere Spalte ändert sich nicht.
    const cfg = defaultHomeWidgetConfig();
    const bewegt = moveInstanz(cfg, 'w-ai-assistent', 'hoch');
    expect(bereichOrder(bewegt, 'seite')).toEqual(['ai-assistent', 'antragseingang', 'notizen']);
    expect(bereichOrder(bewegt, 'haupt')).toEqual(['meine-antraege', 'kanban']);
  });

  it('am Spalten-Anfang/-Ende ein No-op — auch wenn global nicht Rand', () => {
    const cfg = defaultHomeWidgetConfig();
    // meine-antraege ist erstes haupt-Widget.
    expect(moveInstanz(cfg, 'w-meine-antraege', 'hoch')).toBe(cfg);
    // antragseingang ist erstes seite-Widget (global aber an Position 2).
    expect(moveInstanz(cfg, 'w-antragseingang', 'hoch')).toBe(cfg);
    // kanban ist letztes haupt-Widget.
    expect(moveInstanz(cfg, 'w-kanban', 'runter')).toBe(cfg);
    expect(moveInstanz(cfg, 'gibt-es-nicht', 'hoch')).toBe(cfg);
  });

  it('bereich bleibt beim Verschieben unveraendert', () => {
    const cfg = defaultHomeWidgetConfig();
    const bewegt = moveInstanz(cfg, 'w-ai-assistent', 'hoch');
    expect(bewegt.widgets.find(w => w.id === 'w-ai-assistent')!.bereich).toBe('seite');
  });
});

describe('migriereV2NachtlaufAnsEnde (rein)', () => {
  const instanz = (typ: WidgetTyp, position: number): WidgetInstanz => ({
    id: `w-${typ}`, typ, position, bereich: 'haupt',
    sichtbar: true, eingeklappt: false, config: { art: 'keine' },
  });

  it('ohne nachtlauf-Instanz bleibt die Liste identisch (gleiche Referenz)', () => {
    const w = [instanz('meine-antraege', 0), instanz('kanban', 1)];
    expect(migriereV2NachtlaufAnsEnde(w)).toBe(w);
  });

  it('steht sie schon allein am Ende, ändert sich nichts', () => {
    const w = [instanz('meine-antraege', 0), instanz('nachtlauf', 1)];
    expect(migriereV2NachtlaufAnsEnde(w)).toBe(w);
  });

  it('teilt sie die letzte Position mit einem anderen Widget, rückt sie dahinter', () => {
    // Gleichstand ist kein „am Ende": welche Karte zuerst steht, entschiede die
    // Array-Reihenfolge — also eine Zufälligkeit.
    const w = [instanz('nachtlauf', 4), instanz('fristen', 4)];
    const nach = migriereV2NachtlaufAnsEnde(w);
    expect(nach.find(x => x.typ === 'nachtlauf')?.position).toBe(5);
    expect(nach.find(x => x.typ === 'fristen')?.position).toBe(4);
  });

  it('ist idempotent — zweimal angewandt steht dasselbe da', () => {
    const w = [instanz('meine-antraege', 0), instanz('nachtlauf', 1), instanz('fristen', 2)];
    const einmal = migriereV2NachtlaufAnsEnde(w);
    expect(migriereV2NachtlaufAnsEnde(einmal)).toBe(einmal);
  });
});
