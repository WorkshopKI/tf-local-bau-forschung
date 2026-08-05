/**
 * Was diese Datei festnagelt:
 *
 * 1. **Die PreCheck-Lücke trennt nach Pflicht.** DL und NW haben laut Seed gar
 *    keinen PreCheck — ihre Fälle sind unauffällig und dürfen den Befund nicht
 *    aufblähen. Genau diese Trennung entscheidet die Fachfrage.
 * 2. **Das Feld-Paar zählt Teilmengen**, nicht zwei unabhängige Zahlen: `auch`
 *    ist immer eine Teilmenge von `gefuellt`.
 * 3. **Verdeckung liest die Engine**, nicht eine zweite Auswertung: Sieger ∪
 *    `weitereTreffer`. Sperr-Opfer zählen in keiner der beiden Zahlen mit — das
 *    ist Absicht und wird separat ausgewiesen.
 * 4. **Kein Befund ist auch ein Ergebnis**: leerer Bestand liefert Nullen mit
 *    `gesamt`, keine Ausnahme.
 */
import { describe, it, expect } from 'vitest';
import { erhebeTerminBefunde, type TerminFall } from '@/core/status/termin-erhebung';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import type { StatusFeldEintrag } from '@/core/status/typen';
import type { TodoErgebnis } from '@/core/status/todo-engine';

const OPTS = {
  statusCode: 34,
  precheckFelder: ['D_PC+', 'D_XPC+'],
  paare: [
    { feldId: 'D_AVK', vergleichFeldId: 'D_VV' },
    { feldId: 'D_AAR', vergleichFeldId: 'D_VV' },
  ],
  regelId: 'r8',
};

/** Ein gesetztes Feld — leere Werte erzeugen im Bestand gar kein Vorkommen. */
const vk = (feldId: string, wert = '01.01.2026'): FeldVorkommen =>
  ({ feld: { feldId } as StatusFeldEintrag, wert });

const LEER: TodoErgebnis = {
  todo: null, regelId: null, beschreibung: null, zustaendig: [], wartetAuf: null,
  belege: [], gesperrtDurch: [], weitereTreffer: [], quelle: 'regel',
};

const erg = (p: Partial<TodoErgebnis>): TodoErgebnis => ({ ...LEER, ...p });

const fall = (p: Partial<TerminFall> & { aktenzeichen: string }): TerminFall => ({
  statusRoh: '', vbPhaseRoh: '', vorkommen: [], ergebnis: LEER, ...p,
});

