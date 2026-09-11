/**
 * **Was in der Zeile steht** — die fünf Zustände von {@link aufgabenAnzeige}.
 *
 * Die Anzeige ist die Stelle, an der aus einem Kaskaden-Ergebnis ein Satz für
 * einen Menschen wird. Jeder Zustand behauptet etwas anderes, und der teuerste
 * Fehler ist der leiseste: eine erfundene Handlung dort, wo die Kaskade nur
 * schweigt.
 */
import { describe, it, expect } from 'vitest';
import { ROLLEN } from '../rollen';
import type { Rolle } from '../typen';
import type { TodoErgebnis } from '../todo-engine';
import { baueAufgabe, type TvTodo } from '../aufgabe';
import { AUSSERHALB_LAUF_NEBEN, aufgabenAnzeige, regelTraf } from '../aufgaben-anzeige';

function erg(p: Partial<TodoErgebnis> = {}): TodoErgebnis {
  return {
    todo: null, regelId: null, beschreibung: null, zustaendig: [], wartetAuf: null,
    belege: [], gesperrtDurch: [], weitereTreffer: [], quelle: 'regel', ...p,
  };
}

function tv(aktenzeichen: string, je: Partial<Record<Rolle, TodoErgebnis>> = {}): TvTodo {
  const todos = {} as Record<Rolle, TodoErgebnis>;
  for (const r of ROLLEN) todos[r] = je[r] ?? erg();
  return { aktenzeichen, todos };
}

/** R19 aus dem Seed: „in QS" wartet auf die QS und nennt den FB nicht. */
const IN_QS = {
  ab: erg({ todo: 'in QS', regelId: 'r19', beschreibung: 'R19 · beide Teile fertig', wartetAuf: 'qs' }),
};

const RUECKFALL = 'Gutachten freigeben';

