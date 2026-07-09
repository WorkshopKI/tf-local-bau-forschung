/**
 * Tests für die inhaltsbasierte Echo-Erkennung (Stufe-2-Fallback der
 * Antwort-Auswahl, siehe echo-match.ts).
 *
 * Zwei Ebenen (Muster wie answer-selection.test.ts):
 *  1. Verhalten der puren TS-Funktionen `normForEcho`/`isEchoText`.
 *  2. **Drift-Schutz durch Co-Ausführung:** Das Bookmarklet
 *     `bridge-snippet.source.js` spiegelt dieselbe Logik zwischen den
 *     `<echo-match-core>`-Markern (standalone, `?raw`-Inlining → kein Import).
 *     Dieser Test extrahiert die JS-Fassung und lässt sie gegen dieselben
 *     Fixtures wie die TS-Fassung laufen — jede Divergenz schlägt fehl.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { normForEcho, isEchoText } from '../echo-match';

describe('normForEcho', () => {
  it('lowercase + Nicht-Alphanumerik raus + 64er-Kappe', () => {
    expect(normForEcho('Was ist **12 + 34**?')).toBe('wasist1234');
    expect(normForEcho('  Hallo\n Welt! ')).toBe('hallowelt');
    expect(normForEcho('x'.repeat(200))).toHaveLength(64);
  });

  it('Umlaute bleiben erhalten, auch dekomponiert (NFC)', () => {
    expect(normForEcho('Prüfung ÄÖÜß')).toBe('prüfungäöüß');
    // dekomponiertes ü (u + combining diaeresis U+0308) → NFC → ü
    expect(normForEcho('Pru\u0308fung')).toBe(normForEcho('Pr\u00FCfung'));
  });

  it('leer/nur Sonderzeichen → leerer String', () => {
    expect(normForEcho('')).toBe('');
    expect(normForEcho('*** !!! ---')).toBe('');
  });
});

describe('isEchoText', () => {
  const prompt = 'Erstelle bitte die Kurzfassung des Gutachtens für den Verbund Bio-Inkjet.';

  it('exaktes Echo → true', () => {
    expect(isEchoText(prompt, prompt)).toBe(true);
  });

  it('Markdown-gerendertes Echo (Fettung/Whitespace-Reflow) → true', () => {
    expect(isEchoText('Erstelle  bitte die **Kurzfassung** des Gutachtens\nfür den Verbund Bio-Inkjet.', prompt)).toBe(true);
  });

  it('Antwort, die den Prompt nur MITTEN im Text erwähnt → false (Prefix, kein Substring)', () => {
    expect(isEchoText(`Gern! Deine Anfrage „${prompt}" habe ich verstanden.`, prompt)).toBe(false);
  });

  it('langer Prompt (> 64 normalisierte Zeichen): Prefix-Match reicht', () => {
    const long = prompt + ' Bitte beachte außerdem die folgenden zwanzig Detail-Vorgaben im Anhang.';
    // Nachricht enthält nur den Anfang (z. B. gekürztes Echo) → Kappe macht beide vergleichbar
    expect(isEchoText(long, long)).toBe(true);
    expect(isEchoText(long + ' …und noch ein abweichender Schwanz', long)).toBe(true);
  });

  it('kurzer Prompt (< 12 normalisiert) verlangt exakte Gleichheit', () => {
    expect(isEchoText('Was ist 12 + 34?', 'Was ist 12 + 34?')).toBe(true);
    // Antwort enthält die Frage als Präfix + mehr → KEIN Echo (sonst matcht die Antwort)
    expect(isEchoText('Was ist 12 + 34? Das ergibt 46.', 'Was ist 12 + 34?')).toBe(false);
    expect(isEchoText('Ja, gern!', 'Ja')).toBe(false);
  });

  it('leerer Prompt → nie Echo', () => {
    expect(isEchoText('irgendwas', '')).toBe(false);
    expect(isEchoText('', '')).toBe(false);
  });
});

/**
 * Extrahiert die gespiegelten Funktionen aus dem Bookmarklet-Quelltext
 * (zwischen den `<echo-match-core>`-Markern) und baut sie als aufrufbare
 * Funktionen. Marker + Funktionsnamen sind vertraglich.
 */
function loadJsEchoMatch(): { normForEcho: (s: string) => string; isEchoText: (m: string, p: string) => boolean } {
  const jsPath = fileURLToPath(new URL('../bridge-snippet.source.js', import.meta.url));
  const src = readFileSync(jsPath, 'utf-8');
  expect(src).toContain('<echo-match-core>');
  expect(src).toContain('</echo-match-core>');
  // Block = die Zeilen ZWISCHEN den Marker-Kommentarzeilen (die Marker selbst
  // stehen in `//`-Kommentaren — mitschneiden ergäbe ungültiges JS).
  const start = src.indexOf('\n', src.indexOf('<echo-match-core>')) + 1;
  const end = src.lastIndexOf('\n', src.indexOf('</echo-match-core>'));
  const block = src.slice(start, end);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(
    `${block}\nreturn { normForEcho: normForEcho, isEchoText: isEchoText };`,
  )() as ReturnType<typeof loadJsEchoMatch>;
}

describe('echo-match Drift-Schutz (JS-Bookmarklet ≡ TS-Modul)', () => {
  const js = loadJsEchoMatch();

  const strings = [
    '', 'Ja', 'Was ist 12 + 34?', 'Was ist 12 + 34? Das ergibt 46.',
    'Erstelle bitte die Kurzfassung des Gutachtens für den Verbund Bio-Inkjet.',
    'Erstelle  bitte die **Kurzfassung** des Gutachtens\nfür den Verbund Bio-Inkjet.',
    'Prüfung ÄÖÜß', 'Prüfung', '*** !!! ---', 'x'.repeat(200),
    'Gern! Deine Anfrage habe ich verstanden.',
  ];

  it('normForEcho: JS ≡ TS für alle Fixtures', () => {
    for (const s of strings) {
      expect(js.normForEcho(s)).toBe(normForEcho(s));
    }
  });

  it('isEchoText: JS ≡ TS für alle Paar-Kombinationen', () => {
    for (const m of strings) {
      for (const p of strings) {
        expect(js.isEchoText(m, p)).toBe(isEchoText(m, p));
      }
    }
  });
});
