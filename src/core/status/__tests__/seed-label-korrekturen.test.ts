/**
 * Der Abgleich der beiden Kürzel-Zuarbeiten.
 *
 * Kein Guard im Sinne von „eine Quelle gewinnt" — die Messung sagt genau das
 * Gegenteil (siehe `seed-label-korrekturen.ts`). Bewacht wird deshalb dreierlei:
 * dass jede Korrektur greift, dass sie belegt bleibt, und dass die Menge der
 * offenen Widersprüche **nicht unbemerkt wächst**.
 */
import { describe, it, expect } from 'vitest';
import { ZUARBEIT_CODES } from '../seed-codes.data';
import { baueSeedCodeFelder } from '../seed-codes';
import { kuerzelAuskunft } from '../kuerzel-katalog';
import { SEED_LABEL_KORREKTUREN, korrigiereZuarbeitLabel } from '../seed-label-korrekturen';

const ROH = new Map(ZUARBEIT_CODES.map(z => [z.code, z]));

describe('seed-label-korrekturen — jede Korrektur greift und bleibt belegt', () => {
  it('jede Korrektur nennt einen Code, den die Zuarbeit führt', () => {
    const unbekannt = SEED_LABEL_KORREKTUREN.filter(k => !ROH.has(k.code));
    expect(unbekannt.map(k => k.code)).toEqual([]);
  });

  it('keine Korrektur ist abgelaufen — `falsch` trifft den heutigen Wortlaut', () => {
    // Läuft eine ins Leere, hat eine neue Zuarbeit den Fehler an der Quelle
    // behoben. Dann gehört der Eintrag GELÖSCHT, nicht angepasst: er hielte
    // sonst einen Wortlaut fest, den niemand mehr schreibt.
    const abgelaufen = SEED_LABEL_KORREKTUREN
      .filter(k => ROH.get(k.code)?.label !== k.falsch)
      .map(k => `${k.code}: erwartet "${k.falsch}", Zuarbeit sagt "${ROH.get(k.code)?.label}"`);
    expect(abgelaufen).toEqual([]);
  });

  it('keine Korrektur ist wirkungslos (falsch === richtig)', () => {
    expect(SEED_LABEL_KORREKTUREN.filter(k => k.falsch === k.richtig)).toEqual([]);
  });

  it('jede Korrektur ist durch den form-bewussten Katalog gedeckt', () => {
    // Der Beleg IST der zweite Katalog. Eine Korrektur, die dort keine
    // einstimmige Entsprechung hat, wäre unsere Erfindung — genau das soll die
    // Liste nicht enthalten.
    const ungedeckt = SEED_LABEL_KORREKTUREN
      .map(k => ({ k, a: kuerzelAuskunft(k.code, null) }))
      .filter(({ k, a }) => !a.eindeutig || a.bezeichnung !== k.richtig)
      .map(({ k, a }) => `${k.code}: Katalog sagt "${a.bezeichnung}" (eindeutig=${a.eindeutig})`);
    expect(ungedeckt).toEqual([]);
  });

  it('korrigiert nur die gelisteten Codes und lässt alle anderen unberührt', () => {
    const geaendert = ZUARBEIT_CODES
      .filter(z => korrigiereZuarbeitLabel(z).label !== z.label)
      .map(z => z.code);
    expect(geaendert.sort()).toEqual(SEED_LABEL_KORREKTUREN.map(k => k.code).sort());
  });

  it('die Korrektur landet im gebauten Seed — auf JEDEM Weg', () => {
    // Zwei Schleifen bauen die Felder: einsortierte Codes und der Sammelordner.
    // XKS ist einsortiert, ABX nicht — beide müssen korrigiert herauskommen.
    const felder = new Map(baueSeedCodeFelder().map(f => [f.code, f.label]));
    expect(felder.get('XKS')).toBe('Gutachten fertig');
    expect(felder.get('XQS')).toBe('Gutachten QS fertig');
    expect(felder.get('ABX')).toBe('Bewilligung ausgesetzt');
  });

  it('kein Seed-Label trägt mehr ein Projektform-Präfix, das der Katalog nicht führt', () => {
    // Die gemeldete Bugklasse: ein Wortlaut aus EINER Projektform, flach für
    // alle ausgeliefert. `DL-Stichprobe` bleibt erlaubt — dort gehört DL zur
    // Sache, und der Katalog führt es genauso.
    const verdaechtig = baueSeedCodeFelder()
      .filter(f => /^(DL|NW|EP|FuE|DS)-/.test(f.label))
      .filter(f => {
        const a = kuerzelAuskunft(f.code ?? '', null);
        return a.eindeutig && a.bezeichnung !== f.label;
      })
      .map(f => `${f.code}: "${f.label}" vs Katalog "${kuerzelAuskunft(f.code ?? '', null).bezeichnung}"`);
    expect(verdaechtig).toEqual([]);
  });
});

describe('offene Widersprüche zwischen den beiden Zuarbeiten', () => {
  /** Codes, bei denen der form-bewusste Katalog einstimmig etwas anderes sagt. */
  function offeneWidersprueche(): string[] {
    return baueSeedCodeFelder()
      .filter(f => f.code !== undefined)
      .filter(f => {
        const a = kuerzelAuskunft(f.code!, null);
        return a.bezeichnung !== null && a.eindeutig && a.bezeichnung !== f.label;
      })
      .map(f => f.code!);
  }

  it('bleibt bei 70 — jede Verschiebung ist eine Aussage und gehört angesehen', () => {
    // 76 gemessen, 6 entschieden (SEED_LABEL_KORREKTUREN), 70 offen. Die
    // restlichen unterscheiden sich in der AUSSAGE, nicht in der Schreibung
    // (`ALQ` PL/QS, `XFB` 2-in-12/1-in-24, `IVW2` Sachwalter/starker Verwalter)
    // — sie brauchen den Fachbereich und werden hier nicht geraten.
    //
    // Die Zahl steht als Wasserstand, nicht als Ziel: sinkt sie, wurde geklärt;
    // steigt sie, hat eine neue Zuarbeit Widersprüche mitgebracht. Beides soll
    // auffallen, statt in 505 Zeilen unterzugehen.
    expect(offeneWidersprueche()).toHaveLength(70);
  });

  it('keiner der offenen Widersprüche ist zugleich korrigiert', () => {
    const doppelt = offeneWidersprueche()
      .filter(c => SEED_LABEL_KORREKTUREN.some(k => k.code === c));
    expect(doppelt).toEqual([]);
  });
});
