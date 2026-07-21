/**
 * Tests für die Tab-Titel-Formatierung des Bookmarklets (siehe tab-titel.ts).
 *
 * Zwei Ebenen (Muster wie echo-match.test.ts):
 *  1. Verhalten der puren TS-Funktionen.
 *  2. **Drift-Schutz durch Co-Ausführung:** Das Bookmarklet
 *     `bridge-snippet.source.js` spiegelt dieselbe Logik zwischen den
 *     `<tab-titel-core>`-Markern (standalone, `?raw`-Inlining → kein Import).
 *     Dieser Test extrahiert die JS-Fassung und lässt sie gegen dieselben
 *     Fixtures wie die TS-Fassung laufen — jede Divergenz schlägt fehl.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  basisTitel, formatiereLaufzeit, formatiereUmfang, formatiereTabTitel,
  type TabZustandArt, type TabTitelOpts,
} from '../tab-titel';

const BASIS = 'AitisiGPT (BETA)';

describe('basisTitel', () => {
  it('unveränderter Fremdtitel bleibt unverändert', () => {
    expect(basisTitel(BASIS)).toBe(BASIS);
    expect(basisTitel('  Streamlit  ')).toBe('Streamlit');
  });

  it('streift ein gesetztes Status-Präfix wieder ab (alle drei Symbole)', () => {
    expect(basisTitel(`⏳ 0:42 · 1,4k · ${BASIS}`)).toBe(BASIS);
    expect(basisTitel(`✅ Fertig · ${BASIS}`)).toBe(BASIS);
    expect(basisTitel(`⚠️ Zeitüberschreitung · ${BASIS}`)).toBe(BASIS);
  });

  it('idempotent — mehrfach angewandt kein Doppel-Präfix', () => {
    const einmal = formatiereTabTitel('laeuft', BASIS, { seit: 1000, jetzt: 43_000 });
    expect(basisTitel(einmal)).toBe(BASIS);
    // Titel aus dem eigenen Ergebnis zurückgelesen → trotzdem nur EIN Präfix
    expect(formatiereTabTitel('fertig', einmal)).toBe(`✅ Fertig · ${BASIS}`);
  });

  it('Titel mit eigenem „·" bleibt erhalten (kein blindes Kappen)', () => {
    expect(basisTitel('Chat · AitisiGPT')).toBe('Chat · AitisiGPT');
  });

  it('leer/Unsinn → leerer String', () => {
    expect(basisTitel('')).toBe('');
    expect(basisTitel('   ')).toBe('');
  });
});

describe('formatiereLaufzeit', () => {
  it('m:ss mit führender Null bei den Sekunden', () => {
    expect(formatiereLaufzeit(0)).toBe('0:00');
    expect(formatiereLaufzeit(7_000)).toBe('0:07');
    expect(formatiereLaufzeit(42_000)).toBe('0:42');
    expect(formatiereLaufzeit(60_000)).toBe('1:00');
  });

  it('zweistellige Minuten', () => {
    expect(formatiereLaufzeit(725_000)).toBe('12:05');
    expect(formatiereLaufzeit(3_600_000)).toBe('60:00');
  });

  it('negativ/ungültig → 0:00 (nie eine Rückwärts-Uhr im Tab)', () => {
    expect(formatiereLaufzeit(-5_000)).toBe('0:00');
    expect(formatiereLaufzeit(Number.NaN)).toBe('0:00');
  });
});

describe('formatiereUmfang', () => {
  it('unter 100 Zeichen leer (Denkphase soll nicht flackern)', () => {
    expect(formatiereUmfang(0)).toBe('');
    expect(formatiereUmfang(99)).toBe('');
    expect(formatiereUmfang(100)).toBe('100');
  });

  it('unter 1000 die rohe Zahl', () => {
    expect(formatiereUmfang(860)).toBe('860');
  });

  it('ab 1000 mit einer Nachkommastelle und Komma', () => {
    expect(formatiereUmfang(1_400)).toBe('1,4k');
    expect(formatiereUmfang(1_000)).toBe('1k');
    expect(formatiereUmfang(9_949)).toBe('9,9k');
  });

  it('ab 10k ohne Nachkommastelle', () => {
    expect(formatiereUmfang(12_000)).toBe('12k');
    expect(formatiereUmfang(148_600)).toBe('149k');
  });

  it('negativ/ungültig → leer', () => {
    expect(formatiereUmfang(-10)).toBe('');
    expect(formatiereUmfang(Number.NaN)).toBe('');
  });
});

describe('formatiereTabTitel', () => {
  it('Ruhe gibt den Fremdtitel unverändert zurück', () => {
    expect(formatiereTabTitel('ruhe', BASIS)).toBe(BASIS);
  });

  it('Lauf mit Uhr und Umfang', () => {
    expect(formatiereTabTitel('laeuft', BASIS, { seit: 1_000, jetzt: 43_000, zeichen: 1_400 }))
      .toBe(`⏳ 0:42 · 1,4k · ${BASIS}`);
  });

  it('Lauf in der Denkphase: Uhr ohne Umfang', () => {
    expect(formatiereTabTitel('laeuft', BASIS, { seit: 1_000, jetzt: 8_000, zeichen: 12 }))
      .toBe(`⏳ 0:07 · ${BASIS}`);
  });

  it('Lauf ohne Startzeit zeigt den Text (Selbsttests ohne Poll-Schleife)', () => {
    expect(formatiereTabTitel('laeuft', BASIS, { text: 'Chat-Test läuft…' }))
      .toBe(`⏳ Chat-Test läuft… · ${BASIS}`);
    expect(formatiereTabTitel('laeuft', BASIS)).toBe(`⏳ Arbeitet… · ${BASIS}`);
  });

  it('Fertig und Fehler mit Vorgabe-Text', () => {
    expect(formatiereTabTitel('fertig', BASIS)).toBe(`✅ Fertig · ${BASIS}`);
    expect(formatiereTabTitel('fehler', BASIS)).toBe(`⚠️ Fehler · ${BASIS}`);
    expect(formatiereTabTitel('fehler', BASIS, { text: 'Zeitüberschreitung' }))
      .toBe(`⚠️ Zeitüberschreitung · ${BASIS}`);
  });

  it('leerer Basistitel → kein baumelnder Trenner', () => {
    expect(formatiereTabTitel('fertig', '')).toBe('✅ Fertig');
    expect(formatiereTabTitel('ruhe', '')).toBe('');
  });

  it('Symbol steht vorne (bleibt bei abgeschnittenem Tab sichtbar)', () => {
    for (const art of ['laeuft', 'fertig', 'fehler'] as const) {
      expect(formatiereTabTitel(art, BASIS, { seit: 1, jetzt: 2 })[0]).toMatch(/[⏳✅⚠]/);
    }
  });
});

interface JsTabTitel {
  basisTitel: (s: string) => string;
  formatiereLaufzeit: (ms: number) => string;
  formatiereUmfang: (z: number) => string;
  formatiereTabTitel: (art: string, basis: string, opts?: TabTitelOpts) => string;
}

/**
 * Extrahiert die gespiegelten Funktionen aus dem Bookmarklet-Quelltext
 * (zwischen den `<tab-titel-core>`-Markern) und baut sie als aufrufbare
 * Funktionen. Marker + Funktionsnamen sind vertraglich.
 */
