/**
 * Die Rechenschaft der Ähnlichkeitsstufe (v4.110, erweitert v4.113).
 *
 * Geprüft wird der Satz, nicht das Rendern: welcher der drei Fälle greift, ob
 * die Reichweite dabeisteht — und dass der gemeldete Fall („alles stand schon
 * da") NICHT nach einem Fehler klingt, sondern die Trefferzahl erklärt.
 *
 * Seit v4.113 kommt zweierlei dazu, weil ein falscher Rechenschaftsbericht
 * schlimmer ist als keiner: die Zahl VOR dem Deckel, und der Ausweg aus einem
 * unvollständigen Korpus.
 */
import { describe, it, expect } from 'vitest';
import { aehnlichkeitsSatz } from '../aehnlichkeitsSatz';
import type { SemantikBefund } from '@/core/hooks/useUnifiedSearch';

const befund = (b: Partial<SemantikBefund>): SemantikBefund => ({
  korpus: 14225, kandidaten: 0, neu: 0, verworfen: 0, ...b,
});

describe('aehnlichkeitsSatz', () => {
  it('nennt Neuzugang und Gesamtzahl, wenn etwas dazukam', () => {
    const t = aehnlichkeitsSatz(befund({ korpus: 1086, kandidaten: 12, neu: 3 }), 14225);
    expect(t).toContain('12 thematisch verwandte');
    expect(t).toContain('3 davon neu');
  });

  it('erklärt den gemeldeten Fall: gefunden, aber nichts Neues', () => {
    const t = aehnlichkeitsSatz(befund({ korpus: 1086, kandidaten: 12, neu: 0 }), 14225);
    expect(t).toContain('standen schon im Wortlaut-Ergebnis');
    expect(t).toContain('Trefferzahl ändert sich dadurch nicht');
    // Kein Fehlerwort — die Stufe hat gearbeitet.
    expect(t).not.toMatch(/ohne Wirkung|fehlgeschlagen|Fehler/);
  });

  it('sagt es auch, wenn nichts über der Schwelle lag', () => {
    expect(aehnlichkeitsSatz(befund({ korpus: 1086 }), 14225))
      .toContain('kein Vorhaben lag über der Schwelle');
  });

  it('nennt die Reichweite nur, solange der Korpus kleiner ist als der Bestand', () => {
    expect(aehnlichkeitsSatz(befund({ korpus: 1086, kandidaten: 5, neu: 5 }), 14225))
      .toContain('1.086 von 14.225');
    expect(aehnlichkeitsSatz(befund({ korpus: 14225, kandidaten: 5, neu: 5 }), 14225))
      .not.toContain('Vergleichbar sind');
  });

  // v4.113: der Ausweg stand bis dahin NUR im Zweig „0 Vektoren" — bei 1 086 von
  // 14 225 verschwieg die Zeile, dass auf dem Datenspeicher 14 065 bereitliegen.
  it('nennt bei unvollständigem Korpus den Weg, ihn zu füllen', () => {
    const t = aehnlichkeitsSatz(befund({ korpus: 1086, kandidaten: 5, neu: 5 }), 14225);
    expect(t).toContain('Datenspeicher');
    expect(t).toContain('Themen-Vektoren');
  });

  // v4.113: `kandidaten` ist die Zahl VOR dem Deckel. Steht dort die gedeckelte,
  // meldet der Satz „50 … alle standen schon im Wortlaut-Ergebnis", während zwei
  // abgeschnittene die einzigen neuen gewesen wären.
  it('sagt, wenn der Deckel etwas zurückgehalten hat', () => {
    const t = aehnlichkeitsSatz(
      befund({ korpus: 14225, kandidaten: 138, neu: 50, verworfen: 88 }), 14225,
    );
    expect(t).toContain('138 thematisch verwandte');
    expect(t).toContain('50 davon neu');
    expect(t).toContain('88 weitere lagen über der Schwelle');
  });

  it('schweigt über den Deckel, wenn er nichts zurückgehalten hat', () => {
    const t = aehnlichkeitsSatz(
      befund({ korpus: 14225, kandidaten: 12, neu: 3 }), 14225,
    );
    expect(t).not.toContain('weitere lagen über der Schwelle');
  });
});
