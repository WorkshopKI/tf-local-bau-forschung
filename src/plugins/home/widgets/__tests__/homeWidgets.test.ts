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
  ENTDECKUNG_WIDGETS,
  HOME_WIDGETS_IDB_KEY,
  MEINE_ANTRAEGE_COLLAPSE_LEGACY_KEY,
  defaultHomeWidgetConfig,
  leseHomeWidgetConfig,
  loadHomeWidgets,
  migriereV2NachtlaufAnsEnde,
  migriereV3NachtlaufConfig,
  migriereV4Entdeckung,
  migriereV5Tagesbrief,
  moveInstanz,
  reconcileVerfuegbareWidgets,
  saveHomeWidgets,
  sichtbareWidgets,
  sortiereInstanzen,
  zurueckgesetzteConfig,
} from '../homeWidgetsStore';
import type { HomeWidgetConfig, WidgetInstanz, WidgetTyp } from '../types';
import { WIDGET_KATALOG } from '../widgetCatalog';
import { SICHTBARKEITS_KATALOG, widgetId } from '@/core/sichtbarkeit';

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

describe('defaultHomeWidgetConfig — v6 (Entdeckung + Tagesbrief)', () => {
  it('bildet Reihenfolge, Bereiche und Sichtbarkeit ab — OHNE weitermachen (Hero-Band)', () => {
    const cfg = defaultHomeWidgetConfig();
    expect(cfg.version).toBe(6);
    const sortiert = sortiereInstanzen(cfg.widgets);
    // weitermachen ist nicht mehr im Default — das Hero-Band ersetzt es.
    expect(sortiert.map(w => w.typ)).toEqual([
      'tagesbrief', 'meine-antraege', 'kanban', 'fristen',
      'antragseingang', 'ai-assistent', 'feedback-news',
      'nachtlauf', 'notizen',
    ]);
    expect(sortiert.some(w => w.typ === 'weitermachen')).toBe(false);
    // Haupt vs. Seite — der Tagesbrief steht am KOPF seiner Spalte (er rankt,
    // was zuerst dran ist; unter fünf Karten beantwortete er die Frage nicht
    // mehr), nachtlauf am Ende (Nachschlage-Karte, nicht Arbeitsliste).
    expect(sortiert.filter(w => w.bereich === 'haupt').map(w => w.typ))
      .toEqual(['tagesbrief', 'meine-antraege', 'kanban', 'fristen', 'nachtlauf']);
    expect(sortiert.filter(w => w.bereich === 'seite').map(w => w.typ))
      .toEqual(['antragseingang', 'ai-assistent', 'feedback-news', 'notizen']);
    // Alles aus ENTDECKUNG_WIDGETS sichtbar; kanban bleibt Opt-in.
    const sichtbarkeit = Object.fromEntries(sortiert.map(w => [w.typ, w.sichtbar]));
    expect(sichtbarkeit).toEqual({
      tagesbrief: true,
      'meine-antraege': true,
      kanban: false,
      fristen: true,
      antragseingang: true,
      'ai-assistent': true,
      'feedback-news': true,
      nachtlauf: true,
      notizen: true,
    });
    // LWW: Default verliert gegen jeden echten Save
    expect(cfg.updatedAt).toBe(new Date(0).toISOString());
  });

  it('nimmt `eingeklappt` aus dem Katalog statt aus einem Literal', () => {
    // Sonst driftete der Auslieferungszustand von `defaultEingeklappt` ab:
    // nachtlauf liest die Journal-Monatsdateien vom Share und startet deshalb zu.
    const cfg = defaultHomeWidgetConfig();
    expect(cfg.widgets.find(w => w.typ === 'nachtlauf')!.eingeklappt).toBe(true);
    expect(cfg.widgets.find(w => w.typ === 'fristen')!.eingeklappt).toBe(false);
  });

  it('uebernimmt den Legacy-Collapse-Seed fuer meine-antraege', () => {
    const cfg = defaultHomeWidgetConfig({ meineAntraegeEingeklappt: true });
    const ma = cfg.widgets.find(w => w.typ === 'meine-antraege')!;
    expect(ma.eingeklappt).toBe(true);
    // Alle anderen folgen dem Katalog — der Seed wirkt nur auf diese eine Karte.
    expect(cfg.widgets.filter(w => w.typ !== 'meine-antraege').every(
      w => w.eingeklappt === (WIDGET_KATALOG[w.typ].defaultEingeklappt ?? false),
    )).toBe(true);
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
    expect(leseHomeWidgetConfig({ version: 7, updatedAt: 'x', widgets: [] })).toBeNull();
    expect(leseHomeWidgetConfig({ version: 0, updatedAt: 'x', widgets: [] })).toBeNull();
  });

  it('liest v6 verbatim (ergänzt nur die Hero-Karten)', () => {
    // `hero` kam mit v4.41 additiv dazu — ein Stand ohne das Feld bekommt beim
    // Lesen den bisherigen Zustand „alles an" (kein Versions-Bump). Ein v6-Stand
    // ist fertig migriert und wird sonst NICHT angefasst: kein Reconcile, keine
    // Einblendung, keine Umstellung. Genau das lässt ein späteres Ausblenden
    // ODER Verschieben halten.
    const gelesen = leseHomeWidgetConfig({ version: 6, updatedAt: 'x', widgets: [] });
    expect(gelesen).toEqual({
      version: 6,
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
    expect(gelesen?.version).toBe(6);
    // Die kaputten sind raus; der v5-Schritt legt danach die fehlenden Typen an.
    expect(gelesen?.widgets.some(w => w.id === 'kaputt')).toBe(false);
    expect(gelesen?.widgets.find(w => w.id === valide.id)).toEqual(valide);
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
    expect(gelesen?.version).toBe(6);
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
    expect(gelesen?.version).toBe(6);
    const nacht = gelesen?.widgets.find(w => w.typ === 'nachtlauf')!;
    // Nur gegen die drei mitgebrachten prüfen: der v5-Schritt hängt danach die
    // fehlenden Katalog-Typen an, die stehen naturgemäß dahinter.
    const andere = gelesen!.widgets.filter(
      w => w.typ === 'meine-antraege' || w.typ === 'fristen',
    );
    expect(andere).toHaveLength(2);
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
    // Geprüft wird die ORDNUNG, nicht die absolute Zahl: nachtlauf bleibt über
    // meine-antraege. Die Zahl selbst verschiebt der v6-Schritt, der den
    // Tagesbrief an den Kopf der Hauptspalte setzt — eine Zusage über sie wäre
    // eine Zusage über etwas, das dieser Test nicht meint.
    const nacht = gelesen!.widgets.find(w => w.typ === 'nachtlauf')!;
    const meine = gelesen!.widgets.find(w => w.typ === 'meine-antraege')!;
    expect(nacht.position).toBeLessThan(meine.position);
  });

  it('v3 → v4: die Nachtlauf-Instanz bekommt ihre Detail-Config', () => {
    // Ohne diesen Schritt bliebe `hatWidgetDetailConfig` für gewachsene Configs
    // false — der Menü-Eintrag „Widget-Einstellungen" erschiene ausgerechnet
    // bei denen nie, die das Widget schon benutzen. `reconcile` hilft nicht: es
    // ergänzt fehlende TYPEN, nicht fehlende FELDER.
    const gelesen = leseHomeWidgetConfig({
      version: 3,
      updatedAt: '2026-01-01T00:00:00.000Z',
      widgets: [{
        id: 'w-nachtlauf', typ: 'nachtlauf', position: 0, bereich: 'haupt',
        sichtbar: true, eingeklappt: true, config: { art: 'keine' },
      }],
    });
    const cfg = gelesen?.widgets[0]?.config;
    expect(cfg?.art).toBe('nachtlauf');
    expect(cfg).toMatchObject({ maxZeilen: 10, rueckblickTage: 0, ausschnitt: 'chip' });
  });

  it('v3 → v4: eine schon eingestellte Instanz bleibt unangetastet', () => {
    const eigen = {
      art: 'nachtlauf', maxZeilen: 3, rueckblickTage: 7, maxKuerzel: 8,
      sortierung: 'label', fusszeilen: false, ausschnitt: 'alle',
    };
    const nach = migriereV3NachtlaufConfig([{
      id: 'w-nachtlauf', typ: 'nachtlauf', position: 0, bereich: 'haupt',
      sichtbar: true, eingeklappt: false, config: eigen,
    } as never]);
    expect(nach[0]?.config).toEqual(eigen);
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
  it('ohne Daten: Default (v5) — weitermachen als Opt-in (sichtbar:false) nachgezogen', async () => {
    const idb = await frischeIdb();
    const cfg = await loadHomeWidgets(idb);
    expect(cfg.version).toBe(6);
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
      // Hier ausgeschaltet, damit der Test die Filter prueft und nicht das
      // Vorgangssystem-Flag der gerade gebauten Variante.
      fristen: { ...WIDGET_KATALOG.fristen, sichtbarWenn: () => false },
      nachtlauf: { ...WIDGET_KATALOG.nachtlauf, sichtbarWenn: () => false },
    };
    expect(sichtbareWidgets(alleSichtbar, 'haupt', katalog).map(w => w.typ))
      .toEqual(['meine-antraege']);
    expect(sichtbareWidgets(alleSichtbar, 'seite', katalog).map(w => w.typ))
      .toEqual(['antragseingang', 'feedback-news', 'notizen']);
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
    expect(seite).toEqual(['notizen', 'antragseingang', 'ai-assistent', 'feedback-news']);
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
    expect(bereichOrder(bewegt, 'haupt')).toEqual(['tagesbrief', 'kanban', 'meine-antraege', 'fristen', 'nachtlauf']);
    // Seiten-Spalte unberührt.
    expect(bereichOrder(bewegt, 'seite')).toEqual(bereichOrder(cfg, 'seite'));
  });

  it('überspringt Widgets der anderen Spalte (Nachbar-Bereich bleibt)', () => {
    // ai-assistent (seite, global hinter kanban) tauscht mit antragseingang
    // (seite), NICHT mit kanban (haupt) — die andere Spalte ändert sich nicht.
    const cfg = defaultHomeWidgetConfig();
    const bewegt = moveInstanz(cfg, 'w-ai-assistent', 'hoch');
    expect(bereichOrder(bewegt, 'seite'))
      .toEqual(['ai-assistent', 'antragseingang', 'feedback-news', 'notizen']);
    expect(bereichOrder(bewegt, 'haupt'))
      .toEqual(['tagesbrief', 'meine-antraege', 'kanban', 'fristen', 'nachtlauf']);
  });

  it('am Spalten-Anfang/-Ende ein No-op — auch wenn global nicht Rand', () => {
    const cfg = defaultHomeWidgetConfig();
    // tagesbrief ist erstes haupt-Widget.
    expect(moveInstanz(cfg, 'w-tagesbrief', 'hoch')).toBe(cfg);
    // antragseingang ist erstes seite-Widget (global aber an Position 2).
    expect(moveInstanz(cfg, 'w-antragseingang', 'hoch')).toBe(cfg);
    // nachtlauf ist letztes haupt-Widget, notizen letztes seite-Widget.
    expect(moveInstanz(cfg, 'w-nachtlauf', 'runter')).toBe(cfg);
    expect(moveInstanz(cfg, 'w-notizen', 'runter')).toBe(cfg);
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

describe('migriereV4Entdeckung (rein) — einmalig einblenden, nie ausblenden', () => {
  /** Ein gewachsener v4-Stand: alles da, aber die Entdeckungs-Karten sind aus. */
  function bestand(over: Partial<HomeWidgetConfig> = {}): HomeWidgetConfig {
    const cfg = reconcileVerfuegbareWidgets(defaultHomeWidgetConfig());
    return {
      ...cfg,
      widgets: cfg.widgets.map(w =>
        (ENTDECKUNG_WIDGETS as string[]).includes(w.typ) ? { ...w, sichtbar: false } : w),
      ...over,
    };
  }

  it('blendet genau die Karten aus ENTDECKUNG_WIDGETS ein', () => {
    const nach = migriereV4Entdeckung(bestand());
    for (const typ of ENTDECKUNG_WIDGETS) {
      expect(nach.widgets.find(w => w.typ === typ)?.sichtbar).toBe(true);
    }
  });

  it('legt fehlende Instanzen selbst an — ein Stand von vor `fristen`', () => {
    // Der Reconcile-Schritt in loadHomeWidgets kommt DANACH und legte sie als
    // `sichtbar: false` an; ein blosses Umlegen des Haekchens faende hier nichts.
    const alt: HomeWidgetConfig = {
      version: 6,
      updatedAt: '2026-01-01T00:00:00.000Z',
      hero: { sichtbar: { resume: true, alert: true }, chips: { kritisch: true, warnung: true, qs: true } },
      widgets: [{
        id: 'w-meine-antraege', typ: 'meine-antraege', position: 0, bereich: 'haupt',
        sichtbar: true, eingeklappt: false, config: { art: 'keine' },
      }],
    };
    const nach = migriereV4Entdeckung(alt);
    expect(nach.widgets.find(w => w.typ === 'fristen')?.sichtbar).toBe(true);
    expect(nach.widgets.find(w => w.typ === 'feedback-news')?.sichtbar).toBe(true);
  });

  it('blendet NICHTS aus — was sichtbar war, bleibt sichtbar', () => {
    const vorher = bestand();
    const mitKanban: HomeWidgetConfig = {
      ...vorher,
      widgets: vorher.widgets.map(w => (w.typ === 'kanban' ? { ...w, sichtbar: true } : w)),
    };
    const nach = migriereV4Entdeckung(mitKanban);
    expect(nach.widgets.find(w => w.typ === 'kanban')?.sichtbar).toBe(true);
    // Und was aus war und nicht dazugehoert, bleibt aus.
    expect(nach.widgets.find(w => w.typ === 'auslastung')?.sichtbar).toBe(false);
  });

  it('laesst Position und Einklapp-Zustand in Ruhe', () => {
    const vorher = bestand();
    const nach = migriereV4Entdeckung(vorher);
    for (const w of vorher.widgets) {
      const danach = nach.widgets.find(x => x.id === w.id)!;
      expect(danach.position).toBe(w.position);
      expect(danach.eingeklappt).toBe(w.eingeklappt);
    }
    // nachtlauf erscheint damit eingeklappt, wie sein Katalog-Eintrag es will.
    expect(nach.widgets.find(w => w.typ === 'nachtlauf')?.eingeklappt).toBe(true);
  });

  it('holt die Alert-Karte zurueck — samt Kacheln, wenn alle abgewaehlt waren', () => {
    // Sonst kaeme eine Karte wieder, die nichts anzuzeigen haette.
    const nach = migriereV4Entdeckung(bestand({
      hero: {
        sichtbar: { resume: true, alert: false },
        chips: { kritisch: false, warnung: false, qs: false },
      },
    }));
    expect(nach.hero.sichtbar.alert).toBe(true);
    expect(nach.hero.chips).toEqual({ kritisch: true, warnung: true, qs: true });
  });

  it('laesst eine bewusst abgewaehlte Resume-Karte aus', () => {
    const nach = migriereV4Entdeckung(bestand({
      hero: {
        sichtbar: { resume: false, alert: false },
        chips: { kritisch: true, warnung: true, qs: true },
      },
    }));
    expect(nach.hero.sichtbar.resume).toBe(false);
  });

  it('ist idempotent und ohne Aenderung referenzgleich', () => {
    const einmal = migriereV4Entdeckung(bestand());
    expect(migriereV4Entdeckung(einmal)).toBe(einmal);
  });

  it('greift genau einmal: ein persistierter v6-Stand wird nicht mehr angefasst', () => {
    // Das ist das Gedaechtnis: wer eine Karte ausblendet, loest ein `mutiere`
    // aus, das v6 stempelt — danach haelt das Ausblenden.
    const ausgeblendet = {
      version: 6,
      updatedAt: '2026-01-01T00:00:00.000Z',
      hero: { sichtbar: { resume: true, alert: true }, chips: { kritisch: true, warnung: true, qs: true } },
      widgets: [{
        id: 'w-notizen', typ: 'notizen', position: 0, bereich: 'seite',
        sichtbar: false, eingeklappt: false, config: { art: 'notizen' },
      }],
    };
    const gelesen = leseHomeWidgetConfig(ausgeblendet);
    expect(gelesen?.widgets.find(w => w.typ === 'notizen')?.sichtbar).toBe(false);
    expect(gelesen?.widgets).toHaveLength(1);
  });
});

describe('migriereV5Tagesbrief (rein) — einmalig einblenden UND an den Kopf', () => {
  /** Ein gewachsener v5-Stand: Hauptspalte belegt, Seitenspalte daneben. */
  function bestandV5(): HomeWidgetConfig {
    const instanz = (typ: WidgetTyp, position: number, bereich: 'haupt' | 'seite'): WidgetInstanz => ({
      id: `w-${typ}`, typ, position, bereich,
      sichtbar: true, eingeklappt: false, config: { art: 'keine' },
    });
    return {
      version: 6,
      updatedAt: '2026-01-01T00:00:00.000Z',
      hero: { sichtbar: { resume: true, alert: true }, chips: { kritisch: true, warnung: true, qs: true } },
      widgets: [
        instanz('meine-antraege', 0, 'haupt'),
        instanz('fristen', 1, 'haupt'),
        instanz('antragseingang', 2, 'seite'),
        instanz('notizen', 3, 'seite'),
      ],
    };
  }

  const haupt = (c: HomeWidgetConfig): WidgetTyp[] =>
    sortiereInstanzen(c.widgets).filter(w => w.bereich === 'haupt').map(w => w.typ);
  const seite = (c: HomeWidgetConfig): WidgetTyp[] =>
    sortiereInstanzen(c.widgets).filter(w => w.bereich === 'seite').map(w => w.typ);

  it('legt die fehlende Instanz selbst an und blendet sie ein', () => {
    // Erst anlegen, dann einblenden: ein Stand von vor dem Tagesbrief trägt für
    // den Typ gar keine Instanz, und der Reconcile in loadHomeWidgets käme
    // danach und legte sie als `sichtbar: false` an.
    const nach = migriereV5Tagesbrief(bestandV5());
    expect(nach.widgets.find(w => w.typ === 'tagesbrief')?.sichtbar).toBe(true);
  });

  it('setzt ihn an den KOPF der Hauptspalte — die begründete Ausnahme', () => {
    const nach = migriereV5Tagesbrief(bestandV5());
    expect(haupt(nach)[0]).toBe('tagesbrief');
    // Die vorhandene Ordnung bleibt, sie rückt nur nach. (Der Reconcile hängt
    // die übrigen Katalog-Typen als Opt-in HINTEN an — deshalb ein Vergleich
    // der bekannten Karten, kein Vergleich der ganzen Liste.)
    const bekannt = haupt(nach).filter(t => t === 'meine-antraege' || t === 'fristen');
    expect(bekannt).toEqual(['meine-antraege', 'fristen']);
  });

  it('lässt die Ordnung der Seitenspalte in Ruhe', () => {
    const vorher = bestandV5();
    const nach = migriereV5Tagesbrief(vorher);
    // Nur die HAUPTspalte rückt nach; die vorhandenen Seiten-Karten behalten
    // ihre Reihenfolge (der Reconcile ergänzt dort ebenfalls Opt-in-Instanzen).
    const vorhanden = new Set(seite(vorher));
    expect(seite(nach).filter(t => vorhanden.has(t))).toEqual(seite(vorher));
  });

  it('ist idempotent — ein zweiter Lauf schiebt nicht weiter', () => {
    const einmal = migriereV5Tagesbrief(bestandV5());
    const zweimal = migriereV5Tagesbrief(einmal);
    expect(haupt(zweimal)).toEqual(haupt(einmal));
    expect(zweimal).toBe(einmal);
  });

  it('kein Pin: wer ihn wegschiebt, behält seine Anordnung', () => {
    // Nach der ersten echten Änderung stempelt `mutiere` v6, und `leseHomeWidgetConfig`
    // ruft diesen Schritt gar nicht mehr. Direkt aufgerufen darf er eine bereits
    // eingeblendete, tiefer stehende Karte zwar wieder hochholen — der
    // Versions-Stempel ist das Gedächtnis, nicht diese Funktion.
    const einmal = migriereV5Tagesbrief(bestandV5());
    const verschoben = leseHomeWidgetConfig({ ...einmal, version: 6, widgets: einmal.widgets.map(
      w => (w.typ === 'tagesbrief' ? { ...w, position: 99 } : w),
    ) });
    const ordnung = haupt(verschoben!);
    expect(ordnung[ordnung.length - 1]).toBe('tagesbrief');
  });
});

describe('entdeckung-default-deckungsgleich', () => {
  it('der Auslieferungszustand zeigt jede Karte, die die Migration einblendet', () => {
    // Zwei Wege zum selben Bild: der Default eines frischen Geraets (und damit
    // „Startseite zuruecksetzen") und die einmalige Einblendung. Liefen sie
    // auseinander, faende ein neuer Nutzer genau die Karten nicht, um die es geht.
    const frisch = zurueckgesetzteConfig();
    for (const typ of ENTDECKUNG_WIDGETS) {
      expect(frisch.widgets.find(w => w.typ === typ)?.sichtbar).toBe(true);
    }
    expect(frisch.hero.sichtbar.alert).toBe(true);
  });
});

describe('entdeckung-ohne-marke', () => {
  it('keine Karte aus ENTDECKUNG_WIDGETS trägt eine Beta-/Experten-Marke', () => {
    // Der gemessene v6.19-Fall: `fristen` und `nachtlauf` standen in
    // ENTDECKUNG_WIDGETS UND trugen BETA. Das Häkchen stand damit an,
    // `widgetAnzeigbar` verwarf die Karte trotzdem — und zwar bei genau dem
    // Nutzer, der sie entdecken sollte (4 von 6 Karten kamen an). Eine Marke
    // legt die Selbst-Einblendung still; wer eine Karte hier aufnimmt, prüft
    // sie mit. Das erledigt ab v6.45 dieser Guard statt eines Doc-Satzes.
    const markiert = ENTDECKUNG_WIDGETS.filter(typ => {
      const eintrag = SICHTBARKEITS_KATALOG.find(e => e.id === widgetId(typ));
      return eintrag?.marken.beta === true || eintrag?.marken.experte === true;
    });
    expect(
      markiert,
      `Karten in ENTDECKUNG_WIDGETS mit Beta-/Experten-Marke (die Einblendung wäre stillgelegt):\n${markiert.join('\n')}`,
    ).toEqual([]);
  });
});
