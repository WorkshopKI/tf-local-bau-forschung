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
    'csv-sources-kuration': '/kuration/csv-quellen',
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
    expect(legacyRedirectTarget('/kuration/csv-quellen')).toBeNull();
    expect(legacyRedirectTarget('/kuration/dokument-review')).toBeNull();
    expect(legacyRedirectTarget('/antraege')).toBeNull();
  });
});

describe('routeToPluginId', () => {
  it('loest die eigenstaendig gebliebenen Kuration-Seiten NICHT auf den Hub auf', () => {
    // Der Hub liegt auf `/kuration`, also einem Praefix der beiden. Nur weil
    // `ROUTE_TO_PLUGIN` die laengste Route zuerst prueft, gewinnen sie.
    expect(routeToPluginId('/kuration/csv-quellen')).toBe('csv-sources-kuration');
    expect(routeToPluginId('/kuration/dokument-review')).toBe('dokument-review');
    expect(routeToPluginId('/kuration')).toBe('kuration');
  });

  it('faengt Detail-URLs unter der Plugin-Route ein', () => {
    expect(routeToPluginId('/antraege/verbund/VB-1')).toBe('antraege');
    expect(routeToPluginId('/')).toBe('home');
  });
});
