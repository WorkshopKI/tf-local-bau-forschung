/**
 * Die To-do-Kaskade. Drei Dinge werden hier festgehalten:
 *
 * 1. **Jede Regel trifft mindestens einmal.** Ein Regelsatz, in dem eine Zeile
 *    nie greift, ist entweder falsch transkribiert oder von einer früheren Zeile
 *    verdeckt — beides bleibt sonst jahrelang unbemerkt.
 * 2. **Die Reihenfolge entscheidet.** Wo mehrere Regeln zutreffen, gewinnt die
 *    vordere; die anderen erscheinen als `weitereTreffer`.
 * 3. **Die 31-Tage-Grenze ist scharf.** An Tag 31 läuft die Widerspruchsfrist
 *    noch, ab Tag 32 ist sie vorbei.
 */
import { describe, it, expect } from 'vitest';
import { ermittleTodo, baueTodoKontext, todoWerte } from '@/core/status/todo-engine';
import { AB_TODO_REGELN, baueTodoRegelSeed, feld } from '@/core/status/todo-regeln.seed';
import type { BedingungsKontext } from '@/core/status/bedingung';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import type { StatusFeldEintrag, TodoRegel } from '@/core/status/typen';

const STICHTAG = '2026-08-01T00:00:00.000Z';
const REGELN = baueTodoRegelSeed();

/** Kontext aus Kürzel→Wert; Nicht-Kürzel-Schlüssel (`status`) gehen direkt durch. */
function ctx(werte: Record<string, string>): BedingungsKontext {
  const m: BedingungsKontext = new Map();
  for (const [k, v] of Object.entries(werte)) {
    m.set(k.startsWith('_') ? k.slice(1) : feld(k), [v]);
  }
  return m;
}

const todoVon = (werte: Record<string, string>): string | null =>
  ermittleTodo(REGELN, ctx(werte), STICHTAG).todo;

/** Tage vor dem Stichtag als deutsches Datum (so kommen sie aus dem Export). */
function vorTagen(tage: number): string {
  const d = new Date(new Date(STICHTAG).getTime() - tage * 86_400_000);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}

const HEUTE = vorTagen(0);
const GESTERN = vorTagen(1);

describe('Regelsatz — Aufbau', () => {
  it('führt 25 Regeln und 2 Sperren, jede Id genau einmal', () => {
    const sperren = AB_TODO_REGELN.filter(r => (r.sperrt?.length ?? 0) > 0);
    expect(sperren.map(s => s.id)).toEqual(['s1', 's2']);
    expect(AB_TODO_REGELN).toHaveLength(27);
    expect(new Set(AB_TODO_REGELN.map(r => r.id)).size).toBe(27);
  });

  it('ist streng aufsteigend sortiert — die Reihenfolge IST die Kaskade', () => {
    const r = AB_TODO_REGELN.map(x => x.reihenfolge);
    expect([...r].sort((a, b) => a - b)).toEqual(r);
    expect(new Set(r).size).toBe(r.length);
  });

  it('sperrt nur Regeln, die es gibt', () => {
    const ids = new Set(AB_TODO_REGELN.map(r => r.id));
    for (const s of AB_TODO_REGELN) {
      for (const ziel of s.sperrt ?? []) expect(ids.has(ziel), ziel).toBe(true);
    }
  });

  it('gibt jeder Regel entweder eine Zuständigkeit oder ein Warten', () => {
    for (const r of AB_TODO_REGELN) {
      if ((r.sperrt?.length ?? 0) > 0) continue;
      expect(r.zustaendig.length > 0 || r.wartetAuf != null, r.id).toBe(true);
    }
  });

  it('löst die vier kanonisch belegten Codes korrekt auf', () => {
    expect(feld('ABB')).toBe('bewilligung_datum');
    expect(feld('AAE')).toBe('antragsdatum');
    // Alles andere bleibt die rohe Spalte.
    expect(feld('ARZ')).toBe('D_ARZ');
  });

  it('baueTodoRegelSeed liefert unabhängige Kopien', () => {
    const a = baueTodoRegelSeed();
    a[0]!.zustaendig.push('qs');
    expect(baueTodoRegelSeed()[0]!.zustaendig).toEqual(AB_TODO_REGELN[0]!.zustaendig);
  });

  it('todoWerte listet die Gruppen des Boards in Kaskaden-Reihenfolge', () => {
    const werte = todoWerte(REGELN);
    expect(werte[0]).toBe('Abl/RNE erstellen');
    expect(werte).toContain('NF erstellen');
    // Sperren tragen keinen To-do-Wert bei, „SV erstellen" nur einmal (R5/R6/R11).
    expect(werte.filter(w => w === 'SV erstellen')).toHaveLength(1);
    expect(werte).not.toContain('');
  });
});

