/**
 * Zwei Menüs, zwei Zuständigkeiten (v4.40.2): der Rechtsklick meint die SEITE,
 * das `⋯` meint EIN Widget. Bis dahin öffnete der Rechtsklick auf eine Karte das
 * Widget-Menü, und dieses trug „Widgets ▸"/„Darstellung ▸" mit — dieselben
 * seitenweiten Punkte in jeder Karte, dazu ein zweiter Weg zu demselben Menü.
 *
 * Beides ist ohne DOM prüfbar: die Ausnahmeregel ist eine reine Funktion, die
 * Trennung der Einträge eine Quelltext-Regel.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { darfMenueOeffnen } from '../useStartseiteMenue';

function quelle(pfad: string): string {
  return readFileSync(resolve(process.cwd(), pfad), 'utf8');
}

/** Rechtsklick irgendwo auf die freie Fläche, ohne Sonderfall. */
function klick(over: Partial<Parameters<typeof darfMenueOeffnen>[0]> = {}) {
  return darfMenueOeffnen({
    tagName: 'DIV',
    aufWidgetKarte: false,
    istEingabefeld: false,
    hatTextauswahl: false,
    ...over,
  });
}

describe('darfMenueOeffnen — nur die freie Fläche gehört dem Menü', () => {
  it('öffnet auf freier Fläche', () => {
    expect(klick()).toBe(true);
  });

  it('öffnet NICHT auf einer Widget-Karte', () => {
    // Die Aktionen des Widgets hängen am `⋯`; auf der Karte bleibt damit auch
    // das Kopieren aus dem Browser-Menü erreichbar.
    expect(klick({ aufWidgetKarte: true })).toBe(false);
  });

  it('lässt Eingabefeldern und markiertem Text ihr Browser-Menü', () => {
    expect(klick({ istEingabefeld: true })).toBe(false);
    expect(klick({ hatTextauswahl: true })).toBe(false);
    expect(klick({ tagName: 'TEXTAREA' })).toBe(false);
    expect(klick({ tagName: 'INPUT' })).toBe(false);
    expect(klick({ tagName: 'SELECT' })).toBe(false);
  });
});

describe('Das Widget-Menü führt nur widget-eigene Punkte', () => {
  it('kennt weder Untermenü noch dessen Öffner', () => {
    const src = quelle('src/plugins/home/anpassen/WidgetMenue.tsx');
    expect(src).not.toMatch(/oeffneUnter/);
    expect(src).not.toMatch(/untermenue/i);
  });

  it('nennt weder „Widgets" noch „Darstellung" als Eintrag', () => {
    const src = quelle('src/plugins/home/anpassen/WidgetMenue.tsx');
    expect(src).not.toMatch(/label="Widgets"/);
    expect(src).not.toMatch(/label="Darstellung"/);
  });

  it('hält beide Punkte weiterhin im Menü der freien Fläche', () => {
    // Die Gegenprobe: verschwinden sie auch dort, wäre die Anpassung der
    // Startseite nur noch über die Einstellungen erreichbar.
    const src = quelle('src/plugins/home/anpassen/FlaechenMenue.tsx');
    expect(src).toMatch(/label="Widgets"/);
    expect(src).toMatch(/label="Darstellung"/);
  });
});

describe('Der Rechtsklick der Startseite öffnet kein Widget-Menü', () => {
  it('kennt nur das Ziel „Fläche"', () => {
    const src = quelle('src/plugins/home/HomePage.tsx');
    expect(src).toMatch(/oeffneMenue\(\{ art: 'flaeche' \}/);
    expect(src).not.toMatch(/art: 'widget'/);
  });

  it('lässt das `⋯` im Widget-Kopf als einzigen Auslöser stehen', () => {
    const src = quelle('src/plugins/home/anpassen/WidgetMenueKnopf.tsx');
    expect(src).toMatch(/oeffne\(\{ art: 'widget', instanzId \}/);
  });
});