describe('PreCheck-Lücke — Status 34 ohne Vermerk', () => {
  it('trennt Varianten mit PreCheck-Pflicht von denen ohne', () => {
    const b = erhebeTerminBefunde([
      fall({ aktenzeichen: 'A1', statusRoh: 'bearbeitungsreif', vbPhaseRoh: 3 }),   // FuE
      fall({ aktenzeichen: 'A2', statusRoh: 'bearbeitungsreif', vbPhaseRoh: 5 }),   // DS
      fall({ aktenzeichen: 'A3', statusRoh: 'bearbeitungsreif', vbPhaseRoh: 4 }),   // DL
      fall({ aktenzeichen: 'A4', statusRoh: 'bearbeitungsreif', vbPhaseRoh: 1 }),   // NW
    ], OPTS).precheck;

    expect(b.auf34).toBe(4);
    expect(b.ohneVermerk).toBe(4);
    expect(b.mitPflicht.map(g => `${g.schluessel}:${g.anzahl}`).sort()).toEqual(['DS:1', 'FuE:1']);
    expect(b.ohnePflicht.map(g => `${g.schluessel}:${g.anzahl}`).sort()).toEqual(['DL:1', 'NW:1']);
  });

  it('ein gesetztes PC+ ODER XPC+ nimmt den Vorgang aus dem Befund', () => {
    const b = erhebeTerminBefunde([
      fall({ aktenzeichen: 'A1', statusRoh: 'bearbeitungsreif', vbPhaseRoh: 3, vorkommen: [vk('D_PC+')] }),
      fall({ aktenzeichen: 'A2', statusRoh: 'bearbeitungsreif', vbPhaseRoh: 3, vorkommen: [vk('D_XPC+')] }),
      fall({ aktenzeichen: 'A3', statusRoh: 'bearbeitungsreif', vbPhaseRoh: 3 }),
    ], OPTS).precheck;

    expect(b.auf34).toBe(3);
    expect(b.ohneVermerk).toBe(1);
    expect(b.mitPflicht[0]?.beispiele).toEqual(['A3']);
  });

  it('ein anderer Status zählt gar nicht mit', () => {
    const b = erhebeTerminBefunde([
      fall({ aktenzeichen: 'A1', statusRoh: 'beantragt', vbPhaseRoh: 3 }),
      fall({ aktenzeichen: 'A2', statusRoh: 'unvollständig', vbPhaseRoh: 3 }),
    ], OPTS).precheck;
    expect(b.auf34).toBe(0);
    expect(b.mitPflicht).toEqual([]);
  });

  it('eine unbekannte Fördervariante wird benannt, nicht geraten', () => {
    // Irrläufer (9) und reservierte Phasen liefern keinen Bucket — sie gehören
    // NICHT zu den Pflicht-Fällen, sollen aber sichtbar bleiben.
    const b = erhebeTerminBefunde([
      fall({ aktenzeichen: 'A1', statusRoh: 'bearbeitungsreif', vbPhaseRoh: 9 }),
      fall({ aktenzeichen: 'A2', statusRoh: 'bearbeitungsreif', vbPhaseRoh: '' }),
    ], OPTS).precheck;
    expect(b.mitPflicht).toEqual([]);
    expect(b.ohnePflicht).toEqual([
      { schluessel: 'ohne Variante', label: 'ohne Variante', anzahl: 2, beispiele: ['A1', 'A2'] },
    ]);
  });

  it('führt höchstens drei Beispiele je Gruppe', () => {
    const viele = Array.from({ length: 7 }, (_, i) =>
      fall({ aktenzeichen: `AZ-${i}`, statusRoh: 'bearbeitungsreif', vbPhaseRoh: 3 }));
    const g = erhebeTerminBefunde(viele, OPTS).precheck.mitPflicht[0];
    expect(g?.anzahl).toBe(7);
    expect(g?.beispiele).toEqual(['AZ-0', 'AZ-1', 'AZ-2']);
  });
});

describe('Feld-Paare — gefüllt und davon auch das zweite', () => {
  it('zählt Teilmengen, nicht zwei unabhängige Zahlen', () => {
    const b = erhebeTerminBefunde([
      fall({ aktenzeichen: 'A1', vorkommen: [vk('D_AVK')] }),
      fall({ aktenzeichen: 'A2', vorkommen: [vk('D_AVK'), vk('D_VV')] }),
      fall({ aktenzeichen: 'A3', vorkommen: [vk('D_VV')] }),
    ], OPTS).feldpaare;

    const avk = b.find(p => p.feldId === 'D_AVK');
    expect(avk).toMatchObject({ gefuellt: 2, auchVergleich: 1 });
    expect(avk!.auchVergleich).toBeLessThanOrEqual(avk!.gefuellt);
    expect(avk?.beispieleNurFeld).toEqual(['A1']);
  });

  it('ein leerer Wert zählt nicht als gefüllt', () => {
    // Im Bestand entsteht zu einem leeren Feld gar kein Vorkommen; ein
    // whitespace-Wert soll hier genauso wenig zählen.
    const b = erhebeTerminBefunde([
      fall({ aktenzeichen: 'A1', vorkommen: [vk('D_AVK', '  ')] }),
    ], OPTS).feldpaare;
    expect(b.find(p => p.feldId === 'D_AVK')?.gefuellt).toBe(0);
  });

  it('führt beide Paare unabhängig', () => {
    const b = erhebeTerminBefunde([
      fall({ aktenzeichen: 'A1', vorkommen: [vk('D_AAR'), vk('D_VV')] }),
    ], OPTS).feldpaare;
    expect(b.find(p => p.feldId === 'D_AAR')).toMatchObject({ gefuellt: 1, auchVergleich: 1 });
    expect(b.find(p => p.feldId === 'D_AVK')).toMatchObject({ gefuellt: 0, auchVergleich: 0 });
  });
});

