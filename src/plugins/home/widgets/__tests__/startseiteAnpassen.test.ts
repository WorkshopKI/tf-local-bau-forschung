/**
 * Tests der reinen Config-Operationen hinter dem Startseiten-Menü (v4.6):
 * „Alles einklappen", der „alle"-Schalter je Spalte und „Startseite
 * zurücksetzen". Alle drei sind rein — das Menü selbst ruft nur durch.
 */
import { describe, expect, it } from 'vitest';
import {
  defaultHomeWidgetConfig,
  leseHeroConfig,
  leseHomeWidgetConfig,
  reconcileVerfuegbareWidgets,
  setzeAlleEingeklappt,
  setzeHeroChip,
  setzeHeroKarte,
  setzeSichtbarkeitBereich,
  sichtbareWidgets,
  zurueckgesetzteConfig,
} from '../homeWidgetsStore';
import { HERO_CONFIG_DEFAULT, type HomeWidgetConfig } from '../types';
import { WIDGET_KATALOG } from '../widgetCatalog';

/** Default + nachgezogene Opt-in-Instanzen = der Stand, den die Homepage sieht. */
function basis(): HomeWidgetConfig {
  return reconcileVerfuegbareWidgets(defaultHomeWidgetConfig());
}

describe('setzeAlleEingeklappt — nur die sichtbaren Widgets', () => {
  it('klappt beide Spalten zu, ohne die ausgeblendeten anzufassen', () => {
    const vorher = basis();
    const sichtbareIds = new Set([
      ...sichtbareWidgets(vorher, 'haupt').map(w => w.id),
      ...sichtbareWidgets(vorher, 'seite').map(w => w.id),
    ]);
    expect(sichtbareIds.size).toBeGreaterThan(1);

    const nachher = setzeAlleEingeklappt(vorher, true);
    for (const w of nachher.widgets) {
      const alt = vorher.widgets.find(v => v.id === w.id)!;
      // Sichtbare sind zu; alles andere steht exakt wie vorher.
      expect(w.eingeklappt).toBe(sichtbareIds.has(w.id) ? true : alt.eingeklappt);
    }
  });

  it('klappt genauso wieder auf', () => {
    const zu = setzeAlleEingeklappt(basis(), true);
    const auf = setzeAlleEingeklappt(zu, false);
    for (const w of sichtbareWidgets(auf, 'haupt')) expect(w.eingeklappt).toBe(false);
    for (const w of sichtbareWidgets(auf, 'seite')) expect(w.eingeklappt).toBe(false);
  });

  it('ist idempotent — ein zweiter Aufruf gibt dieselbe Referenz zurück', () => {
    const zu = setzeAlleEingeklappt(basis(), true);
    expect(setzeAlleEingeklappt(zu, true)).toBe(zu);
  });

  it('fasst flag-versteckte Typen nicht an', () => {
    const vorher: HomeWidgetConfig = {
      ...basis(),
      widgets: basis().widgets.map(w =>
        w.typ === 'meine-antraege' ? { ...w, sichtbar: true, eingeklappt: false } : w,
      ),
    };
    const katalog = {
      ...WIDGET_KATALOG,
      'meine-antraege': { ...WIDGET_KATALOG['meine-antraege'], sichtbarWenn: () => false },
    };
    const nachher = setzeAlleEingeklappt(vorher, true, katalog);
    expect(nachher.widgets.find(w => w.typ === 'meine-antraege')!.eingeklappt).toBe(false);
  });
});

describe('setzeSichtbarkeitBereich — der „alle"-Schalter einer Spalte', () => {
  it('schaltet nur die eigene Spalte, die andere bleibt Wort für Wort gleich', () => {
    const vorher = basis();
    const nachher = setzeSichtbarkeitBereich(vorher, 'haupt', true);
    // Alles, was der Katalog in dieser Variante überhaupt zeigt, steht danach an.
    const anzeigbar = vorher.widgets.filter(w =>
      w.bereich === 'haupt'
      && WIDGET_KATALOG[w.typ].verfuegbar && WIDGET_KATALOG[w.typ].sichtbarWenn());
    expect(anzeigbar.length).toBeGreaterThan(1);
    for (const w of anzeigbar) {
      expect(nachher.widgets.find(n => n.id === w.id)!.sichtbar).toBe(true);
    }
    expect(nachher.widgets.filter(w => w.bereich === 'seite'))
      .toEqual(vorher.widgets.filter(w => w.bereich === 'seite'));
  });

  it('blendet eine ganze Spalte aus', () => {
    const nachher = setzeSichtbarkeitBereich(basis(), 'seite', false);
    expect(sichtbareWidgets(nachher, 'seite')).toEqual([]);
    expect(sichtbareWidgets(nachher, 'haupt').length).toBeGreaterThan(0);
  });

  it('lässt Typen unberührt, die diese Variante gar nicht kennt', () => {
    const katalog = {
      ...WIDGET_KATALOG,
      kanban: { ...WIDGET_KATALOG.kanban, sichtbarWenn: () => false },
      notizen: { ...WIDGET_KATALOG.notizen, verfuegbar: false },
    };
    const nachher = setzeSichtbarkeitBereich(
      setzeSichtbarkeitBereich(basis(), 'haupt', true, katalog), 'seite', true, katalog,
    );
    expect(nachher.widgets.find(w => w.typ === 'kanban')!.sichtbar).toBe(false);
    expect(nachher.widgets.find(w => w.typ === 'notizen')!.sichtbar).toBe(false);
  });

  it('ist idempotent — ein zweiter Aufruf gibt dieselbe Referenz zurück', () => {
    const aus = setzeSichtbarkeitBereich(basis(), 'haupt', false);
    expect(setzeSichtbarkeitBereich(aus, 'haupt', false)).toBe(aus);
  });
});

