/**
 * Die Wege, die Lesezeichen und Browser-History am Leben halten.
 *
 * Mit v4.34 sind Kuration-Seiten zu Panels EINER Seite geworden. Wer eine alte
 * URL im Lesezeichen hat, darf nicht auf der Startseite landen — genau das
 * passierte bis dahin still bei `/admin/feedback` und
 * `/admin/unterprogramme`, deren Ziele es seit v2.364 nicht mehr gab.
 */
import { describe, it, expect, vi } from 'vitest';

// `routes.ts` liest `PLUGIN_ROUTES` aus `plugins.config`, und das zieht jedes
// Plugin mit — bis hin zum pdfjs-Worker, der sich unter node nicht aufloesen
// laesst. Gestellt wird darum eine Karte, die die kritischen Faelle
// nachstellt: der Hub auf `/kuration` und zwei Seiten, deren Route mit ihm
// beginnt. Genau daran haengt die Praefix-Kollision, die hier geprueft wird —
// dass die drei auch wirklich so registriert sind, sichert der Typecheck.
vi.mock('@/plugins.config', () => ({
  PLUGIN_ROUTES: {
    home: '/',
    antraege: '/antraege',
    kuration: '/kuration',
    'dokument-review': '/kuration/dokument-review',
    'feedback-board': '/feedback-board',
  },
}));

const { legacyRedirectTarget, routeToPluginId } = await import('../routes');

describe('legacyRedirectTarget', () => {
  it('leitet die alten /admin/*-Wege auf ihre heutigen Ziele', () => {
    expect(legacyRedirectTarget('/admin/suchindex')).toBe('/kuration/suchindex');
    expect(legacyRedirectTarget('/admin/programme')).toBe('/kuration/programme');
    expect(legacyRedirectTarget('/admin/csv-sources')).toBe('/kuration/csv-quellen');
    expect(legacyRedirectTarget('/admin/filter')).toBe('/kuration/filter');
  });

  it('schickt /admin/feedback ins Board statt auf eine Route, die es nicht gibt', () => {
    // Bis v4.33 zeigte der Eintrag auf `/kuration/feedback`; die Seite ist mit
    // v2.364 im Board aufgegangen, der Redirect fiel seitdem in den Catch-all.
    expect(legacyRedirectTarget('/admin/feedback')).toBe('/feedback-board');
  });

  it('fuehrt die aufgeloesten Kuration-Seiten in ihr Panel', () => {
    expect(legacyRedirectTarget('/kuration/anfragen')).toBe('/kuration?panel=dienste');
    expect(legacyRedirectTarget('/kuration/suchindex')).toBe('/kuration?panel=suche-index');
    expect(legacyRedirectTarget('/kuration/programme')).toBe('/kuration?panel=foerderprogramme');
    expect(legacyRedirectTarget('/kuration/csv-quellen')).toBe('/kuration?panel=csv-quellen');
  });

  it('springt bei Seiten, die nur eine GRUPPE geworden sind, auf ihren Anker', () => {
    // `/kuration/filter` war eine ganze Seite; im Panel „Förderprogramme" ist
    // sie die dritte Karte. Ohne `&sektion=` laendete das Lesezeichen am
    // Seitenkopf, und der Nutzer muesste suchen, was er im Lesezeichen hatte.
    expect(legacyRedirectTarget('/kuration/filter'))
      .toBe('/kuration?panel=foerderprogramme&sektion=sec-filter');
    expect(legacyRedirectTarget('/kuration/dokumentenquellen'))
      .toBe('/kuration?panel=suche-index&sektion=sec-dokumentenquellen');
  });

  it('gibt /admin/unterprogramme wieder ein Ziel', () => {
    // Der Eintrag zeigte auf `/kuration/unterprogramme` — eine Route, die es nie
    // gab; er fiel bis v4.34 in den Catch-all. Seit die Unterprogramme eine
    // Gruppe im Panel sind, traegt die zweite Stufe ihn ans richtige Ziel.
    expect(legacyRedirectTarget('/admin/unterprogramme')).toBe('/kuration/unterprogramme');
    expect(legacyRedirectTarget('/kuration/unterprogramme'))
      .toBe('/kuration?panel=foerderprogramme&sektion=sec-unterprogramme');
  });

  it('haengt bei Panel-Zielen KEIN Unterpfad-Suffix an die Query', () => {
    // `/kuration?panel=dienste/xyz` waere ein kaputter Query-Wert.
    expect(legacyRedirectTarget('/kuration/anfragen/egal')).toBe('/kuration?panel=dienste');
  });

  it('uebernimmt Unterpfade bei Pfad-Zielen unveraendert', () => {
    expect(legacyRedirectTarget('/admin/programme/PRG-1')).toBe('/kuration/programme/PRG-1');
  });

  it('laesst Wege in Ruhe, die weiter existieren', () => {
    expect(legacyRedirectTarget('/kuration')).toBeNull();
    expect(legacyRedirectTarget('/kuration/dokument-review')).toBeNull();
    expect(legacyRedirectTarget('/antraege')).toBeNull();
  });
});

describe('routeToPluginId', () => {
  it('loest die eigenstaendig gebliebene Kuration-Seite NICHT auf den Hub auf', () => {
    // Der Hub liegt auf `/kuration`, also einem Praefix. Nur weil
    // `ROUTE_TO_PLUGIN` die laengste Route zuerst prueft, gewinnt sie.
    expect(routeToPluginId('/kuration/dokument-review')).toBe('dokument-review');
    expect(routeToPluginId('/kuration')).toBe('kuration');
  });

  it('faengt Detail-URLs unter der Plugin-Route ein', () => {
    expect(routeToPluginId('/antraege/verbund/VB-1')).toBe('antraege');
    expect(routeToPluginId('/')).toBe('home');
  });
});
