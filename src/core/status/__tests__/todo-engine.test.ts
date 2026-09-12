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
import {
  ermittleTodo, ermittleTodosAlleRollen, baueTodoKontext, todoWerte,
} from '@/core/status/todo-engine';
import { AB_TODO_REGELN, baueTodoRegelSeed, feld } from '@/core/status/todo-regeln.seed';
import type { BedingungsKontext } from '@/core/status/bedingung';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import { strangAusEintrag } from '@/core/status/regelsatz';
import { ALLE_STRAENGE, type StatusFeldEintrag, type TodoRegel } from '@/core/status/typen';

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
  it('führt 29 Regeln und 4 Sperren, jede Id genau einmal', () => {
    // S0/S0b kamen mit der Fachabstimmung dazu (die fixierten Slicer der Mappe),
    // R23 wurde nach Rollen in R23a/R23b geteilt, R26–R28 gaben R7 seinen Ausgang.
    const sperren = AB_TODO_REGELN.filter(r => (r.sperrt?.length ?? 0) > 0);
    expect(sperren.map(s => s.id)).toEqual(['s0', 's0b', 's1', 's2']);
    expect(AB_TODO_REGELN).toHaveLength(33);
    expect(new Set(AB_TODO_REGELN.map(r => r.id)).size).toBe(33);
  });

  it('ist streng aufsteigend sortiert — die Reihenfolge IST die Kaskade', () => {
    const r = AB_TODO_REGELN.map(x => x.reihenfolge);
    expect([...r].sort((a, b) => a - b)).toEqual(r);
    expect(new Set(r).size).toBe(r.length);
  });

  it('sperrt nur Regeln und Straenge, die es gibt (der Sentinel ausgenommen)', () => {
    const ids = new Set(AB_TODO_REGELN.map(r => r.id));
    const straenge = new Set(AB_TODO_REGELN.map(r => r.strang).filter(Boolean));
    for (const s of AB_TODO_REGELN) {
      for (const ziel of [...(s.sperrt ?? []), ...(s.sperrtNicht ?? [])]) {
        if (ziel === ALLE_STRAENGE) continue;
        const strang = strangAusEintrag(ziel);
        // Ein genannter Strang muss BELEGT sein: eine Sperre auf einen Strang,
        // den keine Regel traegt, sperrt nichts und sagt es nicht — dieselbe
        // Falle wie eine tote Regel-Id.
        if (strang !== null) expect(straenge.has(strang), ziel).toBe(true);
        else expect(ids.has(ziel), ziel).toBe(true);
      }
    }
  });

  it('sperrtNicht nennt Regeln, nie Straenge', () => {
    // Eine Ausnahme meint genau EINE Aufgabe, die eine Totalsperre ueberlebt
    // („ZuwB erstellen"). Ein ganzer Strang als Ausnahme waere eine zweite
    // Sperr-Sprache mit umgekehrtem Vorzeichen.
    for (const s of AB_TODO_REGELN) {
      for (const ziel of s.sperrtNicht ?? []) expect(strangAusEintrag(ziel), ziel).toBeNull();
    }
  });

  it('jede Regel eines gesperrten Strangs traegt ihn auch', () => {
    // Die Umstellung ist nur dann vollstaendig, wenn kein Mitglied fehlt —
    // genau das war der Defekt der Id-Listen, nur andersherum.
    const gesperrte = new Set(AB_TODO_REGELN
      .flatMap(r => r.sperrt ?? [])
      .map(strangAusEintrag)
      .filter((x): x is string => x !== null));
    expect([...gesperrte].sort()).toEqual(['nachforderung', 'precheck']);
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

/**
 * Je Regel eine Feldlage, unter der sie feuert. Steht ausserhalb des `describe`,
 * weil das Regressionsgatter unten dieselben Lagen braucht — zwei Kopien liefen
 * beim ersten neuen Fixture auseinander.
 */
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
    ['r23a', { _status: 'beantragt', _vb_phase: '3' }, 'PC offen'],
    ['r23b', { _status: 'beantragt', _vb_phase: '3', 'PC+': GESTERN }, 'PC offen'],
    ['r24', { ALU: GESTERN }, 'NF ergänzen'],
  ['r25', { _status: 'bearbeitungsreif' }, 'NF erstellen'],
  // R26–R28 geben R7 seinen Ausgang. Alle drei setzen `ARZ`+`ARW` — ohne die
  // fiele der Fall auf R10/R22 und der Test prüfte nicht, was er soll.
  ['r26', { ARZ: vorTagen(40), ARW: vorTagen(20), AL: vorTagen(5) }, 'NL prüfen'],
  ['r27', { ARZ: vorTagen(40), ARW: vorTagen(20), AN: vorTagen(10), ANT: vorTagen(2) }, 'Erinnerung an NF'],
  ['r28', { ARZ: vorTagen(40), ARW: vorTagen(20), AN: vorTagen(10) }, 'NF abwarten'],
];

/** Nur Id + Feldlage — die Erwartung braucht das Gatter nicht. */
const FIXTURE_LAGEN: [string, Record<string, string>][] = FAELLE.map(([id, w]) => [id, w]);

describe('Kaskade — je Regel ein positives Fixture', () => {
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
    // `D_VV` gefüllt heißt zusätzlich S0 („Verfahren abgeschlossen").
    expect(e.gesperrtDurch).toEqual(['s0', 's1']);
    expect(e.regelId).not.toBe('s1');
  });
});

