/**
 * Tests für die Modell-Zuordnung und die Kontextfenster-Ablesung (siehe
 * modell-erkennung.ts).
 *
 * Zwei Ebenen (Muster wie echo-match.test.ts):
 *  1. Verhalten der puren TS-Funktionen `passtZuModell`/`leseKontextTokens`.
 *  2. **Drift-Schutz durch Co-Ausführung:** Das Bookmarklet
 *     `bridge-snippet.source.js` spiegelt dieselbe Logik zwischen den
 *     `<modell-erkennung-core>`-Markern (standalone, `?raw`-Inlining → kein
 *     Import). Dieser Test extrahiert die JS-Fassung und lässt sie gegen
 *     dieselben Fixtures laufen — jede Divergenz schlägt fehl.
 *
 * Die Fixtures sind die ECHTEN Options-Texte und -Values aus dem
 * Produktiv-Dump (2026-08-21), nicht erfundene Beispiele.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { passtZuModell, leseKontextTokens } from '../modell-erkennung';

/** Options-Texte, wie die interne KI sie anzeigt. */
const TEXTE = ['gpt-oss-120b', 'Qwen3.6-35B', 'Qwen3-VL-30B (multimodal)'] as const;
/** Die zugehörigen `value`-Attribute (Dateinamen samt Quantisierung). */
const VALUES = [
  'gpt-oss-120b-mxfp4-00001-of-00003.gguf',
  'Qwen3.6-35B-A3B-UD-Q4_K_M.gguf',
  'Qwen3-VL-30B-A3B-Instruct-Q4_K_M.gguf',
] as const;

describe('passtZuModell', () => {
  it('trifft gpt-oss über Text und value', () => {
    expect(passtZuModell('gpt-oss', 'gpt-oss-120b')).toBe(true);
    expect(passtZuModell('gpt-oss', VALUES[0])).toBe(true);
  });

  it('trifft Qwen3.6 über Text und value', () => {
    expect(passtZuModell('qwen35', 'Qwen3.6-35B')).toBe(true);
    expect(passtZuModell('qwen35', VALUES[1])).toBe(true);
  });

  it('lehnt das multimodale Qwen3-VL für JEDES Ziel ab', () => {
    // Der Kern des Ganzen: VL hat 62k wie gpt-oss. Träfe eine tolerante
    // qwen3-Regel hier, führte der Auto-Wechsel ins kleine Fenster zurück.
    expect(passtZuModell('qwen35', 'Qwen3-VL-30B (multimodal)')).toBe(false);
    expect(passtZuModell('qwen35', VALUES[2])).toBe(false);
    expect(passtZuModell('gpt-oss', 'Qwen3-VL-30B (multimodal)')).toBe(false);
  });

  it('jeder Options-Text trifft genau EIN Ziel — und VL keines', () => {
    const treffer = TEXTE.map(t => (['gpt-oss', 'qwen35'] as const).filter(z => passtZuModell(z, t)));
    expect(treffer[0]).toEqual(['gpt-oss']);
    expect(treffer[1]).toEqual(['qwen35']);
    expect(treffer[2]).toEqual([]);
  });

  it('unbekanntes Ziel und leerer Text → false', () => {
    expect(passtZuModell('agentisch', 'gpt-oss-120b')).toBe(false);
    expect(passtZuModell('gpt-oss', '')).toBe(false);
    expect(passtZuModell('', '')).toBe(false);
  });

  it('überlebt Schreibweisen-Varianten des Trenners', () => {
    expect(passtZuModell('gpt-oss', 'GPT OSS 120B')).toBe(true);
    expect(passtZuModell('qwen35', 'qwen 3_6-35b')).toBe(true);
    // Qwen3 OHNE .6 ist ein anderes Modell — kein Treffer auf Verdacht.
    expect(passtZuModell('qwen35', 'Qwen3-32B')).toBe(false);
  });
});

describe('leseKontextTokens', () => {
  it('liest die Chatlängen-Anzeige der Seite', () => {
    expect(leseKontextTokens('Chatlänge [Token]: 0k von 62k')).toBe(62000);
    expect(leseKontextTokens('Chatlänge [Token]: 12k von 259k')).toBe(259000);
  });

  it('kommt ohne k-Einheit und mit deutschem Tausenderpunkt zurecht', () => {
    expect(leseKontextTokens('von 62000')).toBe(62000);
    expect(leseKontextTokens('von 259.000')).toBe(259000);
    expect(leseKontextTokens('von 1,5k')).toBe(1500);
  });

  it('nicht lesbar → 0 (Aufrufer bleibt beim Rückfallwert)', () => {
    expect(leseKontextTokens('')).toBe(0);
    expect(leseKontextTokens('Chatlänge unbekannt')).toBe(0);
    expect(leseKontextTokens('von 0k')).toBe(0);
  });
});

/**
 * Extrahiert die gespiegelten Funktionen aus dem Bookmarklet-Quelltext
 * (zwischen den `<modell-erkennung-core>`-Markern). Marker + Funktionsnamen
 * sind vertraglich.
 */
function loadJsModellErkennung(): {
  passtZuModell: (ziel: string, text: string) => boolean;
  leseKontextTokens: (text: string) => number;
} {
  const jsPath = fileURLToPath(new URL('../bridge-snippet.source.js', import.meta.url));
  const src = readFileSync(jsPath, 'utf-8');
  expect(src).toContain('<modell-erkennung-core>');
  expect(src).toContain('</modell-erkennung-core>');
  // Block = die Zeilen ZWISCHEN den Marker-Kommentarzeilen (die Marker selbst
  // stehen in `//`-Kommentaren — mitschneiden ergäbe ungültiges JS).
  const start = src.indexOf('\n', src.indexOf('<modell-erkennung-core>')) + 1;
  const end = src.lastIndexOf('\n', src.indexOf('</modell-erkennung-core>'));
  const block = src.slice(start, end);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(
    `${block}\nreturn { passtZuModell: passtZuModell, leseKontextTokens: leseKontextTokens };`,
  )() as ReturnType<typeof loadJsModellErkennung>;
}

describe('modell-erkennung Drift-Schutz (JS-Bookmarklet ≡ TS-Modul)', () => {
  const js = loadJsModellErkennung();

  const texte = [
    ...TEXTE, ...VALUES,
    '', 'GPT OSS 120B', 'qwen 3_6-35b', 'Qwen3-32B', 'Qwen3-VL-30B',
    'irgendein anderes Modell', 'multimodal',
  ];
  const ziele = ['gpt-oss', 'qwen35', 'agentisch', 'standard', ''];

  it('passtZuModell: JS ≡ TS für alle Paar-Kombinationen', () => {
    for (const z of ziele) {
      for (const t of texte) {
        expect(js.passtZuModell(z, t)).toBe(passtZuModell(z, t));
      }
    }
  });

  it('leseKontextTokens: JS ≡ TS für alle Fixtures', () => {
    const anzeigen = [
      'Chatlänge [Token]: 0k von 62k', 'Chatlänge [Token]: 12k von 259k',
      'von 62000', 'von 259.000', 'von 1,5k', 'von 0k', '', 'Chatlänge unbekannt',
      'von 2m', 'Chatlänge [Token]: 61k von 62k',
    ];
    for (const a of anzeigen) {
      expect(js.leseKontextTokens(a)).toBe(leseKontextTokens(a));
    }
  });
});
