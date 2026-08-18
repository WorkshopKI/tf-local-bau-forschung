/**
 * Die Rechenschaft der Ähnlichkeitsstufe (v4.110).
 *
 * Geprüft wird der Satz, nicht das Rendern: welcher der drei Fälle greift, ob
 * die Reichweite dabeisteht — und dass der gemeldete Fall („alles stand schon
 * da") NICHT nach einem Fehler klingt, sondern die Trefferzahl erklärt.
 */
import { describe, it, expect } from 'vitest';
import { aehnlichkeitsSatz } from '../aehnlichkeitsSatz';

describe('aehnlichkeitsSatz', () => {
  it('nennt Neuzugang und Gesamtzahl, wenn etwas dazukam', () => {
    const t = aehnlichkeitsSatz({ korpus: 1086, kandidaten: 12, neu: 3 }, 14225);
    expect(t).toContain('12 thematisch verwandte');
    expect(t).toContain('3 davon neu');
  });

  it('erklärt den gemeldeten Fall: gefunden, aber nichts Neues', () => {
    const t = aehnlichkeitsSatz({ korpus: 1086, kandidaten: 12, neu: 0 }, 14225);
    expect(t).toContain('standen schon im Wortlaut-Ergebnis');
    expect(t).toContain('Trefferzahl ändert sich dadurch nicht');
    // Kein Fehlerwort — die Stufe hat gearbeitet.
    expect(t).not.toMatch(/ohne Wirkung|fehlgeschlagen|Fehler/);
  });

  it('sagt es auch, wenn nichts über der Schwelle lag', () => {
    expect(aehnlichkeitsSatz({ korpus: 1086, kandidaten: 0, neu: 0 }, 14225))
      .toContain('kein Vorhaben lag über der Schwelle');
  });

  it('nennt die Reichweite nur, solange der Korpus kleiner ist als der Bestand', () => {
    expect(aehnlichkeitsSatz({ korpus: 1086, kandidaten: 5, neu: 5 }, 14225))
      .toContain('1.086 von 14.225');
    expect(aehnlichkeitsSatz({ korpus: 14225, kandidaten: 5, neu: 5 }, 14225))
      .not.toContain('Vergleichbar sind');
  });
});
