/**
 * Zwei Menüs, zwei Zuständigkeiten (v4.40.2, erweitert v4.41): der Rechtsklick
 * meint die SEITE, das `⋯` meint EINE Karte — ein Widget oder eine der beiden
 * festen Karten des Hero-Bandes. Bis v4.40.1 öffnete der Rechtsklick auf eine
 * Karte das Widget-Menü, und dieses trug „Widgets ▸"/„Darstellung ▸" mit —
 * dieselben seitenweiten Punkte in jeder Karte, dazu ein zweiter Weg zu
 * demselben Menü.
 *
 * Beides ist ohne DOM prüfbar: die Ausnahmeregel ist eine reine Funktion, die
 * Trennung der Einträge eine Quelltext-Regel.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { darfMenueOeffnen, zielGleich } from '../useStartseiteMenue';

function quelle(pfad: string): string {
  return readFileSync(resolve(process.cwd(), pfad), 'utf8');
}

/** Rechtsklick irgendwo auf die freie Fläche, ohne Sonderfall. */
function klick(over: Partial<Parameters<typeof darfMenueOeffnen>[0]> = {}) {
  return darfMenueOeffnen({
    tagName: 'DIV',
    aufKarte: false,
    istEingabefeld: false,
    hatTextauswahl: false,
    mitUmschalt: false,
    ...over,
  });
}

describe('darfMenueOeffnen — nur die freie Fläche gehört dem Menü', () => {
  it('öffnet auf freier Fläche', () => {
    expect(klick()).toBe(true);
  });

  it('öffnet NICHT auf einer Karte', () => {
    // Gilt für Widget- wie Hero-Karten: ihre Aktionen hängen am `⋯`.
    expect(klick({ aufKarte: true })).toBe(false);
  });

  it('lässt Eingabefeldern und markiertem Text ihr Browser-Menü', () => {
    expect(klick({ istEingabefeld: true })).toBe(false);
    expect(klick({ hatTextauswahl: true })).toBe(false);
    expect(klick({ tagName: 'TEXTAREA' })).toBe(false);
    expect(klick({ tagName: 'INPUT' })).toBe(false);
    expect(klick({ tagName: 'SELECT' })).toBe(false);
  });

  it('tritt bei gedrückter Umschalt-Taste zurück', () => {
    // Derselbe Notausgang wie app-weit (`zeigtBrowserMenue`) — sonst hätte er
    // ausgerechnet dort ein Loch, wo die App ein eigenes Menü führt.
    expect(klick({ mitUmschalt: true })).toBe(false);
  });

  it('erkennt beide Karten-Marker im Aufrufer', () => {
    const src = quelle('src/plugins/home/HomePage.tsx');
    expect(src).toMatch(/closest\('\[data-widget-id\], \[data-hero-karte\]'\)/);
  });
});

describe('zielGleich — welcher `⋯`-Knopf zeigt sich als offen', () => {
  it('trennt die Widget-Instanzen', () => {
    expect(zielGleich({ art: 'widget', instanzId: 'a' }, { art: 'widget', instanzId: 'a' })).toBe(true);
    expect(zielGleich({ art: 'widget', instanzId: 'a' }, { art: 'widget', instanzId: 'b' })).toBe(false);
  });

  it('trennt die beiden Hero-Karten', () => {
    expect(zielGleich({ art: 'hero', karte: 'resume' }, { art: 'hero', karte: 'resume' })).toBe(true);
    expect(zielGleich({ art: 'hero', karte: 'resume' }, { art: 'hero', karte: 'alert' })).toBe(false);
  });

  it('trennt die Arten und kennt „nichts offen"', () => {
    expect(zielGleich({ art: 'flaeche' }, { art: 'hero', karte: 'alert' })).toBe(false);
    expect(zielGleich(undefined, { art: 'flaeche' })).toBe(false);
    expect(zielGleich({ art: 'flaeche' }, { art: 'flaeche' })).toBe(true);
  });
});

describe('Ein Karten-Menü führt nur karten-eigene Punkte', () => {
  for (const datei of ['WidgetMenue.tsx', 'HeroMenue.tsx']) {
    it(`${datei} kennt weder Untermenü noch dessen Öffner`, () => {
      const src = quelle(`src/plugins/home/anpassen/${datei}`);
      expect(src).not.toMatch(/oeffneUnter/);
      expect(src).not.toMatch(/untermenue/i);
    });

    it(`${datei} nennt weder „Widgets" noch „Darstellung" als Eintrag`, () => {
      const src = quelle(`src/plugins/home/anpassen/${datei}`);
      expect(src).not.toMatch(/label="Widgets"/);
      expect(src).not.toMatch(/label="Darstellung"/);
    });
  }

  it('hält beide Punkte weiterhin im Menü der freien Fläche', () => {
    // Die Gegenprobe: verschwinden sie auch dort, wäre die Anpassung der
    // Startseite nur noch über die Einstellungen erreichbar.
    const src = quelle('src/plugins/home/anpassen/FlaechenMenue.tsx');
    expect(src).toMatch(/label="Widgets"/);
    expect(src).toMatch(/label="Darstellung"/);
  });

  it('nennt im Hero-Menü keine Widget-Punkte (Position, Einklappen)', () => {
    // Die Hero-Karten haben weder Position noch Collapse — stünden die Punkte
    // dort, versprächen sie etwas, das es nicht gibt. Geprüft an den LABELN,
    // nicht am Fließtext: der Kopfkommentar begründet ja genau diese Lücke.
    const src = quelle('src/plugins/home/anpassen/HeroMenue.tsx');
    expect(src).not.toMatch(/label="Nach (oben|unten)"/);
    expect(src).not.toMatch(/label=[{"][^\n]*[Ee]inklappen/);
  });
});

describe('Der Rechtsklick der Startseite öffnet kein Karten-Menü', () => {
  it('kennt nur das Ziel „Fläche"', () => {
    const src = quelle('src/plugins/home/HomePage.tsx');
    expect(src).toMatch(/oeffneMenue\(\{ art: 'flaeche' \}/);
    expect(src).not.toMatch(/art: 'widget'/);
    expect(src).not.toMatch(/art: 'hero'/);
  });

  it('lässt das `⋯` im Karten-Kopf als einzigen Auslöser stehen', () => {
    const src = quelle('src/plugins/home/anpassen/KartenMenueKnopf.tsx');
    expect(src).toMatch(/oeffne\(ziel, punktUnter\(knopf\.current\)\)/);
  });

  it('gibt beiden Hero-Karten Marker und Menüknopf', () => {
    const src = quelle('src/plugins/home/HomeHero.tsx');
    expect(src).toMatch(/data-hero-karte="resume"/);
    expect(src).toMatch(/data-hero-karte="alert"/);
    expect(src).toMatch(/ziel=\{\{ art: 'hero', karte: 'resume' \}\}/);
    expect(src).toMatch(/ziel=\{\{ art: 'hero', karte: 'alert' \}\}/);
  });

  it('hält den Rückweg für ausgeblendete Hero-Karten im Widgets-Untermenü', () => {
    // Ohne diese Gruppe wäre „Ausblenden" eine Einbahnstraße: das `⋯` der Karte
    // verschwindet mit ihr.
    const src = quelle('src/plugins/home/anpassen/WidgetsUntermenue.tsx');
    expect(src).toMatch(/setHeroKarte/);
    expect(src).toMatch(/HERO_KARTEN/);
  });
});
