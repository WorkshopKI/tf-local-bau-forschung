/**
 * Was diese Datei festnagelt:
 *
 * 1. Gezählt werden VORGÄNGE je Statuscode — nicht Verbünde, nicht Feld-Wert-Paare.
 * 2. Ein unbekannter Status-Text zählt gar nicht mit, statt still auf einen Code
 *    zu fallen.
 * 3. Varianten-Schreibweisen desselben Codes landen im selben Fach.
 * 4. Ein Kürzel zählt je Vorgang EINMAL, auch wenn es über zwei Felder kommt.
 */
import { describe, it, expect } from 'vitest';
import { codeAusSatz, zaehleCodes, kuerzelEinesVorgangs } from '../vorkommen';
import type { VorgangsRohsatz } from '../vorgangs-quelle';
import type { StatusFeldEintrag } from '../typen';

const satz = (status: unknown): Record<string, unknown> => ({ status });

/** Ein Katalog-Feld, reduziert auf das, was der Zähler liest. */
const feld = (feldId: string, code?: string): StatusFeldEintrag => ({
  feldId, label: feldId, typ: 'datum', ebene: 'tv', code,
  prominenzDefault: 'normal', aktiv: true, unkuratiert: false,
});

const vorgang = (felder: StatusFeldEintrag[]): VorgangsRohsatz => ({
  aktenzeichen: '16KN000001', unterprogrammId: 1, verbundId: null, record: {},
  vorkommen: felder.map(f => ({ feld: f, wert: '2026-01-01' })),
});

describe('codeAusSatz (Status-Text → Code)', () => {
  it('liest den Code aus dem Status-Text des Antrags', () => {
    expect(codeAusSatz(satz('bewilligt'))).toBe(59);
  });

  it('ein unbekannter Status-Text ergibt null', () => {
    expect(codeAusSatz(satz('Fantasiestatus'))).toBeNull();
  });

  it('leerer oder fehlender Status ergibt null', () => {
    expect(codeAusSatz(satz(''))).toBeNull();
    expect(codeAusSatz(satz('   '))).toBeNull();
    expect(codeAusSatz({})).toBeNull();
    expect(codeAusSatz(satz(59))).toBeNull();
  });

  it('eine Varianten-Schreibweise trifft denselben Code', () => {
    // `VN techn. geprüft` ist eine gepflegte Variante von `VN technisch geprüft`.
    expect(codeAusSatz(satz('VN techn. geprüft'))).toBe(codeAusSatz(satz('VN technisch geprüft')));
  });
});

describe('zaehleCodes (Vorgänge, nicht Verbünde)', () => {
  it('zählt jeden Vorgang einzeln — fünf TV eines Verbunds sind fünf', () => {
    const m = zaehleCodes([satz('bewilligt'), satz('bewilligt'), satz('bewilligt')]);
    expect(m.get(59)).toBe(3);
  });

  it('unbekannte Status-Texte zählen nicht mit', () => {
    const m = zaehleCodes([satz('bewilligt'), satz('Fantasiestatus'), satz('')]);
    expect(m.get(59)).toBe(1);
    expect([...m.values()].reduce((s, n) => s + n, 0)).toBe(1);
  });

  it('leere Eingabe ergibt eine leere Karte, keinen Fehler', () => {
    expect(zaehleCodes([]).size).toBe(0);
  });

  it('verschiedene Codes stehen nebeneinander', () => {
    const m = zaehleCodes([satz('bewilligt'), satz('beantragt'), satz('beantragt')]);
    expect(m.get(59)).toBe(1);
    expect(m.get(31)).toBe(2);
  });
});

describe('kuerzelEinesVorgangs (Kürzel je Vorgang, entdoppelt)', () => {
  it('nennt jedes gesetzte Kürzel', () => {
    const k = kuerzelEinesVorgangs(vorgang([feld('D_AAE', 'AAE'), feld('D_ABB', 'ABB')]));
    expect([...k].sort()).toEqual(['AAE', 'ABB']);
  });

  it('zählt ein doppelt geführtes Kürzel nur einmal', () => {
    // Dasselbe Kürzel über Verbund- UND TV-Record: der Vorgang bleibt einer.
    const k = kuerzelEinesVorgangs(vorgang([feld('D_AAE', 'AAE'), feld('antragsdatum', 'AAE')]));
    expect([...k]).toEqual(['AAE']);
  });

  it('übergeht Felder ohne Kürzel — kanonische Felder tragen keines', () => {
    expect([...kuerzelEinesVorgangs(vorgang([feld('status'), feld('D_ABB', 'ABB')]))])
      .toEqual(['ABB']);
  });

  it('normalisiert Umlaut-Kürzel auf NFC (Pitfall #22)', () => {
    // Dieselbe Zeichenkette, einmal zerlegt geschrieben: ohne Normalisierung
    // stünde das Kürzel zweimal in der Karte und fände seinen Katalog-Eintrag nicht.
    const zerlegt = 'THÜ';
    const k = kuerzelEinesVorgangs(vorgang([feld('D_THÜ', zerlegt), feld('T_THÜ', 'THÜ')]));
    expect([...k]).toEqual(['THÜ'.normalize('NFC')]);
    expect(k.size).toBe(1);
  });
});
