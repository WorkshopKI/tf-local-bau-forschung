/**
 * Der Renderer der erklärten Trigger-Sätze.
 *
 * Gerendert wird über `renderToStaticMarkup`, aufgebaut mit `createElement` statt
 * JSX: die Suite ist node-only und nimmt bewusst nur `*.test.ts` — eine
 * Komponenten-Test-Umgebung (jsdom, Testing-Library) gibt es im Projekt nicht,
 * und für die beiden Zusagen, die zählen, braucht es sie auch nicht:
 *
 * 1. **Der Satz bleibt der Satz.** Die Auszeichnung fügt kein Zeichen hinzu und
 *    lässt keines weg; wer das Markup entkleidet, liest denselben Text wie in
 *    „Herleitung kopieren".
 * 2. **Die gepunktete Linie steht genau da, wo eine Erklärung dranhängt.** Sonst
 *    verspräche die Geste eine Auskunft, die beim Draufzeigen ausbleibt — oder
 *    hielte eine vorhandene verborgen.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ErklaerterSatz } from '../ErklaerterSatz';
import { erklaereSegmente, erklaerKatalog, type ErklaertesSegment } from '@/core/status/trigger-erklaerung';
import { baueSeedVersion } from '@/core/status/seed';
import { parseTriggerZeile } from '@/core/status/trigger-parser';
import { triggerSegmenteVon, alsText } from '@/core/status/trigger-satz';

const katalog = erklaerKatalog(baueSeedVersion());

/** Rohzeile → erklärte Segmente, wie sie das Popover bekommt. */
function segmenteVon(kuerzel: string, prozedur: string, parameter: string): {
  roh: ReturnType<typeof triggerSegmenteVon>; erklaert: ErklaertesSegment[];
} {
  const roh = triggerSegmenteVon(parseTriggerZeile({
    programm: '76', kuerzel, folge: 1, prozedur, parameter,
  }));
  return { roh, erklaert: erklaereSegmente(katalog, roh) };
}

const html = (segmente: readonly ErklaertesSegment[]): string =>
  renderToStaticMarkup(createElement(ErklaerterSatz, { segmente }));

/** Markup entkleiden — Entities zurück, damit der Textvergleich trägt. */
const nurText = (markup: string): string => markup
  .replace(/<[^>]*>/g, '')
  .replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

describe('ErklaerterSatz', () => {
  it('gibt den Satz Zeichen für Zeichen wieder', () => {
    const faelle: [string, string, string][] = [
      ['AAE', 'TRG_TVs_Status_TV_VB', '<59|ABB|YIRR||||31|31'],
      ['ABA', 'TRG.Status.TV.VB', '211|74'],
      ['AAR', 'TRG.VorgEintragNeu', 'AAA|211|0'],
      ['AAR', 'TRG.VorgEintragMail', 'TIB|!.055.VorgInfo.01|BIB'],
    ];
    for (const [kuerzel, prozedur, parameter] of faelle) {
      const { roh, erklaert } = segmenteVon(kuerzel, prozedur, parameter);
      expect(nurText(html(erklaert))).toBe(alsText(roh));
    }
  });

  it('unterstreicht genau die Zeichen, zu denen es eine Erklärung gibt', () => {
    const { erklaert } = segmenteVon('AAE', 'TRG_TVs_Status_TV_VB', '<59|ABB|YIRR|XYZ|||31|31');
    const markup = html(erklaert);
    const unterstrichen = [...markup.matchAll(/decoration-dotted[^>]*>([^<]*)</g)].map(m => m[1]);

    // ABB und YIRR kennt der Katalog, 59 und 31 auch — XYZ steht an einer
    // ungedeuteten Position und bekommt bewusst nichts.
    expect(unterstrichen).toContain('ABB');
    expect(unterstrichen).toContain('YIRR');
    expect(unterstrichen).toContain('59');
    expect(unterstrichen).not.toContain('XYZ');
    // Gegenprobe: die Zeichenkette steht im Satz, nur eben ohne Geste.
    expect(nurText(markup)).toContain('XYZ');
  });

  it('lässt eine nicht interpretierte Zeile vollständig blank', () => {
    const { roh, erklaert } = segmenteVon('XYZ', 'TRG.Irgendwas.Neues', '<59|ABB|||||40');
    const markup = html(erklaert);
    expect(nurText(markup)).toBe(alsText(roh));
    expect(markup).not.toContain('decoration-dotted');
    // Der Rohparameter enthält `ABB` und `59` — eine Deutung per Muster über den
    // Text hätte hier zwei Erklärungen behauptet, wo keine Deutung vorliegt.
    expect(nurText(markup)).toContain('Nicht interpretiert: <59|ABB|||||40');
  });

  it('trägt die Erklärung auch für Screenreader, nicht nur im Tooltip', () => {
    const { erklaert } = segmenteVon('AAE', 'TRG_TVs_Status_TV_VB', '<59|ABB|||||31|31');
    // Doppelpunkt, nicht Gedankenstrich: `ROLLE_LANG` trägt selbst einen
    // („FB — fachliche Bearbeitung"), und zwei hintereinander lesen sich als Kette.
    expect(html(erklaert)).toContain('aria-label="ABB: Bewilligung"');
  });
});
