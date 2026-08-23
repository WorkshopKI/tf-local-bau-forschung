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
import {
  RUECKGAENGIG_MS, stelleSichtbarkeitHer, useRueckgaengigStore,
} from '../../anpassen/rueckgaengigStore';

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
    // Der Ausgangszustand muss dem GEGENTEIL dessen entsprechen, was der
    // Schalter setzt — sonst bewiese ein „steht auf false" nur, dass es schon
    // vorher so war. Seit v5 sind die Entdeckungs-Karten (u.a. `notizen`) im
    // Default sichtbar, deshalb hier ausdrücklich ausgeblendet.
    const aus: HomeWidgetConfig = {
      ...basis(),
      widgets: basis().widgets.map(w =>
        (w.typ === 'kanban' || w.typ === 'notizen') ? { ...w, sichtbar: false } : w),
    };
    const katalog = {
      ...WIDGET_KATALOG,
      kanban: { ...WIDGET_KATALOG.kanban, sichtbarWenn: () => false },
      notizen: { ...WIDGET_KATALOG.notizen, verfuegbar: false },
    };
    const nachher = setzeSichtbarkeitBereich(
      setzeSichtbarkeitBereich(aus, 'haupt', true, katalog), 'seite', true, katalog,
    );
    expect(nachher.widgets.find(w => w.typ === 'kanban')!.sichtbar).toBe(false);
    expect(nachher.widgets.find(w => w.typ === 'notizen')!.sichtbar).toBe(false);
    // Gegenprobe: ein Typ, den die Variante kennt, wurde sehr wohl geschaltet.
    expect(nachher.widgets.find(w => w.typ === 'ai-assistent')!.sichtbar).toBe(true);
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

/**
 * **„Rückgängig" nimmt zurück, wovon die Leiste spricht — und nicht mehr**
 * (v4.131).
 *
 * Bis dahin hielt der Eintrag den kompletten Config-Stand von vor der Aktion und
 * schrieb ihn zurück. Wer ein Widget ausblendete und danach ein anderes
 * einklappte, verlor beim Klick auch das Einklappen: gemessen sprang der
 * Antragseingang von 52 px zurück auf 201 px, während die Leiste nur vom
 * ausgeblendeten QS-Widget sprach. Einklappen legt bewusst keinen eigenen
 * Eintrag an (Handoff §2.4) und war damit nicht wiederherstellbar — ein Lost
 * Update, das nichts ankündigte.
 */
describe('stelleSichtbarkeitHer — nur die eigene Änderung zurückdrehen', () => {
  it('holt genau die genannte Instanz zurück und lässt den Rest stehen', () => {
    const vorher = basis();
    const einId = vorher.widgets.find(w => w.typ === 'meine-antraege')!.id;
    const andereId = vorher.widgets.find(w => w.typ === 'notizen')!.id;
    // Nach dem Ausblenden klappt der Nutzer ein ANDERES Widget ein.
    const inzwischen: HomeWidgetConfig = {
      ...vorher,
      widgets: vorher.widgets.map(w => {
        if (w.id === einId) return { ...w, sichtbar: false };
        if (w.id === andereId) return { ...w, eingeklappt: true };
        return w;
      }),
    };
    const zurueck = stelleSichtbarkeitHer(new Map([[einId, true]]))(inzwischen);
    expect(zurueck.widgets.find(w => w.id === einId)?.sichtbar).toBe(true);
    // Das zwischenzeitliche Einklappen überlebt.
    expect(zurueck.widgets.find(w => w.id === andereId)?.eingeklappt).toBe(true);
  });

  it('stellt die Häkchen einer ganzen Spalte in ihrem alten Zustand her', () => {
    const vorher = basis();
    const seite = vorher.widgets.filter(w => w.bereich === 'seite');
    const alterStand = new Map(seite.map(w => [w.id, w.sichtbar]));
    const geraeumt = setzeSichtbarkeitBereich(vorher, 'seite', false);
    const zurueck = stelleSichtbarkeitHer(alterStand)(geraeumt);
    for (const w of seite) {
      expect(zurueck.widgets.find(x => x.id === w.id)?.sichtbar).toBe(w.sichtbar);
    }
  });

  it('ist ein No-op für Instanzen, die die Aktion nie angefasst hat', () => {
    const vorher = basis();
    const zurueck = stelleSichtbarkeitHer(new Map())(vorher);
    expect(zurueck.widgets).toEqual(vorher.widgets);
  });
});

/**
 * Die Reue-Frist hängt an einem Zeitstempel, nicht an der Lebensdauer der
 * Leiste. Vorher räumte der Cleanup den Timer ab, sobald man die Startseite
 * verließ — der Eintrag blieb im Modul-Store, und bei der Rückkehr stand die
 * Leiste wieder da und bot einen beliebig alten Stand an (gemessen).
 */
describe('Rückgängig-Eintrag trägt seinen Zeitstempel', () => {
  it('merkt `seit` und verwirft ohne Umkehrung', () => {
    const store = useRueckgaengigStore;
    store.getState().leere();
    store.getState().merke('nichts', null);
    expect(store.getState().eintrag).toBeNull();

    const vorher = Date.now();
    store.getState().merke('etwas', cfg => cfg);
    const eintrag = store.getState().eintrag;
    expect(eintrag?.text).toBe('etwas');
    expect(eintrag!.seit).toBeGreaterThanOrEqual(vorher);
    expect(RUECKGAENGIG_MS).toBeGreaterThan(0);
    store.getState().leere();
  });
});
