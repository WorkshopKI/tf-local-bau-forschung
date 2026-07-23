/**
 * Festschreibung der drei Register (Konsolidierungs-Pass, Kandidat 2).
 *
 * Die Fälle sind gegen die drei ABGELÖSTEN Implementierungen geschrieben
 * (feedbackUi.formatRelativeTime, arbeitskontext-anzeige.relativeZeit,
 * PendingList.formatRelative) — sie belegen, dass die Zusammenführung keine
 * sichtbare Ausgabe verändert hat. Einzige bewusste Abweichung: `lang` gibt
 * bei einem kaputten Zeitstempel jetzt '' statt „Invalid Date" aus.
 *
 * Wer eine Wortwahl ändert, ändert hier eine Erwartung — und sieht dabei, dass
 * die anderen beiden Register bewusst anders sprechen.
 */
import { describe, it, expect } from 'vitest';
import { relativeZeitKompakt, relativeZeitKurz, relativeZeitLang, zeitAbstand } from '../relativeZeit';

// 1.7.2026, 12:00 UTC — alle Fälle rechnen rückwärts von hier.
const JETZT = Date.parse('2026-07-01T12:00:00.000Z');
const vorMin = (n: number): string => new Date(JETZT - n * 60_000).toISOString();
const vorStd = (n: number): string => vorMin(n * 60);
const vorTagen = (n: number): string => vorStd(n * 24);

describe('zeitAbstand', () => {
  it('staffelt Minuten/Stunden/Tage/Wochen/Monate', () => {
    const a = zeitAbstand(vorTagen(45), JETZT);
    expect(a.ungueltig).toBe(false);
    expect(a.tage).toBe(45);
    expect(a.wochen).toBe(6);
    expect(a.monate).toBe(1);
  });

  it('schneidet per Default ab, rundet nur auf Wunsch', () => {
    expect(zeitAbstand(vorMin(90), JETZT).stunden).toBe(1);
    expect(zeitAbstand(vorMin(90), JETZT, true).stunden).toBe(2);
  });

  it('meldet einen kaputten Zeitstempel, statt NaN durchzureichen', () => {
    expect(zeitAbstand('kaputt', JETZT).ungueltig).toBe(true);
  });
});

describe('relativeZeitLang (Feedback-Register)', () => {
  it.each([
    [vorMin(0), 'gerade eben'],
    [vorMin(1), 'vor 1 Min.'],
    [vorMin(59), 'vor 59 Min.'],
    [vorMin(60), 'vor 1 Std.'],
    [vorStd(23), 'vor 23 Std.'],
    [vorTagen(1), 'gestern'],
    [vorTagen(6), 'vor 6 Tagen'],
    [vorTagen(7), 'vor 1 Woche'],
    [vorTagen(14), 'vor 2 Wochen'],
  ])('%s → %s', (iso, erwartet) => {
    expect(relativeZeitLang(iso, JETZT)).toBe(erwartet);
  });

  it('ab 30 Tagen das absolute Datum (sonst „vor 14 Wochen")', () => {
    expect(relativeZeitLang('2026-05-08T12:00:00.000Z', JETZT)).toBe(
      new Date('2026-05-08T12:00:00.000Z').toLocaleDateString('de-DE'),
    );
  });

  it('kaputter Zeitstempel → leer statt „Invalid Date"', () => {
    expect(relativeZeitLang('kaputt', JETZT)).toBe('');
  });
});

describe('relativeZeitKurz (Home-Register)', () => {
  it.each([
    [vorMin(0), 'gerade eben'],
    [vorMin(5), 'vor 5 Min'],
    [vorStd(3), 'vor 3 Std'],
    [vorTagen(1), 'vor 1 Tag'],
    [vorTagen(2), 'vor 2 Tagen'],
    [vorTagen(29), 'vor 29 Tagen'],
    [vorTagen(30), 'vor 1 Monat'],
    [vorTagen(70), 'vor 2 Monaten'],
  ])('%s → %s', (ts, erwartet) => {
    expect(relativeZeitKurz(ts, JETZT)).toBe(erwartet);
  });

  it('kaputter Zeitstempel → leer', () => {
    expect(relativeZeitKurz('kaputt', JETZT)).toBe('');
  });

  it('nennt nie ein Datum — auch nach Jahren nicht', () => {
    expect(relativeZeitKurz(vorTagen(800), JETZT)).toBe('vor 26 Monaten');
  });
});

describe('relativeZeitKompakt (Listen-Register)', () => {
  it.each([
    [vorMin(0), 'gerade eben'],
    [vorMin(30), '30 min'],
    [vorStd(5), '5 h'],
    [vorTagen(2), '2 Tg'],
  ])('%s → %s', (iso, erwartet) => {
    expect(relativeZeitKompakt(iso, JETZT)).toBe(erwartet);
  });

  it('rundet auf (90 Min sind „2 h", nicht „1 h")', () => {
    expect(relativeZeitKompakt(vorMin(90), JETZT)).toBe('2 h');
  });

  it('kaputter Zeitstempel → der Rohwert (einzige Spur in der Liste)', () => {
    expect(relativeZeitKompakt('kaputt', JETZT)).toBe('kaputt');
  });
});
