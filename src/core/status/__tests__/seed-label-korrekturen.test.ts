/**
 * Der Abgleich der beiden Kürzel-Zuarbeiten.
 *
 * Kein Guard im Sinne von „eine Quelle gewinnt" — die Messung sagt genau das
 * Gegenteil (siehe `seed-label-korrekturen.ts`). Bewacht wird deshalb dreierlei:
 * dass jede Entscheidung greift, dass sie belegt bleibt, und dass die Menge der
 * offenen Widersprüche **nicht unbemerkt wächst**.
 */
import { describe, it, expect } from 'vitest';
import { ZUARBEIT_CODES } from '../seed-codes.data';
import { KUERZEL_KATALOG } from '../kuerzel-katalog.data';
import { baueSeedCodeFelder } from '../seed-codes';
import { kuerzelAuskunft } from '../kuerzel-katalog';
import {
  KUERZEL_ENTSCHEIDUNGEN, aktualisiereBehoerdenname, korrigiereZuarbeitLabel,
} from '../seed-label-korrekturen';

const ROH = new Map(ZUARBEIT_CODES.map(z => [z.code, z]));

describe('Kürzel-Entscheidungen — jede greift und bleibt belegt', () => {
  it('jede Entscheidung nennt einen Code, den die Zuarbeit führt', () => {
    expect(KUERZEL_ENTSCHEIDUNGEN.filter(e => !ROH.has(e.code)).map(e => e.code)).toEqual([]);
  });

  it('jede Entscheidung korrigiert mindestens eine Seite', () => {
    const wirkungslos = KUERZEL_ENTSCHEIDUNGEN
      .filter(e => e.seedFalsch === undefined && e.katalogFalsch === undefined)
      .map(e => e.code);
    expect(wirkungslos).toEqual([]);
  });

  it('keine Entscheidung ist abgelaufen — `seedFalsch` trifft den heutigen Wortlaut', () => {
    // Läuft eine ins Leere, hat eine neue Zuarbeit den Fehler an der Quelle
    // behoben. Dann gehört der Eintrag GELÖSCHT, nicht angepasst: er hielte
    // sonst einen Wortlaut fest, den niemand mehr schreibt.
    const abgelaufen = KUERZEL_ENTSCHEIDUNGEN
      .filter(e => e.seedFalsch !== undefined && ROH.get(e.code)?.label !== e.seedFalsch)
      .map(e => `${e.code}: erwartet "${e.seedFalsch}", Zuarbeit sagt "${ROH.get(e.code)?.label}"`);
    expect(abgelaufen).toEqual([]);
  });

  it('keine Entscheidung ist abgelaufen — `katalogFalsch` trifft den heutigen Wortlaut', () => {
    const roh = new Map(KUERZEL_KATALOG.map(e => [e.kuerzel.toUpperCase(), e]));
    const abgelaufen = KUERZEL_ENTSCHEIDUNGEN
      .filter(e => e.katalogFalsch !== undefined)
      .filter(e => !Object.values(roh.get(e.code.toUpperCase())?.formen ?? {})
        .some(f => f.bezeichnung === e.katalogFalsch))
      .map(e => `${e.code}: "${e.katalogFalsch}" steht in keiner Form mehr`);
    expect(abgelaufen).toEqual([]);
  });

  it('keine Entscheidung ist wirkungslos (falsch === richtig)', () => {
    const gleich = KUERZEL_ENTSCHEIDUNGEN
      .filter(e => e.seedFalsch === e.richtig || e.katalogFalsch === e.richtig)
      .map(e => e.code);
    expect(gleich).toEqual([]);
  });

  it('jede Entscheidung trägt Begründung und Beleg', () => {
    for (const e of KUERZEL_ENTSCHEIDUNGEN) {
      expect(e.begruendung, e.code).not.toBe('');
      expect(e.beleg, e.code).not.toBe('');
    }
  });

  it('nach der Korrektur sagen beide Quellen dasselbe', () => {
    // Der eigentliche Zweck: der Widerspruch ist weg, nicht bloß eine Seite
    // umgeschrieben. Gilt für beide Richtungen gleichermaßen.
    const uneinig = KUERZEL_ENTSCHEIDUNGEN
      .map(e => ({ e, a: kuerzelAuskunft(e.code, null) }))
      .filter(({ e, a }) => a.bezeichnung !== e.richtig)
      .map(({ e, a }) => `${e.code}: Katalog sagt "${a.bezeichnung}", entschieden ist "${e.richtig}"`);
    expect(uneinig).toEqual([]);
  });

  it('korrigiert am Seed nur die gelisteten Codes plus die Umbenennung', () => {
    const geaendert = ZUARBEIT_CODES
      .filter(z => korrigiereZuarbeitLabel(z).label !== z.label)
      .map(z => z.code);
    const erwartet = new Set([
      ...KUERZEL_ENTSCHEIDUNGEN.filter(e => e.seedFalsch !== undefined).map(e => e.code),
      ...ZUARBEIT_CODES.filter(z => z.label.includes('BMWK')).map(z => z.code),
    ]);
    expect(geaendert.sort()).toEqual([...erwartet].sort());
  });

  it('die Korrektur landet im gebauten Seed — auf JEDEM Weg', () => {
    // Zwei Schleifen bauen die Felder: einsortierte Codes und der Sammelordner.
    // XKS ist einsortiert, ABX nicht — beide müssen korrigiert herauskommen.
    const felder = new Map(baueSeedCodeFelder().map(f => [f.code, f.label]));
    expect(felder.get('XKS')).toBe('Gutachten fertig');
    expect(felder.get('XQS')).toBe('Gutachten QS fertig');
    expect(felder.get('ABX')).toBe('Bewilligung ausgesetzt');
    expect(felder.get('ALQ')).toBe('NF von QS gelesen');
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
      .map(f => `${f.code}: "${f.label}"`);
    expect(verdaechtig).toEqual([]);
  });
});