function loadJsTabTitel(): JsTabTitel {
  const jsPath = fileURLToPath(new URL('../bridge-snippet.source.js', import.meta.url));
  const src = readFileSync(jsPath, 'utf-8');
  expect(src).toContain('<tab-titel-core>');
  expect(src).toContain('</tab-titel-core>');
  // Block = die Zeilen ZWISCHEN den Marker-Kommentarzeilen (die Marker selbst
  // stehen in `//`-Kommentaren — mitschneiden ergäbe ungültiges JS).
  const start = src.indexOf('\n', src.indexOf('<tab-titel-core>')) + 1;
  const end = src.lastIndexOf('\n', src.indexOf('</tab-titel-core>'));
  const block = src.slice(start, end);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(
    `${block}\nreturn { basisTitel: basisTitel, formatiereLaufzeit: formatiereLaufzeit,`
    + ` formatiereUmfang: formatiereUmfang, formatiereTabTitel: formatiereTabTitel };`,
  )() as JsTabTitel;
}

describe('tab-titel Drift-Schutz (JS-Bookmarklet ≡ TS-Modul)', () => {
  const js = loadJsTabTitel();

  const titel = ['', '   ', BASIS, 'Streamlit', 'Chat · AitisiGPT',
    `⏳ 0:42 · 1,4k · ${BASIS}`, `✅ Fertig · ${BASIS}`, `⚠️ Zeitüberschreitung · ${BASIS}`];
  const dauern = [0, -5_000, 7_000, 42_000, 60_000, 725_000, 3_600_000, Number.NaN];
  const umfaenge = [0, -10, 99, 100, 860, 1_000, 1_400, 9_949, 12_000, 148_600, Number.NaN];
  const arten: TabZustandArt[] = ['ruhe', 'laeuft', 'fertig', 'fehler'];
  const optionen: TabTitelOpts[] = [
    {},
    { text: 'Chat-Test läuft…' },
    { seit: 1_000, jetzt: 43_000, zeichen: 1_400 },
    { seit: 1_000, jetzt: 8_000, zeichen: 12 },
    { seit: 5_000, jetzt: 1_000, zeichen: 250_000 },
    { seit: 0, jetzt: 99_000, zeichen: 500, text: 'Zeitüberschreitung' },
  ];

  it('basisTitel: JS ≡ TS für alle Fixtures', () => {
    for (const t of titel) expect(js.basisTitel(t)).toBe(basisTitel(t));
  });

  it('formatiereLaufzeit: JS ≡ TS für alle Fixtures', () => {
    for (const ms of dauern) expect(js.formatiereLaufzeit(ms)).toBe(formatiereLaufzeit(ms));
  });

  it('formatiereUmfang: JS ≡ TS für alle Fixtures', () => {
    for (const z of umfaenge) expect(js.formatiereUmfang(z)).toBe(formatiereUmfang(z));
  });

  it('formatiereTabTitel: JS ≡ TS für alle Kombinationen', () => {
    for (const art of arten) {
      for (const t of titel) {
        for (const o of optionen) {
          expect(js.formatiereTabTitel(art, t, o)).toBe(formatiereTabTitel(art, t, o));
        }
      }
    }
  });
});