describe('aufgabenAnzeige — fünf Zustände, jeder mit seiner Herkunft', () => {
  it('zeigt während des Laufs einen Platzhalter, nie den Rückfall', () => {
    // Ein Text, der sich nach fünf Sekunden in einen anderen verwandelt, wäre
    // schlimmer als einer, der auf sich warten lässt.
    const a = aufgabenAnzeige({ aufgabe: null, rueckfall: RUECKFALL, laeuftNoch: true });
    expect(a.quelle).toBe('laedt');
    expect(a.text).toBe('…');
  });

  it('fällt auf die Status-Formel zurück, wenn gar nichts vorliegt', () => {
    const a = aufgabenAnzeige({ aufgabe: null, rueckfall: RUECKFALL, laeuftNoch: false });
    expect(a.quelle).toBe('rueckfall');
    expect(a.text).toBe(RUECKFALL);
  });

  it('sagt beim Rückfall außerhalb des Bestandslaufs, warum die Kaskade fehlt', () => {
    // Ohne diese Nebenzeile läse sich die Status-Formel einer 2015er-Zeile wie
    // eine Kaskaden-Aussage (Pitfall #46).
    const a = aufgabenAnzeige({ aufgabe: null, rueckfall: RUECKFALL, laeuftNoch: false, ausserhalbLauf: true });
    expect(a.quelle).toBe('rueckfall');
    expect(a.text).toBe(RUECKFALL);
    expect(a.neben).toBe(AUSSERHALB_LAUF_NEBEN);
    expect(a.titel).toContain('nur die aktuelle und die vorige Richtlinie');
  });

  it('nennt die eigene Aufgabe mit ihrer Adresse', () => {
    const aufgabe = baueAufgabe({
      jeTv: [tv('A1', { ab: erg({ todo: 'GA schreiben', regelId: 'r21', zustaendig: ['ab'] }) })],
      rolle: 'ab', ohneRegeln: false,
    });
    const a = aufgabenAnzeige({ aufgabe, rueckfall: RUECKFALL, laeuftNoch: false });
    expect(a.quelle).toBe('kaskade');
    expect(a.text).toBe('GA schreiben');
    expect(a.neben).toBe('liegt bei AB');
    expect(regelTraf(a.quelle)).toBe(true);
  });

  it('markiert eine Aussage aus dem Bestand vor dem Import als vorläufig', () => {
    // Nach einer Datenaktualisierung steht der alte Stand, bis neu gerechnet ist
    // — mit Vermerk, damit er sich nicht als frische Aussage liest.
    const aufgabe = baueAufgabe({
      jeTv: [tv('A1', { ab: erg({ todo: 'GA schreiben', regelId: 'r21', zustaendig: ['ab'] }) })],
      rolle: 'ab', ohneRegeln: false,
    });
    const a = aufgabenAnzeige({ aufgabe, rueckfall: RUECKFALL, laeuftNoch: true, vorlaeufig: true });
    expect(a.vorlaeufig).toBe(true);
    expect(a.quelle).toBe('kaskade');
    expect(a.text).toBe('GA schreiben');
    expect(a.titel).toContain('Stand vor der letzten Datenaktualisierung');
    // Ohne Vermerk bleibt das Feld weg — die Leser fragen es auf Wahrheit ab.
    expect(aufgabenAnzeige({ aufgabe, rueckfall: RUECKFALL, laeuftNoch: false }).vorlaeufig).toBeUndefined();
  });

  it('eine Zeile ohne alten Stand wartet weiter mit dem Platzhalter', () => {
    // Ein Aktenzeichen, das erst der Import gebracht hat, steht im alten Register
    // nicht — dort gibt es nichts, was vorläufig stehen bleiben könnte.
    const a = aufgabenAnzeige({ aufgabe: null, rueckfall: RUECKFALL, laeuftNoch: true, vorlaeufig: true });
    expect(a.quelle).toBe('laedt');
    expect(a.text).toBe('…');
    expect(a.vorlaeufig).toBeUndefined();
  });

  it('zeigt eine fremde Aufgabe als Auskunft statt einer erfundenen Handlung', () => {
    // Der gemeldete Fall: der FB las „Gutachten freigeben", während das
    // Gutachten längst in der QS lag.
    const aufgabe = baueAufgabe({ jeTv: [tv('A1', IN_QS)], rolle: 'fb', ohneRegeln: false });
    const a = aufgabenAnzeige({ aufgabe, rueckfall: RUECKFALL, laeuftNoch: false });
    expect(a.quelle).toBe('fremd');
    expect(a.text).toBe('in QS');
    expect(a.neben).toBe('wartet auf QS');
    expect(a.text).not.toBe(RUECKFALL);
    // Eine Regel traf — nur eben eine fremde. Die Spalte darf die Zeile deshalb
    // nicht wie einen leeren Fall behandeln.
    expect(regelTraf(a.quelle)).toBe(true);
  });

  it('meldet eine greifende Sperre — und nicht in der Begleitphase', () => {
    const aufgabe = baueAufgabe({
      jeTv: [tv('A1', { ab: erg({ gesperrtDurch: ['s0'] }) })], rolle: 'ab', ohneRegeln: false,
    });
    const regeln = [{ id: 's0', beschreibung: 'S0 · Verfahren abgeschlossen' }] as never;
    const offen = aufgabenAnzeige({ aufgabe, rueckfall: RUECKFALL, laeuftNoch: false, regeln });
    expect(offen.quelle).toBe('gesperrt');
    expect(offen.text).toBe('Keine Aufgabe mehr');
    expect(offen.neben).toContain('S0');

    // Ein bewilligter Antrag trägt naturgemäß einen Bescheid — dort ist die
    // Sperre keine Nachricht.
    const bewilligt = aufgabenAnzeige({
      aufgabe, rueckfall: RUECKFALL, laeuftNoch: false, regeln, status: 'bewilligt',
    });
    expect(bewilligt.quelle).not.toBe('gesperrt');
  });

  it('behält den Rückfall, wo auch der AB-Satz schweigt — nie unter heute zurück', () => {
    const aufgabe = baueAufgabe({ jeTv: [tv('A1')], rolle: 'fb', ohneRegeln: false });
    const a = aufgabenAnzeige({ aufgabe, rueckfall: RUECKFALL, laeuftNoch: false });
    expect(a.quelle).toBe('rueckfall');
    expect(a.text).toBe(RUECKFALL);
  });

  it('gibt die Faltung zu erkennen, auch bei einer fremden Aufgabe', () => {
    const aufgabe = baueAufgabe({
      jeTv: [tv('A1', IN_QS), tv('A2', { ab: erg({ todo: 'GA schreiben', regelId: 'r21' }) })],
      rolle: 'fb', ohneRegeln: false,
    });
    const a = aufgabenAnzeige({ aufgabe, rueckfall: RUECKFALL, laeuftNoch: false });
    expect(a.quelle).toBe('fremd');
    expect(a.anteil).toBe('1 von 2 TV');
    expect(a.titel).toContain('GA schreiben');
  });
});