describe('Verdeckung — wer die Regel schlägt', () => {
  it('zählt den Sieger in beiden Zahlen und meldet keinen Verdecker', () => {
    const b = erhebeTerminBefunde([
      fall({ aktenzeichen: 'A1', ergebnis: erg({ regelId: 'r8', todo: 'RNE abwarten' }) }),
    ], OPTS).verdeckung;
    expect(b).toMatchObject({ trifftZu: 1, gewinnt: 1, verdeckerVon: [] });
  });

  it('gruppiert die Verdecker nach der Regel, die stattdessen gewinnt', () => {
    const b = erhebeTerminBefunde([
      fall({ aktenzeichen: 'A1', ergebnis: erg({ regelId: 'r6', beschreibung: 'R6 · Frist abgelaufen', weitereTreffer: [{ regelId: 'r8', todo: 'RNE abwarten' }] }) }),
      fall({ aktenzeichen: 'A2', ergebnis: erg({ regelId: 'r6', beschreibung: 'R6 · Frist abgelaufen', weitereTreffer: [{ regelId: 'r8', todo: 'RNE abwarten' }] }) }),
      fall({ aktenzeichen: 'A3', ergebnis: erg({ regelId: 'r4', beschreibung: 'R4 · SV in QS', weitereTreffer: [{ regelId: 'r8', todo: 'RNE abwarten' }] }) }),
      fall({ aktenzeichen: 'A4', ergebnis: erg({ regelId: 'r8', todo: 'RNE abwarten' }) }),
    ], OPTS).verdeckung;

    expect(b).toMatchObject({ trifftZu: 4, gewinnt: 1 });
    expect(b.verdeckerVon.map(g => `${g.schluessel}:${g.anzahl}`)).toEqual(['r6:2', 'r4:1']);
    expect(b.verdeckerVon[0]?.label).toBe('R6 · Frist abgelaufen');
    expect(b.verdeckerVon[0]?.beispiele).toEqual(['A1', 'A2']);
  });

  it('ein Vorgang unter Sperre zählt in KEINER der beiden Zahlen, wird aber genannt', () => {
    // Die Sperre unterdrückt r8, bevor die Bedingung überhaupt geprüft wird —
    // deshalb steht sie weder im Sieger noch in `weitereTreffer`. Ohne die
    // eigene Zahl suchte jemand die fehlende Differenz.
    const b = erhebeTerminBefunde([
      fall({ aktenzeichen: 'A1', ergebnis: erg({ gesperrtDurch: ['s0'] }) }),
      fall({ aktenzeichen: 'A2', ergebnis: erg({ regelId: 'r8' }) }),
    ], OPTS).verdeckung;
    expect(b).toMatchObject({ trifftZu: 1, gewinnt: 1, unterSperre: 1 });
  });

  it('eine Regel, die nirgends zutrifft, liefert Nullen ohne Verdecker', () => {
    const b = erhebeTerminBefunde([
      fall({ aktenzeichen: 'A1', ergebnis: erg({ regelId: 'r3' }) }),
    ], OPTS).verdeckung;
    expect(b).toMatchObject({ trifftZu: 0, gewinnt: 0, verdeckerVon: [] });
  });
});

describe('Form der Ausgabe', () => {
  it('leerer Bestand liefert Nullen mit gesamt, keine Ausnahme', () => {
    const b = erhebeTerminBefunde([], OPTS);
    expect(b.gesamt).toBe(0);
    expect(b.precheck).toMatchObject({ auf34: 0, ohneVermerk: 0, mitPflicht: [], ohnePflicht: [] });
    expect(b.feldpaare).toHaveLength(2);
    expect(b.feldpaare[0]).toMatchObject({ gefuellt: 0, auchVergleich: 0 });
    expect(b.verdeckung).toMatchObject({ trifftZu: 0, gewinnt: 0, unterSperre: 0 });
  });

  it('gesamt zählt jeden Vorgang, auch die ohne Befund', () => {
    expect(erhebeTerminBefunde([
      fall({ aktenzeichen: 'A1' }), fall({ aktenzeichen: 'A2' }),
    ], OPTS).gesamt).toBe(2);
  });

  it('zwei Läufe über dieselbe Eingabe liefern dasselbe (rein)', () => {
    const f = [
      fall({ aktenzeichen: 'A1', statusRoh: 'bearbeitungsreif', vbPhaseRoh: 3 }),
      fall({ aktenzeichen: 'A2', ergebnis: erg({ regelId: 'r6', weitereTreffer: [{ regelId: 'r8', todo: 'x' }] }) }),
    ];
    expect(erhebeTerminBefunde(f, OPTS)).toEqual(erhebeTerminBefunde(f, OPTS));
  });
});