describe('S0/S0b — die fixierten Slicer der AB-Mappe', () => {
  it('S0 legt nach dem Schlussvermerk ALLES still', () => {
    // Ohne `D_VV` wäre das „ZuwB erstellen" (R3) — mit ihm ist der Vorgang durch.
    const e = ermittleTodo(REGELN, ctx({ VV: GESTERN, ABB: GESTERN }), STICHTAG);
    expect(e.gesperrtDurch).toContain('s0');
    expect(e.todo).toBeNull();
  });

  it('S0b legt nach dem Zuwendungsbescheid alles still …', () => {
    const e = ermittleTodo(REGELN, ctx({ AZBE: GESTERN, AK4: GESTERN, AT4: GESTERN }), STICHTAG);
    expect(e.gesperrtDurch).toContain('s0b');
    expect(e.todo, 'ohne S0b wäre das „in QS" (R19)').toBeNull();
  });

  it('… lässt R3 „ZuwB erstellen" aber ausdrücklich durch', () => {
    // Der eigentliche Grund für `sperrtNicht`: die beiden Bedingungen sind zwar
    // disjunkt (R3 verlangt AZBE leer), aber die Ausnahme muss lesbar dastehen —
    // und halten, falls jemand R3 später umschreibt.
    const s0b = REGELN.find(r => r.id === 's0b');
    expect(s0b?.sperrtNicht).toEqual(['r3']);
    // Gegenprobe mit einer künstlich immer greifenden S0b-Variante:
    const alwaysS0b = REGELN.map(r => r.id === 's0b'
      ? { ...r, bedingung: { feldId: feld('ABB'), op: 'gefuellt' as const } } : r);
    const e = ermittleTodo(alwaysS0b, ctx({ ABB: GESTERN }), STICHTAG);
    expect(e.gesperrtDurch).toContain('s0b');
    expect(e.todo).toBe('ZuwB erstellen');
  });

  it('erfasst mit dem Sentinel auch eine später ergänzte Regel', () => {
    // Genau dafür steht `'*'` statt einer Id-Liste: eine neue Regel darf nicht
    // still an einer Totalsperre vorbeilaufen.
    const neu: TodoRegel = {
      id: 'r99', reihenfolge: 999, beschreibung: 'Neu dazugekommen',
      bedingung: { feldId: feld('AAE'), op: 'gefuellt' },
      todo: 'Frisch erfunden', zustaendig: ['ab'], aktiv: true,
    };
    const e = ermittleTodo([...REGELN, neu], ctx({ VV: GESTERN, AAE: GESTERN }), STICHTAG);
    expect(e.todo).toBeNull();
  });
});

