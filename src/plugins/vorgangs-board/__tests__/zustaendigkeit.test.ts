/**
 * Die Zusage der Vierteilung: **die vier Zahlen addieren sich zur Gesamtmenge.**
 *
 * Das war der Defekt der alten Reiterleiste — dort standen eine Partition, eine
 * Risiko-Teilmenge und die Gesamtmenge nebeneinander, und „Kein To-do ermittelt
 * 3.101" las sich als Rückstand, obwohl 2.994 davon abgeschlossene Verfahren
 * waren. Jede Sorte hat jetzt ihre eigene Zahl.
 */
import { describe, it, expect } from 'vitest';
import {
  istArbeitsvorrat, schalteZustaendigkeit, zustaendigkeitVon,
  ZUSTAENDIGKEIT_DEFAULT, ZUSTAENDIGKEITEN,
} from '../zustaendigkeit';
import type { Rolle, TodoErgebnis } from '@/core/status';

function ergebnis(p: Partial<TodoErgebnis>): TodoErgebnis {
  return {
    todo: null, regelId: null, beschreibung: null, zustaendig: [], wartetAuf: null,
    belege: [], gesperrtDurch: [], weitereTreffer: [], quelle: 'regel', ...p,
  } as TodoErgebnis;
}

describe('zustaendigkeitVon', () => {
  it('trennt die Regel-Lücke vom abgeschlossenen Verfahren', () => {
    // Beides „kein To-do", aber das eine ist ein Mangel und das andere ein
    // Ergebnis. Zusammengeworfen war der größte Zähler des Boards zu 96 %
    // falsch beschriftet.
    expect(zustaendigkeitVon(ergebnis({}), 'ab')).toBe('ohne');
    expect(zustaendigkeitVon(ergebnis({ gesperrtDurch: ['s0'] }), 'ab')).toBe('fertig');
  });

  it('teilt nach der gewählten Rolle in eigene und fremde Arbeit', () => {
    const e = ergebnis({ todo: 'ZuwB erstellen', zustaendig: ['ab'] });
    expect(zustaendigkeitVon(e, 'ab')).toBe('meine');
    expect(zustaendigkeitVon(e, 'fb' as Rolle)).toBe('warten');
  });

  it('zählt ohne Rollenwahl alles Zuständige als eigene Arbeit', () => {
    // Sonst wäre der Arbeitsvorrat für einen Nutzer ohne gesetzte Rolle leer.
    expect(zustaendigkeitVon(ergebnis({ todo: 'x', zustaendig: ['qs'] }), 'alle')).toBe('meine');
    expect(zustaendigkeitVon(ergebnis({ todo: 'x', zustaendig: [] }), 'alle')).toBe('warten');
  });

  it('macht die vier Teile lückenlos und überschneidungsfrei', () => {
    const faelle = [
      ergebnis({}),
      ergebnis({ gesperrtDurch: ['s0'] }),
      ergebnis({ todo: 'x', zustaendig: ['ab'] }),
      ergebnis({ todo: 'x', zustaendig: ['fb'] }),
    ];
    const treffer = faelle.map(e => zustaendigkeitVon(e, 'ab'));
    expect(new Set(treffer).size).toBe(4);
    expect(treffer.every(t => ZUSTAENDIGKEITEN.includes(t))).toBe(true);
  });

  it('zählt eine gesperrte Zeile MIT To-do als Arbeit — die Ausnahme lebt', () => {
    // S0b lässt r3 („ZuwB erstellen") überleben. Wer allein auf `gesperrtDurch`
    // schaut, verlöre die Aufgabe.
    const e = ergebnis({ todo: 'ZuwB erstellen', zustaendig: ['ab'], gesperrtDurch: ['s0b'] });
    expect(zustaendigkeitVon(e, 'ab')).toBe('meine');
  });
});

describe('schalteZustaendigkeit', () => {
  it('hält die Anzeige-Reihenfolge, egal in welcher Folge geklickt wird', () => {
    expect(schalteZustaendigkeit(['warten'], 'meine')).toEqual(['meine', 'warten']);
  });

  it('nimmt einen gewählten Teil wieder heraus', () => {
    expect(schalteZustaendigkeit(['meine', 'warten'], 'warten')).toEqual(['meine']);
  });

  it('lässt den letzten Chip stehen — eine leere Liste läse sich als „nichts zu tun"', () => {
    expect(schalteZustaendigkeit(['meine'], 'meine')).toEqual(['meine']);
  });
});

describe('istArbeitsvorrat', () => {
  it('erkennt die Vorbelegung unabhängig von der Reihenfolge', () => {
    expect(istArbeitsvorrat([...ZUSTAENDIGKEIT_DEFAULT])).toBe(true);
    expect(istArbeitsvorrat(['warten', 'meine'])).toBe(true);
  });

  it('meldet jede Abweichung — sie braucht den Rückweg', () => {
    expect(istArbeitsvorrat(['meine'])).toBe(false);
    expect(istArbeitsvorrat(['meine', 'warten', 'fertig'])).toBe(false);
  });
});
