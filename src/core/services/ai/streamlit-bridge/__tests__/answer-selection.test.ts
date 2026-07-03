/**
 * Tests für die Bridge-Antwort-Auswahl (Echo-Anker, Bug-Klasse 10).
 *
 * Zwei Ebenen:
 *  1. Verhalten der pure TS-Funktion `selectAnswer`/`selectAnswerIndex` gegen die
 *     BELEGTEN DOM-Roster aus der Changelog-Historie (v2.157.1 → v2.159.4).
 *  2. **Drift-Schutz durch Co-Ausführung:** Das Bookmarklet
 *     `bridge-snippet.source.js` muss standalone bleiben (`?raw`-Inlining → kein
 *     Import), daher lebt dieselbe Logik dort gespiegelt zwischen den
 *     `<answer-selection-core>`-Markern. Dieser Test EXTRAHIERT die JS-Funktion und
 *     lässt sie gegen dieselben Flag-Fixtures wie die TS-Fassung laufen — jede
 *     Divergenz (jemand ändert nur eine Seite) schlägt fehl. Das ist die im
 *     Phasen-Prompt geforderte „beide Implementierungen gegen dieselben Fixtures"-
 *     Variante; ein reiner Text-Anker wäre schwächer.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { selectAnswer, selectAnswerIndex, type RosterMsg } from '../answer-selection';

const u = (text: string): RosterMsg => ({ isUser: true, text });
const a = (text: string): RosterMsg => ({ isUser: false, text });

describe('selectAnswer (Echo-Anker)', () => {
  it('v2.159.4-Fall: [Begrüßung, Prompt, Antwort, Folge-Begrüßung] → die Antwort (Index 2)', () => {
    const roster = [a('Hallo, wie kann ich helfen?'), u('Meine Frage'), a('Die Antwort'), a('Kann ich sonst helfen?')];
    expect(selectAnswerIndex(roster.map(m => m.isUser))).toBe(2);
    expect(selectAnswer(roster)?.text).toBe('Die Antwort');
  });

  it('Normalfall: [Begrüßung, Prompt, Antwort] → die Antwort (Index 2)', () => {
    const roster = [a('Begrüßung'), u('Meine Frage'), a('Die Antwort')];
    expect(selectAnswerIndex(roster.map(m => m.isUser))).toBe(2);
    expect(selectAnswer(roster)?.text).toBe('Die Antwort');
  });

  it('v2.159.1-Race: [Begrüßung] (Antwort noch nicht gerendert) → null, NICHT die Begrüßung', () => {
    const roster = [a('Begrüßung')];
    expect(selectAnswer(roster)).toBeNull();
  });

  it('Prompt-Echo nicht gefunden (kein User im Roster) → null statt raten', () => {
    const roster = [a('Begrüßung'), a('noch eine System-Nachricht')];
    expect(selectAnswerIndex(roster.map(m => m.isUser))).toBe(-1);
    expect(selectAnswer(roster)).toBeNull();
  });

  it('Antwort noch nicht da: [Begrüßung, Prompt] (Echo = letzte Nachricht) → null', () => {
    const roster = [a('Begrüßung'), u('Meine Frage')];
    expect(selectAnswer(roster)).toBeNull();
  });

  it('Chat-Modus mit Verlauf: Antwort = erste Assistant-Nachricht nach der LETZTEN User-Nachricht', () => {
    // [a, u, a, u, a, a] — letzter User bei 3, erste Nicht-User danach bei 4
    // (die a bei Index 2 ist eine ältere Antwort, die a bei 5 eine Folge-Begrüßung).
    const roster = [a('alt-begr'), u('erste Frage'), a('alte Antwort'), u('zweite Frage'), a('neue Antwort'), a('folge')];
    expect(selectAnswerIndex(roster.map(m => m.isUser))).toBe(4);
    expect(selectAnswer(roster)?.text).toBe('neue Antwort');
  });

  it('leeres Roster → null', () => {
    expect(selectAnswer([])).toBeNull();
    expect(selectAnswerIndex([])).toBe(-1);
  });
});

/**
 * Extrahiert die gespiegelte `selectAnswerIndex`-Funktion aus dem Bookmarklet-
 * Quelltext (zwischen den `<answer-selection-core>`-Markern) und baut sie als
 * aufrufbare Funktion. Deterministisch — Marker + Funktionsname sind vertraglich.
 */
function loadJsSelectAnswerIndex(): (flags: boolean[]) => number {
  const jsPath = fileURLToPath(new URL('../bridge-snippet.source.js', import.meta.url));
  const src = readFileSync(jsPath, 'utf-8');
  // Sicherstellen, dass die Sync-Marker (Doku-Vertrag) noch da sind …
  expect(src).toContain('<answer-selection-core>');
  expect(src).toContain('</answer-selection-core>');
  // … und die Funktion per Deklaration extrahieren (2-Space-Close `\n  }` = das
  // Funktionsende; die inneren for-Blöcke schließen 4-space-indentiert).
  const m = src.match(/function selectAnswerIndex\(flags\) \{[\s\S]*?\n {2}\}/);
  if (!m) throw new Error('selectAnswerIndex im Bookmarklet nicht gefunden (Drift-Test kann nicht prüfen)');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(`${m[0]}\nreturn selectAnswerIndex;`)() as (flags: boolean[]) => number;
}

describe('answer-selection Drift-Schutz (JS-Bookmarklet ≡ TS-Modul)', () => {
  const jsSelectAnswerIndex = loadJsSelectAnswerIndex();

  // Flag-Fixtures (true = User): die belegten Fälle PLUS erschöpfende kurze Kombis.
  const flagFixtures: boolean[][] = [
    [false, true, false, false], // v2.159.4
    [false, true, false],        // Normalfall
    [false],                     // Race
    [false, false],              // kein User
    [false, true],               // Echo = letzte
    [false, true, false, true, false, false], // Chat-Verlauf
    [],                          // leer
    [true],                      // nur User
    [true, false],               // User dann Antwort
    [false, false, true, false], // Antwort direkt nach spätem Echo
  ];

  it('JS- und TS-selectAnswerIndex liefern für alle Fixtures denselben Index', () => {
    for (const flags of flagFixtures) {
      expect(jsSelectAnswerIndex(flags)).toBe(selectAnswerIndex(flags));
    }
  });

  it('erschöpfend: alle Roster-Längen 0..8 (alle Kombinationen) — JS ≡ TS', () => {
    for (let n = 0; n <= 8; n++) {
      for (let mask = 0; mask < (1 << n); mask++) {
        const flags = Array.from({ length: n }, (_, i) => (mask & (1 << i)) !== 0);
        expect(jsSelectAnswerIndex(flags)).toBe(selectAnswerIndex(flags));
      }
    }
  });
});