describe('Kaskade — je Regel ein positives Fixture', () => {
  const FAELLE: [string, Record<string, string>, string][] = [
    ['r1', { 'PC-': GESTERN }, 'Abl/RNE erstellen'],
    ['r2', { 'XPC-': GESTERN }, 'Abl/RNE von FB abwarten'],
    ['r3', { ABB: GESTERN }, 'ZuwB erstellen'],
    ['r4', { AVK: GESTERN }, 'SV in QS'],
    ['r5', { AAR: GESTERN }, 'SV erstellen'],
    ['r6', { ARZ: vorTagen(40) }, 'SV erstellen'],
    ['r7', { ARZ: vorTagen(10), ARW: GESTERN }, 'Stellungnahme RNE prüfen'],
    ['r8', { ARZ: vorTagen(10) }, 'RNE abwarten'],
    ['r9', { ART: GESTERN }, 'RNE ergänzen'],
    ['r10', { AN: vorTagen(30), ANT: vorTagen(5) }, 'Erinnerung an NF'],
    ['r11', { ABLZ: vorTagen(40) }, 'SV erstellen'],
    ['r12', { ABLZ: vorTagen(10), ABLW: GESTERN }, 'Widerspruch gg Abl bearbeiten'],
    ['r13', { ABLZ: vorTagen(10) }, 'Abl abwarten'],
    ['r14', { XABLF: GESTERN }, 'Abl in QS'],
    ['r15', { ABLT: GESTERN }, 'Abl ergänzen'],
    ['r16', { ABLK: GESTERN }, 'Abl erstellt'],
    ['r17', { QS: GESTERN }, 'QS erfolgt'],
    ['r18', { 'QS-': GESTERN }, 'Rückfragen aus QS'],
    ['r19', { AK4: GESTERN, AT4: GESTERN }, 'in QS'],
    ['r20', { '_T_XPC+': 'ja', AK4: GESTERN }, 'kaufm. fertig für QS'],
    ['r21', { '_T_XPC+': 'ja', AT4: GESTERN }, 'GA schreiben'],
    ['r22', { AN: vorTagen(20), AL: vorTagen(5) }, 'NL prüfen'],
    ['r23', { _status: 'beantragt', _vb_phase: '3' }, 'PC offen'],
    ['r24', { ALU: GESTERN }, 'NF ergänzen'],
    ['r25', { _status: 'bearbeitungsreif' }, 'NF erstellen'],
  ];

  for (const [id, werte, erwartet] of FAELLE) {
    it(`${id} → „${erwartet}"`, () => {
      const e = ermittleTodo(REGELN, ctx(werte), STICHTAG);
      expect(e.todo).toBe(erwartet);
      expect(e.regelId).toBe(id);
    });
  }

  it('deckt damit jede Regel des Seeds ab', () => {
    const getroffen = new Set(FAELLE.map(([id]) => id));
    const offen = AB_TODO_REGELN
      .filter(r => (r.sperrt?.length ?? 0) === 0)
      .map(r => r.id)
      .filter(id => !getroffen.has(id));
    expect(offen, `Ohne positives Fixture: ${offen.join(', ')}`).toEqual([]);
  });
});

describe('Reihenfolge entscheidet', () => {
  it('die vordere Regel gewinnt, die hintere wird als weiterer Treffer geführt', () => {
    // Nach 40 Tagen treffen R6 („SV erstellen", Frist abgelaufen) UND R8
    // („RNE abwarten") zu — die Kaskade entscheidet zugunsten von R6.
    const e = ermittleTodo(REGELN, ctx({ ARZ: vorTagen(40) }), STICHTAG);
    expect(e.todo).toBe('SV erstellen');
    expect(e.regelId).toBe('r6');
    expect(e.weitereTreffer.map(w => w.regelId)).toContain('r8');
  });

  it('R19 („in QS") verdrängt R16 nicht durch Position, sondern durch Bedingung', () => {
    // Beide GA-Teile fertig ⇒ R16 greift nicht mehr, obwohl es weiter vorn steht.
    const e = ermittleTodo(
      REGELN, ctx({ ABLK: GESTERN, AK4: GESTERN, AT4: GESTERN }), STICHTAG,
    );
    expect(e.todo).toBe('in QS');
    expect(e.regelId).toBe('r19');
  });
});