describe('V1 — das D_XKS-Gate am RNE-Strang', () => {
  it('unterdrückt die RNE-To-dos, sobald die kaufm. QS erfolgt ist', () => {
    expect(todoVon({ ARZ: vorTagen(40) })).toBe('SV erstellen');
    expect(todoVon({ ARZ: vorTagen(40), XKS: GESTERN })).not.toBe('SV erstellen');
    expect(todoVon({ ART: GESTERN, XKS: GESTERN })).not.toBe('RNE ergänzen');
  });
});

describe('V2 — „PC offen" nennt die wartende Rolle', () => {
  const basis = { _status: 'beantragt', _vb_phase: '3' };

  it('fehlt der TV-PreCheck, wartet es auf AB', () => {
    expect(ermittleTodo(REGELN, ctx(basis), STICHTAG).wartetAuf).toBe('ab');
  });

  it('ist der TV-Teil da und der Verbund-Teil offen, wartet es auf FB', () => {
    expect(ermittleTodo(REGELN, ctx({ ...basis, 'PC+': GESTERN }), STICHTAG).wartetAuf).toBe('fb');
  });

  it('sind BEIDE Teile vermerkt, ist „PC offen" keine wahre Aussage mehr', () => {
    const e = ermittleTodo(REGELN, ctx({ ...basis, 'PC+': GESTERN, 'XPC+': GESTERN }), STICHTAG);
    expect(e.todo).not.toBe('PC offen');
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

describe('Regelsätze je Rolle', () => {
  /** Eine FB-Regel, die auf dasselbe Feld sieht wie R2 (`D_XPC-`). */
  const fbRegel = (patch: Partial<TodoRegel> = {}): TodoRegel => ({
    id: 'fb1', reihenfolge: 10, beschreibung: 'FB1 · PreCheck-Verbund negativ',
    bedingung: { feldId: feld('XPC-'), op: 'gefuellt' },
    todo: 'Verbund-Ablehnung schreiben', zustaendig: ['fb'], regelsatz: 'fb', aktiv: true,
    ...patch,
  });

  describe('Regressionsgatter — leerer FB-Satz ändert nichts', () => {
    // Die wichtigste Zusicherung der Mehrspurigkeit. Das ganze restliche File
    // ist der ausführliche Teil davon: es ruft `ermittleTodo` ohne Rolle auf
    // und muss unverändert grün bleiben.
    const FAELLE: Record<string, string>[] = [
      { 'PC-': GESTERN }, { ABB: GESTERN }, { ARZ: vorTagen(40) },
      { VV: GESTERN, ABB: GESTERN }, { AAR: GESTERN }, {},
    ];

    it('ohne Rollen-Angabe wird der AB-Satz ausgewertet', () => {
      for (const werte of FAELLE) {
        expect(ermittleTodo(REGELN, ctx(werte), STICHTAG))
          .toEqual(ermittleTodo(REGELN, ctx(werte), STICHTAG, { rolle: 'ab' }));
      }
    });

    it('eine FB-Regel daneben lässt das AB-Ergebnis unberührt', () => {
      const mitFb = [...REGELN, fbRegel()];
      for (const werte of [...FAELLE, { 'XPC-': GESTERN }]) {
        expect(ermittleTodo(mitFb, ctx(werte), STICHTAG))
          .toEqual(ermittleTodo(REGELN, ctx(werte), STICHTAG));
      }
    });

    it('jede Regel des Auslieferungsstands liegt im AB-Satz', () => {
      const fremd = AB_TODO_REGELN.filter(r => r.regelsatz !== undefined);
      expect(fremd, 'der Seed transkribiert die AB-Mappe').toEqual([]);
    });
  });

  describe('Abgeleitete Platzhalter', () => {
    it('leiht der wartenden Rolle die Aussage der fremden Regel', () => {
      // R2 „Abl/RNE von FB abwarten" wartet auf FB — der FB hat dazu (noch)
      // keine eigene Regel und bekommt sie erkennbar geliehen.
      const alle = ermittleTodosAlleRollen(REGELN, ctx({ 'XPC-': GESTERN }), STICHTAG);
      expect(alle.ab.regelId).toBe('r2');
      expect(alle.ab.quelle).toBe('regel');
      expect(alle.fb.todo).toBe('Abl/RNE von FB abwarten');
      expect(alle.fb.quelle).toBe('abgeleitet');
      expect(alle.fb.abgeleitetAus).toBe('r2');
      expect(alle.fb.regelId, 'der FB hat keine eigene Regel — das soll man sehen').toBeNull();
      expect(alle.fb.zustaendig).toEqual(['fb']);
    });

    it('trägt die Belege der Herkunftsregel mit', () => {
      const alle = ermittleTodosAlleRollen(REGELN, ctx({ 'XPC-': GESTERN }), STICHTAG);
      expect(alle.fb.belege).toEqual(alle.ab.belege);
    });

    it('entsteht auch für QS (R4 „SV in QS")', () => {
      const alle = ermittleTodosAlleRollen(REGELN, ctx({ AVK: GESTERN }), STICHTAG);
      expect(alle.qs.abgeleitetAus).toBe('r4');
      expect(alle.fb.todo, 'nur die wartende Rolle bekommt ihn').toBeNull();
    });

    it('entsteht NICHT aus einem Warten auf den Antragsteller', () => {
      // R8 „RNE abwarten" wartet auf `ast` — außerhalb des Hauses und keine
      // Rolle. Für niemanden im Haus ist das eine Aufgabe.
      const alle = ermittleTodosAlleRollen(REGELN, ctx({ ARZ: vorTagen(10) }), STICHTAG);
      expect(alle.ab.regelId).toBe('r8');
      for (const r of ['fb', 'qs', 'pa', 'jur'] as const) expect(alle[r].todo, r).toBeNull();
    });

    it('wird von einer echten Regel desselben Satzes verdrängt', () => {
      const alle = ermittleTodosAlleRollen(
        [...REGELN, fbRegel()], ctx({ 'XPC-': GESTERN }), STICHTAG,
      );
      expect(alle.fb.todo).toBe('Verbund-Ablehnung schreiben');
      expect(alle.fb.quelle).toBe('regel');
      expect(alle.fb.regelId).toBe('fb1');
      expect(alle.fb.abgeleitetAus).toBeUndefined();
      expect(alle.ab.regelId, 'der AB-Satz bleibt, wie er war').toBe('r2');
    });

    it('unterbleibt, wo eine Sperre den Fall für DIESE Rolle geschlossen hat', () => {
      // Sonst entstünde aus einem für den FB abgeschlossenen Vorgang eine neue
      // Aufgabe — der Platzhalter würde ihn wiederbeleben.
      const nurFbSperre: TodoRegel = {
        id: 'sfb', reihenfolge: 1, beschreibung: 'FB ist hier fertig',
        bedingung: { feldId: feld('XPC-'), op: 'gefuellt' },
        todo: '', zustaendig: [], sperrt: [ALLE_STRAENGE], giltFuer: ['fb'], aktiv: true,
      };
      const alle = ermittleTodosAlleRollen(
        [...REGELN, nurFbSperre], ctx({ 'XPC-': GESTERN }), STICHTAG,
      );
      expect(alle.fb.todo).toBeNull();
      expect(alle.fb.gesperrtDurch).toContain('sfb');
      expect(alle.ab.regelId, 'im AB-Satz greift sie nicht').toBe('r2');
      expect(alle.ab.gesperrtDurch).not.toContain('sfb');
    });
  });

  /*
   * Der zweite Leihweg (v4.132). Bis dahin kam nur `wartetAuf` an: eine Regel
   * wie R12 („Widerspruch gg Abl bearbeiten", zuständig AB/FB/Jur) war in der
   * FB-Sicht GAR NICHT zu sehen — der FB bekam ein leeres Board, obwohl der
   * AB-Regelsatz ihn namentlich nennt.
   */
  describe('Mitzuständigkeit — die fremde Regel NENNT die Rolle', () => {
    it('leiht das To-do jeder Rolle, die in `zustaendig` steht', () => {
      // R12: ABLZ + ABLW gesetzt → „Widerspruch gg Abl bearbeiten", AB/FB/Jur.
      const alle = ermittleTodosAlleRollen(
        REGELN, ctx({ ABLZ: vorTagen(10), ABLW: GESTERN }), STICHTAG,
      );
      expect(alle.ab.regelId).toBe('r12');
      for (const r of ['fb', 'jur'] as const) {
        expect(alle[r].todo, r).toBe('Widerspruch gg Abl bearbeiten');
        expect(alle[r].quelle, r).toBe('abgeleitet');
        expect(alle[r].abgeleitetArt, r).toBe('zustaendig');
        expect(alle[r].abgeleitetAus, r).toBe('r12');
        expect(alle[r].zustaendig, r).toEqual([r]);
      }
      // Wer nicht genannt ist, bekommt auch nichts.
      for (const r of ['qs', 'pa'] as const) expect(alle[r].todo, r).toBeNull();
    });

    it('macht die Zeile für die genannte Rolle zu IHRER Aufgabe, nicht zu einem Warten', () => {
      const alle = ermittleTodosAlleRollen(
        REGELN, ctx({ ABLZ: vorTagen(10), ABLW: GESTERN }), STICHTAG,
      );
      expect(alle.fb.wartetAuf, 'sie wartet nicht, sie ist dran').toBeNull();
    });

    it('wird von einer echten Regel desselben Satzes verdrängt', () => {
      const eigene: TodoRegel = {
        id: 'fb9', reihenfolge: 5, beschreibung: 'FB · eigene Widerspruchs-Regel',
        bedingung: { feldId: feld('ABLW'), op: 'gefuellt' },
        todo: 'Widerspruch fachlich würdigen', zustaendig: ['fb'], regelsatz: 'fb', aktiv: true,
      };
      const alle = ermittleTodosAlleRollen(
        [...REGELN, eigene], ctx({ ABLZ: vorTagen(10), ABLW: GESTERN }), STICHTAG,
      );
      expect(alle.fb.todo).toBe('Widerspruch fachlich würdigen');
      expect(alle.fb.quelle).toBe('regel');
      expect(alle.ab.regelId, 'der AB-Satz bleibt, wie er war').toBe('r12');
    });

    it('schlägt den `wartetAuf`-Platzhalter, wo beide Wege offenstünden', () => {
      // Eine Regel, die den FB NENNT, ist die stärkere Aussage als eine, die
      // auf ihn wartet: „du bist mit dran" vs. „auf dich wird gewartet".
      const nennt: TodoRegel = {
        id: 'x1', reihenfolge: 2, beschreibung: 'X1 · nennt den FB',
        bedingung: { feldId: feld('XPC-'), op: 'gefuellt' },
        todo: 'Gemeinsam klären', zustaendig: ['ab', 'fb'], aktiv: true,
      };
      // R2 (wartet auf FB) trifft bei derselben Bedingung, steht aber hinter x1.
      const alle = ermittleTodosAlleRollen([nennt, ...REGELN], ctx({ 'XPC-': GESTERN }), STICHTAG);
      expect(alle.ab.regelId).toBe('x1');
      expect(alle.fb.todo).toBe('Gemeinsam klären');
      expect(alle.fb.abgeleitetArt).toBe('zustaendig');
    });

    it('unterbleibt, wo eine Sperre den Fall für DIESE Rolle geschlossen hat', () => {
      const nurFbSperre: TodoRegel = {
        id: 'sfb2', reihenfolge: 1, beschreibung: 'FB ist hier fertig',
        bedingung: { feldId: feld('ABLW'), op: 'gefuellt' },
        todo: '', zustaendig: [], sperrt: [ALLE_STRAENGE], giltFuer: ['fb'], aktiv: true,
      };
      const alle = ermittleTodosAlleRollen(
        [...REGELN, nurFbSperre], ctx({ ABLZ: vorTagen(10), ABLW: GESTERN }), STICHTAG,
      );
      expect(alle.fb.todo).toBeNull();
      expect(alle.jur.todo, 'für die Juristen greift sie nicht').toBe('Widerspruch gg Abl bearbeiten');
    });
  });

  describe('Sperren gelten vorgangsweit, solange sie nichts anderes sagen', () => {
    it('S0 legt auch einen fremden Regelsatz still', () => {
      // Die Sperre trägt kein `giltFuer` — ein abgeschlossenes Verfahren ist für
      // jede Rolle abgeschlossen.
      const alle = ermittleTodosAlleRollen(
        [...REGELN, fbRegel()], ctx({ 'XPC-': GESTERN, VV: GESTERN }), STICHTAG,
      );
      expect(alle.fb.todo).toBeNull();
      expect(alle.fb.gesperrtDurch).toContain('s0');
      expect(alle.ab.todo).toBeNull();
    });

    it('leeres giltFuer heißt „alle", nicht „keine"', () => {
      const s0Leer = REGELN.map(r => (r.id === 's0' ? { ...r, giltFuer: [] } : r));
      const e = ermittleTodo(s0Leer, ctx({ VV: GESTERN, ABB: GESTERN }), STICHTAG, { rolle: 'fb' });
      expect(e.gesperrtDurch).toContain('s0');
    });
  });

  describe('Zwei echte Spuren nebeneinander', () => {
    it('ein Antrag kann gleichzeitig ein AB- und ein FB-To-do tragen', () => {
      const fbEigen = fbRegel({
        id: 'fb2', bedingung: { feldId: feld('AT4'), op: 'gefuellt' },
        todo: 'Gutachten technisch prüfen',
      });
      const alle = ermittleTodosAlleRollen(
        [...REGELN, fbEigen], ctx({ ABB: GESTERN, AT4: GESTERN }), STICHTAG,
      );
      expect(alle.ab.todo).toBe('ZuwB erstellen');
      expect(alle.ab.quelle).toBe('regel');
      expect(alle.fb.todo).toBe('Gutachten technisch prüfen');
      expect(alle.fb.quelle).toBe('regel');
    });
  });

  describe('todoWerte je Regelsatz', () => {
    it('ohne Rolle zählen alle Sätze, mit Rolle nur der eigene', () => {
      const mitFb = [...REGELN, fbRegel()];
      expect(todoWerte(mitFb)).toContain('Verbund-Ablehnung schreiben');
      expect(todoWerte(mitFb, 'ab')).not.toContain('Verbund-Ablehnung schreiben');
      expect(todoWerte(mitFb, 'fb')).toEqual(['Verbund-Ablehnung schreiben']);
    });
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

describe('Regressionsgatter — Strang-Sperren statt Id-Listen (v2.412)', () => {
  /**
   * Der Kern der Umstellung: S1 und S2 zaehlten sieben Regel-Ids auf, jetzt
   * nennen sie zwei Straenge. Am Verhalten darf sich NICHTS aendern — und das
   * wird hier gegen den ganzen Fixture-Bestand gestellt, nicht gegen eine
   * Erwartung im Kopf.
   *
   * Verglichen wird das VOLLE `TodoErgebnis` inklusive `gesperrtDurch` und
   * `weitereTreffer`: ein Unterschied in der Begruendung waere genauso ein
   * Bruch wie einer im Ergebnis.
   */
  const ALTE_IDS = ['r1', 'r2', 'r22', 'r23a', 'r23b', 'r24', 'r25'];

  /** Der Seed in der Form VOR der Umstellung — nur die `sperrt`-Listen tauschen. */
  const altForm = (): TodoRegel[] => baueTodoRegelSeed().map(r => (
    r.id === 's1' || r.id === 's2' ? { ...r, sperrt: [...ALTE_IDS] } : r
  ));

  /** Jede Fixture-Lage, einmal blank und einmal unter jeder der beiden Sperren. */
  const LAGEN: [string, Record<string, string>][] = [
    ['blank', {}],
    ...FIXTURE_LAGEN.map(([id, w]) => [id, w] as [string, Record<string, string>]),
    ...FIXTURE_LAGEN.map(([id, w]) => [`${id}+S1`, { ...w, AAR: GESTERN }] as [string, Record<string, string>]),
    ...FIXTURE_LAGEN.map(([id, w]) => [`${id}+S2`, { ...w, ARK: GESTERN }] as [string, Record<string, string>]),
    ...FIXTURE_LAGEN.map(([id, w]) => [`${id}+S0`, { ...w, VV: GESTERN }] as [string, Record<string, string>]),
  ];

  for (const [name, werte] of LAGEN) {
    it(`${name}: beide Formen liefern dasselbe Ergebnis`, () => {
      const c = ctx(werte);
      expect(ermittleTodo(baueTodoRegelSeed(), c, STICHTAG))
        .toEqual(ermittleTodo(altForm(), c, STICHTAG));
    });
  }

  it('auch ueber ALLE Rollen hinweg, samt abgeleiteter Platzhalter', () => {
    for (const [, werte] of LAGEN) {
      const c = ctx(werte);
      expect(ermittleTodosAlleRollen(baueTodoRegelSeed(), c, STICHTAG))
        .toEqual(ermittleTodosAlleRollen(altForm(), c, STICHTAG));
    }
  });

  it('eine SPAETER ergaenzte Regel im Strang wird erfasst — die Id-Liste haette sie verpasst', () => {
    // Das ist der Grund fuer den Umbau, als Test: dieselbe neue Regel faellt in
    // der alten Form durch die Sperre und wird in der neuen davon erfasst.
    // `reihenfolge: 65` liegt VOR R5 („zurueckgezogen, SV fehlt", 70) — sonst
    // gewaenne R5 in beiden Formen und der Unterschied bliebe unsichtbar. Genau
    // an dieser Stelle wuerde eine echte neue Regel auch stehen.
    const neueRegel: TodoRegel = {
      id: 'r26', reihenfolge: 65, beschreibung: 'R26 · spaeter ergaenzt',
      strang: 'nachforderung',
      bedingung: { feldId: feld('AAE'), op: 'gefuellt' },
      todo: 'Frisch erfunden', zustaendig: ['ab'], aktiv: true,
    };
    const lage = ctx({ AAR: GESTERN, AAE: GESTERN });

    // Alte Form: S1 nennt die neue Id nicht, die Regel feuert am
    // zurueckgezogenen Antrag — still und ohne dass es jemand saehe.
    expect(ermittleTodo([...altForm(), neueRegel], lage, STICHTAG).todo).toBe('Frisch erfunden');
    // Neue Form: sie gehoert zum Strang und ruht mit ihm.
    expect(ermittleTodo([...baueTodoRegelSeed(), neueRegel], lage, STICHTAG).todo)
      .not.toBe('Frisch erfunden');
  });

  it('eine Regel OHNE Strang bleibt von Strang-Sperren unberuehrt', () => {
    // Die gewollte Lesart — und die Falle, vor der das Detail warnt.
    const ohneStrang: TodoRegel = {
      id: 'r27', reihenfolge: 65, beschreibung: 'R27 · ohne Strang',
      bedingung: { feldId: feld('AAE'), op: 'gefuellt' },
      todo: 'Ohne Strang', zustaendig: ['ab'], aktiv: true,
    };
    const e = ermittleTodo(
      [...baueTodoRegelSeed(), ohneStrang], ctx({ AAR: GESTERN, AAE: GESTERN }), STICHTAG,
    );
    expect(e.gesperrtDurch, 'S1 greift — nur diese Regel eben nicht').toContain('s1');
    expect(e.todo).toBe('Ohne Strang');
  });

  it('gemischte Listen wirken auf beiden Wegen', () => {
    // `sperrt: ['strang:rne', 'r22']` — Strang UND Einzel-Id nebeneinander sind
    // vorgesehen, nicht ein Uebergangszustand.
    const gemischt = baueTodoRegelSeed().map(r => (
      r.id === 's1' ? { ...r, sperrt: ['strang:rne', 'r22'] } : r
    ));
    // RNE-Regel ruht (ueber den Strang) …
    expect(ermittleTodo(gemischt, ctx({ AAR: GESTERN, ART: GESTERN, AVK: GESTERN }), STICHTAG).todo)
      .not.toBe('RNE ergänzen');
    // … r22 ebenfalls (ueber die Id).
    const mitR22 = ermittleTodo(
      gemischt, ctx({ AAR: GESTERN, AN: vorTagen(20), AL: vorTagen(5), AVK: GESTERN }), STICHTAG,
    );
    expect(mitR22.todo).not.toBe('NL prüfen');
  });

  it('sperrtNicht schlaegt auch eine Strang-Sperre', () => {
    const mitAusnahme = baueTodoRegelSeed().map(r => (
      r.id === 's1' ? { ...r, sperrt: ['strang:precheck'], sperrtNicht: ['r1'] } : r
    ));
    const e = ermittleTodo(mitAusnahme, ctx({ AAR: GESTERN, 'PC-': GESTERN }), STICHTAG);
    expect(e.gesperrtDurch).toContain('s1');
    expect(e.todo).toBe('Abl/RNE erstellen');
  });
});

/**
 * Der Fall, der R26–R28 ausgelöst hat — die drei Teilvorhaben von KITED
 * (ZKN125314), Feldlage aus dem Export vom 11.09.2026, Stichtag 12.09.2026.
 *
 * Vorher sagte das Board allen dreien „Stellungnahme RNE prüfen" und die
 * Kopfkarte „3 von 3 Teilvorhaben" — während TV1 die Nachlieferung längst
 * zurück hatte und bei TV2/TV3 der Nachlieferungstermin verstrichen war. Die
 * Aufgabe war seit dem 05.08. erledigt; die Regel konnte das nur nicht sagen.
 */
describe('R26–R28 — KITED, die drei Teilvorhaben', () => {
  const KITED = '2026-09-12T00:00:00.000Z';
  /** Gemeinsame Lage aller drei: RNE raus, Stellungnahme da, NF nachgeschoben. */
  const gemeinsam = {
    ART: '10.06.2026', ARZ: '17.06.2026', ARW: '05.08.2026',
    ALS: '18.08.2026', AT4: '21.08.2026', XALF: '25.08.2026', AN: '25.08.2026',
  };
  const todo = (werte: Record<string, string>): string | null =>
    ermittleTodo(REGELN, ctx({ ...gemeinsam, ...werte }), KITED).todo;

  it('TV1 (16KN125320): Nachlieferung am 31.08. eingegangen → NL prüfen', () => {
    expect(todo({ ALT: '18.08.2026', ALSB: '31.08.2026', AL: '31.08.2026', ANT: '08.09.2026' }))
      .toBe('NL prüfen');
  });

  it('TV2 (16KN125321): Termin 08.09. verstrichen, nichts gekommen → Erinnerung an NF', () => {
    expect(todo({ ALU: '18.08.2026', ALT: '25.08.2026', ANT: '08.09.2026' }))
      .toBe('Erinnerung an NF');
  });

  it('TV3 (16KN125322): Fristverlängerung auf 11.09. — auch die ist durch', () => {
    expect(todo({ ALU: '18.08.2026', ALT: '25.08.2026', ANT: '11.09.2026' }))
      .toBe('Erinnerung an NF');
  });

  it('läuft der Nachlieferungstermin noch, wird gewartet statt erinnert', () => {
    expect(todo({ ANT: '30.09.2026' })).toBe('NF abwarten');
  });

  /**
   * Die Gegenprobe, an der `leer('AN')` als Ausgang gescheitert wäre: 16 der 297
   * Teilvorhaben tragen ein `D_AN` aus einer Runde VOR der Stellungnahme. Für
   * sie bleibt die Prüfung offen.
   */
  it('eine Nachforderung VOR der Stellungnahme lässt R7 stehen', () => {
    expect(todo({ AN: '01.07.2026' })).toBe('Stellungnahme RNE prüfen');
  });
});