describe('Hero-Karten — die zwei festen Karten über den Spalten (v4.41)', () => {
  it('liest einen Bestands-Stand ohne `hero`-Feld als „alles an"', () => {
    // Additiv statt versioniert: wer die App vorher nutzte, sieht danach exakt
    // dasselbe Band.
    expect(leseHeroConfig(undefined)).toEqual(HERO_CONFIG_DEFAULT);
    const alt = leseHomeWidgetConfig({
      version: 2, updatedAt: '2026-01-01T00:00:00.000Z', widgets: [],
    });
    expect(alt?.hero).toEqual(HERO_CONFIG_DEFAULT);
  });

  it('nimmt jeden einzelnen gesetzten Wert und rät den Rest auf „an"', () => {
    expect(leseHeroConfig({ sichtbar: { alert: false }, chips: { qs: false } })).toEqual({
      sichtbar: { resume: true, alert: false },
      chips: { kritisch: true, warnung: true, qs: false },
    });
  });

  it('überlebt kaputte Werte, statt die ganze Config zu verwerfen', () => {
    expect(leseHeroConfig({ sichtbar: 'ja', chips: 7 })).toEqual(HERO_CONFIG_DEFAULT);
  });

  it('blendet eine Karte aus, ohne die andere oder die Widgets anzufassen', () => {
    const vorher = basis();
    const nachher = setzeHeroKarte(vorher, 'resume', false);
    expect(nachher.hero.sichtbar).toEqual({ resume: false, alert: true });
    expect(nachher.hero.chips).toEqual(HERO_CONFIG_DEFAULT.chips);
    // Referenzgleich: die Karten-Wahl rührt die Widget-Liste nicht an.
    expect(nachher.widgets).toBe(vorher.widgets);
  });

  it('wählt eine Kachel ab, ohne die anderen anzufassen', () => {
    const nachher = setzeHeroChip(basis(), 'qs', false);
    expect(nachher.hero.chips).toEqual({ kritisch: true, warnung: true, qs: false });
    expect(nachher.hero.sichtbar).toEqual(HERO_CONFIG_DEFAULT.sichtbar);
  });

  it('schaltet die Karte AUS, wenn die letzte Kachel fällt', () => {
    // Sonst wäre es eine Einbahnstraße: die Karte verschwindet (nichts zu
    // zeigen), ihr `⋯` mit ihr — und die Liste „Oben" führte sie weiter als an.
    let cfg = basis();
    for (const chip of ['kritisch', 'warnung', 'qs'] as const) cfg = setzeHeroChip(cfg, chip, false);
    expect(cfg.hero.sichtbar.alert).toBe(false);
    expect(cfg.hero.sichtbar.resume).toBe(true);
  });

  it('holt beim Wiedereinschalten die Kacheln zurück', () => {
    let cfg = basis();
    for (const chip of ['kritisch', 'warnung', 'qs'] as const) cfg = setzeHeroChip(cfg, chip, false);
    const zurueck = setzeHeroKarte(cfg, 'alert', true);
    expect(zurueck.hero.chips).toEqual(HERO_CONFIG_DEFAULT.chips);
  });

  it('lässt die Kacheln in Ruhe, wenn noch eine steht', () => {
    const eine = setzeHeroChip(setzeHeroChip(basis(), 'kritisch', false), 'qs', false);
    expect(eine.hero.sichtbar.alert).toBe(true);
    const ausUndAn = setzeHeroKarte(setzeHeroKarte(eine, 'alert', false), 'alert', true);
    expect(ausUndAn.hero.chips).toEqual({ kritisch: false, warnung: true, qs: false });
  });

  it('ist idempotent — ein zweiter Aufruf gibt dieselbe Referenz zurück', () => {
    const aus = setzeHeroKarte(basis(), 'alert', false);
    expect(setzeHeroKarte(aus, 'alert', false)).toBe(aus);
    const ohneQs = setzeHeroChip(basis(), 'qs', false);
    expect(setzeHeroChip(ohneQs, 'qs', false)).toBe(ohneQs);
  });

  it('kommt beim Zurücksetzen zurück', () => {
    expect(zurueckgesetzteConfig().hero).toEqual(HERO_CONFIG_DEFAULT);
  });
});

describe('zurueckgesetzteConfig — „zurückgesetzt" = „nie angefasst"', () => {
  it('ist exakt der Stand eines frischen Geräts', () => {
    expect(zurueckgesetzteConfig()).toEqual(reconcileVerfuegbareWidgets(defaultHomeWidgetConfig()));
  });

  it('hebt jede Anpassung auf — auch eine leergeräumte Seitenspalte', () => {
    const verstellt = setzeAlleEingeklappt(
      setzeSichtbarkeitBereich(basis(), 'seite', false), true,
    );
    expect(sichtbareWidgets(verstellt, 'seite')).toEqual([]);
    const zurueck = zurueckgesetzteConfig();
    expect(sichtbareWidgets(zurueck, 'seite').map(w => w.typ))
      .toEqual(sichtbareWidgets(basis(), 'seite').map(w => w.typ));
    expect(zurueck.widgets.every(w => !w.eingeklappt || WIDGET_KATALOG[w.typ].defaultEingeklappt))
      .toBe(true);
  });
});