describe('Sperren', () => {
  it('S1 legt die PreCheck-, NF- und NL-Stränge still', () => {
    // Ohne S1 träfe R1; mit zurückgezogenem Antrag bleibt R5.
    const e = ermittleTodo(REGELN, ctx({ 'PC-': GESTERN, AAR: GESTERN }), STICHTAG);
    expect(e.todo).toBe('SV erstellen');
    expect(e.regelId).toBe('r5');
    expect(e.gesperrtDurch).toContain('s1');
  });

  it('S2 sperrt, sobald RNE oder Ablehnung begonnen wurde', () => {
    const ohne = todoVon({ 'PC-': GESTERN });
    const mit = ermittleTodo(REGELN, ctx({ 'PC-': GESTERN, ART: GESTERN }), STICHTAG);
    expect(ohne).toBe('Abl/RNE erstellen');
    expect(mit.gesperrtDurch).toContain('s2');
    expect(mit.regelId).toBe('r9');       // RNE ergänzen statt PreCheck-To-do
  });

  it('eine Sperre erzeugt selbst nie ein To-do', () => {
    const e = ermittleTodo(REGELN, ctx({ AAR: GESTERN, AVK: GESTERN, VV: GESTERN }), STICHTAG);
    expect(e.gesperrtDurch).toEqual(['s1']);
    expect(e.regelId).not.toBe('s1');
  });
});

describe('31-Tage-Grenze', () => {
  it('an Tag 31 läuft die Frist noch', () => {
    expect(todoVon({ ARZ: vorTagen(31) })).toBe('RNE abwarten');
  });

  it('ab Tag 32 ist sie abgelaufen', () => {
    expect(todoVon({ ARZ: vorTagen(32) })).toBe('SV erstellen');
  });

  it('gleiches Muster bei der Ablehnung', () => {
    expect(todoVon({ ABLZ: vorTagen(31) })).toBe('Abl abwarten');
    expect(todoVon({ ABLZ: vorTagen(32) })).toBe('SV erstellen');
  });

  it('derselbe Bestand liefert am selben Stichtag immer dasselbe', () => {
    const werte = { ARZ: vorTagen(32) };
    expect(ermittleTodo(REGELN, ctx(werte), STICHTAG))
      .toEqual(ermittleTodo(REGELN, ctx(werte), STICHTAG));
  });
});

describe('Kein Treffer ist ein Ergebnis', () => {
  it('leerer Antrag bekommt „kein To-do ermittelt", nicht nichts', () => {
    const e = ermittleTodo(REGELN, ctx({}), STICHTAG);
    expect(e.todo).toBeNull();
    expect(e.regelId).toBeNull();
    expect(e.belege).toEqual([]);
  });

  it('inaktive Regeln zählen nicht mit', () => {
    const aus: TodoRegel[] = REGELN.map(r => (r.id === 'r1' ? { ...r, aktiv: false } : r));
    expect(ermittleTodo(aus, ctx({ 'PC-': GESTERN }), STICHTAG).todo).toBeNull();
  });
});

describe('Belege', () => {
  it('nennt die gelesenen Felder mit ihren Werten', () => {
    const e = ermittleTodo(REGELN, ctx({ ARZ: vorTagen(10) }), STICHTAG);
    const nach = new Map(e.belege.map(b => [b.feldId, b.werte]));
    expect(nach.get('D_ARZ')).toEqual([vorTagen(10)]);
    // Auch die LEEREN Felder der Regel stehen da — genau sie erklären den Fall.
    expect(nach.get('D_ARW')).toEqual([]);
    expect(nach.has('D_AAR')).toBe(true);
  });
});

describe('baueTodoKontext', () => {
  const eintrag = (feldId: string, wert: string, textSpalte?: string, text?: string): FeldVorkommen => ({
    feld: {
      feldId, label: feldId, typ: 'datum', ebene: 'tv',
      prominenzDefault: 'normal', aktiv: true, unkuratiert: false,
      ...(textSpalte ? { textSpalte } : {}),
    } as StatusFeldEintrag,
    wert,
    ...(text ? { text } : {}),
  });

  it('nimmt die Textspalten mit — die Mappe fragt T_XPC+, nicht D_XPC+', () => {
    const k = baueTodoKontext([eintrag('D_XPC+', HEUTE, 'T_XPC+', 'positiv')]);
    expect(k.get('D_XPC+')).toEqual([HEUTE]);
    expect(k.get('T_XPC+')).toEqual(['positiv']);
  });

  it('sammelt mehrere Teilvorhaben unter demselben Feld', () => {
    const k = baueTodoKontext([eintrag('D_AK4', HEUTE), eintrag('D_AK4', GESTERN)]);
    expect(k.get('D_AK4')).toEqual([HEUTE, GESTERN]);
  });

  it('legt keinen Text-Schlüssel an, wenn kein Text da ist', () => {
    expect(baueTodoKontext([eintrag('D_XPC+', HEUTE, 'T_XPC+')]).has('T_XPC+')).toBe(false);
  });
});
