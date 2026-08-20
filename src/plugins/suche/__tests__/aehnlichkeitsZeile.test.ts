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
import { aehnlichkeitsSatz, type KorpusLage } from '../aehnlichkeitsSatz';
import type { SemantikBefund } from '@/core/hooks/useUnifiedSearch';
import type { AbgleichBefund } from '@/core/services/embedding-corpus';

const befund = (b: Partial<SemantikBefund>): SemantikBefund => ({
  korpus: 14225, kandidaten: 0, neu: 0, verworfen: 0, ...b,
});

const abgleich = (b: Partial<AbgleichBefund>): AbgleichBefund => ({
  aktion: 'nichts', grund: 'Lokaler Korpus und Datenspeicher sind auf demselben Stand.',
  versionDanach: 3, neuaufbauNoetig: false, ...b,
});

const lage = (l: Partial<KorpusLage> = {}): KorpusLage => ({
  abgleich: null, laeuft: false, kannKuratieren: false, ...l,
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
  });

  /**
   * v4.127: Der Ausweg nannte zwei Knöpfe des Auslastungs-Moduls — einen hinter
   * einem Zusatzpasswort, den anderen (`Corpus aufbauen`) gab es in `zah-pl`
   * gar nicht, und in `zim-dashboard` existiert das Modul nicht. Ein Ausweg,
   * den der Leser nicht gehen kann, ist keiner.
   */
  it('schickt niemanden mehr zu Knöpfen des Auslastungs-Moduls', () => {
    const t = aehnlichkeitsSatz(befund({ korpus: 1086, kandidaten: 5, neu: 5 }), 14225, lage());
    expect(t).not.toContain('Corpus aufbauen');
    expect(t).not.toContain('Vom Datenspeicher laden');
    expect(t).not.toContain('Auslastungs-Modul');
  });

  it('wird konkret nur für den, der die Kuration öffnen kann', () => {
    const b = befund({ korpus: 1086, kandidaten: 5, neu: 5 });
    expect(aehnlichkeitsSatz(b, 14225, lage({ kannKuratieren: true })))
      .toContain('Suche & Index');
    expect(aehnlichkeitsSatz(b, 14225, lage({ kannKuratieren: false })))
      .not.toContain('Suche & Index');
  });

  it('nennt einen laufenden Download statt eines Handgriffs', () => {
    const t = aehnlichkeitsSatz(
      befund({ korpus: 1086, kandidaten: 5, neu: 5 }), 14225, lage({ laeuft: true }),
    );
    expect(t).toContain('gerade vom Datenspeicher geholt');
    expect(t).not.toContain('Kuration');
  });

  /**
   * Der Fall, der den Umbau ausgelöst hat: die Reichweite schweigt (der Korpus
   * ist vollständig), die Trefferzahl sieht plausibel aus — und die Vektoren
   * kennen den Inhalt eines Vorhabens nicht. Bis v4.127 stand darüber nichts.
   */
  it('meldet eine überholte Textfassung AUCH bei vollständigem Korpus', () => {
    const t = aehnlichkeitsSatz(
      befund({ korpus: 14225, kandidaten: 12, neu: 3 }), 14225,
      lage({ abgleich: abgleich({ versionDanach: 2, neuaufbauNoetig: true }) }),
    );
    expect(t).not.toContain('Vergleichbar sind'); // Reichweite schweigt zu Recht
    expect(t).toContain('überholten Textfassung');
    expect(t).toContain('(v2)');
    expect(t).toContain('nicht seinen Inhalt');
  });

  /**
   * In der Abnahme am echten Bestand stand der Ausweg ZWEIMAL in derselben
   * Zeile: unvollständiger Korpus und überholte Textfassung trafen beide zu,
   * und jeder Teilsatz hängte ihn sich selbst an. Genau die Lage ist der
   * Normalfall auf einem Rechner mit v2-Bestand.
   */
  it('nennt den Ausweg höchstens einmal, auch wenn beide Gründe zutreffen', () => {
    const t = aehnlichkeitsSatz(
      befund({ korpus: 14065, kandidaten: 61, neu: 0 }), 14225,
      lage({ kannKuratieren: true, abgleich: abgleich({ versionDanach: 2, neuaufbauNoetig: true }) }),
    );
    expect(t).toContain('überholten Textfassung');
    expect(t.split('Suche & Index').length - 1).toBe(1);
  });

  it('schweigt über die Textfassung, wenn sie aktuell ist', () => {
    const t = aehnlichkeitsSatz(
      befund({ korpus: 14225, kandidaten: 12, neu: 3 }), 14225,
      lage({ abgleich: abgleich({}) }),
    );
    expect(t).not.toContain('überholten Textfassung');
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