describe('BMWK → BMWE — die Umbenennung, die kein Quellen-Vergleich findet', () => {
  it('ersetzt den Namen und lässt alles andere in Ruhe', () => {
    expect(aktualisiereBehoerdenname('Widerruf ans BMWK')).toBe('Widerruf ans BMWE');
    expect(aktualisiereBehoerdenname('Widerruf ans BMWE')).toBe('Widerruf ans BMWE');
    expect(aktualisiereBehoerdenname('Antragseingang')).toBe('Antragseingang');
  });

  it('trifft genau 14 Kürzel im Seed — die Menge ist gepinnt, nicht geschätzt', () => {
    const betroffen = ZUARBEIT_CODES.filter(z => z.label.includes('BMWK')).map(z => z.code);
    expect(betroffen.sort()).toEqual([
      'ABL10', 'ABL10+', 'AZWG', 'AZWG+', 'LG', 'MVG', 'RZG', 'RZG+',
      'WRWZG', 'WRWZG+', 'WRZG', 'WRZG+', 'XEFB5', 'ÄG',
    ].sort());
  });

  it('der Quellen-Vergleich konnte die Mehrzahl strukturell nicht finden', () => {
    // Der eigentliche Befund, hergeleitet statt behauptet: wo BEIDE Quellen
    // denselben veralteten Namen tragen, gibt es keinen Widerspruch — die Codes
    // zählten zu den „wortgleichen" und tauchten in keiner Konfliktliste auf.
    // Übereinstimmung zweier veralteter Quellen ist eben keine Richtigkeit.
    const roh = new Map(KUERZEL_KATALOG.map(e => [e.kuerzel.toUpperCase(), e]));
    const rohKatalogText = (code: string): string =>
      Object.values(roh.get(code.toUpperCase())?.formen ?? {}).map(f => f.bezeichnung).join(' | ');

    const seedBmwk = ZUARBEIT_CODES.filter(z => z.label.includes('BMWK'));
    const inBeiden = seedBmwk.filter(z => rohKatalogText(z.code).includes('BMWK'));
    expect(inBeiden).toHaveLength(12);

    // Und zwei tragen ihn NUR im Katalog — die flache Zuarbeit war dort schon
    // auf dem neuen Namen. Auch diese Richtung kommt vor.
    const nurKatalog = ZUARBEIT_CODES
      .filter(z => !z.label.includes('BMWK') && rohKatalogText(z.code).includes('BMWK'))
      .map(z => z.code);
    expect(nurKatalog.sort()).toEqual(['ABLWG', 'ABLWG+']);
  });

  it('kein gebautes Seed-Feld nennt das Ministerium noch beim alten Namen', () => {
    const alt = baueSeedCodeFelder().filter(f => f.label.includes('BMWK')).map(f => f.code);
    expect(alt).toEqual([]);
  });

  it('auch der form-bewusste Katalog nennt nur noch BMWE', () => {
    const alt = ZUARBEIT_CODES
      .map(z => ({ code: z.code, b: kuerzelAuskunft(z.code, null).bezeichnung ?? '' }))
      .filter(x => x.b.includes('BMWK'))
      .map(x => x.code);
    expect(alt).toEqual([]);
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

  it('bleibt bei 66 — jede Verschiebung ist eine Aussage und gehört angesehen', () => {
    // 76 gemessen, 10 entschieden (KUERZEL_ENTSCHEIDUNGEN), 66 offen. Die
    // restlichen unterscheiden sich in der AUSSAGE, nicht in der Schreibung
    // (`XFB` 2-in-12/1-in-24, `SART` zwei ganz verschiedene Wertelisten,
    // `ABLWG+` „Freigabe erfolgt" gegen „Hinweise/Rückfragen") — sie brauchen
    // den Fachbereich und werden hier nicht geraten.
    //
    // Die Zahl steht als Wasserstand, nicht als Ziel: sinkt sie, wurde geklärt;
    // steigt sie, hat eine neue Zuarbeit Widersprüche mitgebracht. Beides soll
    // auffallen, statt in 505 Zeilen unterzugehen.
    expect(offeneWidersprueche()).toHaveLength(66);
  });

  it('keiner der offenen Widersprüche ist zugleich entschieden', () => {
    const doppelt = offeneWidersprueche()
      .filter(c => KUERZEL_ENTSCHEIDUNGEN.some(e => e.code === c));
    expect(doppelt).toEqual([]);
  });
});
