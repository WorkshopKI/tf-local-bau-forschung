import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HILFE_BASIS_CSS,
  HILFE_IDS,
  LESE_TOKENS,
  baueGeruestHtml,
  baueHilfeCss,
  baueKopfHtml,
  baueTokenBlock,
  berechneGeometrie,
  externeLinksIsolieren,
  fensterFeatures,
  fensterTitel,
  hilfeAlsHtml,
  hinweisText,
  machtUrlsAbsolut,
} from '../hilfeFensterDokument';

/** `src/` — von `src/components/help/__tests__/` drei Ebenen hoch. */
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('hilfeAlsHtml', () => {
  it('rendert Markdown wie der Dialog', () => {
    const html = hilfeAlsHtml('## Bereiche\n\n- erster Punkt\n- zweiter Punkt');
    expect(html).toContain('<h2');
    expect(html).toContain('<li>erster Punkt</li>');
  });

  it('laeuft wirklich durch sanitizeHtml — kein Script, keine on*-Attribute', () => {
    const html = hilfeAlsHtml('<script>alert(1)</script>\n\n<p onclick="boese()">Text</p>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick=');
  });

  it('isoliert externe Links', () => {
    // Ohne target/rel navigiert ein Klick das Fenster von about:blank weg —
    // danach ist es cross-origin und der Parent kann es nie wieder beschreiben.
    const html = hilfeAlsHtml('[extern](https://example.org/seite)');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('laesst Anker und relative Ziele in Ruhe', () => {
    const html = externeLinksIsolieren('<a href="#abschnitt">dort</a>');
    expect(html).not.toContain('target=');
  });
});

describe('baueTokenBlock', () => {
  it('schreibt genau die Whitelist-Namen in einen :root-Block', () => {
    const block = baueTokenBlock({ '--tf-bg': '#fff', '--tf-text': '#000' });
    expect(block.startsWith(':root {')).toBe(true);
    expect(block.match(/:root/g)).toHaveLength(1);
    expect(block).toContain('--tf-bg: #fff;');
    expect(block).toContain('--tf-text: #000;');
  });

  it('ignoriert unbekannte Namen und leere Werte', () => {
    const block = baueTokenBlock({ '--fremd': 'rot', '--tf-bg': '   ' });
    expect(block).not.toContain('--fremd');
    expect(block).not.toContain('--tf-bg');
  });

  it('verwirft Werte mit CSS-Steuerzeichen', () => {
    const block = baueTokenBlock({ '--tf-bg': 'red} body{display:none' });
    expect(block).not.toContain('display:none');
  });

  it('deckt jedes im CSS benutzte Token ab', () => {
    // Ein `var(--tf-x)` ohne Deklaration im :root-Block faellt im Fenster auf den
    // Browser-Default zurueck — unsichtbar im Code, sichtbar auf dem Schirm.
    const benutzt = new Set(
      [...HILFE_BASIS_CSS.matchAll(/var\((--tf-[a-z0-9-]+)\)/g)].map(m => m[1]!),
    );
    expect([...benutzt].sort()).toEqual(
      [...benutzt].filter(t => (LESE_TOKENS as readonly string[]).includes(t)).sort(),
    );
  });
});

describe('machtUrlsAbsolut', () => {
  it('laesst data:-URLs unangetastet (Single-File-Build)', () => {
    const css = '@font-face{src:url(data:font/woff2;base64,AAA) format("woff2")}';
    expect(machtUrlsAbsolut(css, 'http://localhost:5175/index.html')).toBe(css);
  });

  it('macht relative Pfade absolut (Dev-Server; about:blank hat keine Basis)', () => {
    const css = '@font-face{src:url(./files/geist.woff2)}';
    expect(machtUrlsAbsolut(css, 'http://localhost:5175/app/index.html'))
      .toContain('http://localhost:5175/app/files/geist.woff2');
  });

  it('laesst absolute http-URLs stehen', () => {
    const css = 'src:url("https://cdn.example.org/a.woff2")';
    expect(machtUrlsAbsolut(css, 'http://localhost:5175/')).toBe(css);
  });
});

describe('berechneGeometrie', () => {
  it('dockt rechts an, damit die App links daneben sichtbar bleibt', () => {
    const g = berechneGeometrie({ availWidth: 1920, availHeight: 1080 }, 560);
    expect(g.links).toBe(1920 - 560 - 24);
    expect(g.hoehe).toBe(1000);
  });

  it('respektiert einen zweiten Monitor (availLeft/availTop)', () => {
    const g = berechneGeometrie(
      { availWidth: 1280, availHeight: 800, availLeft: 1920, availTop: 40 },
      560,
    );
    expect(g.links).toBe(1920 + 1280 - 560 - 24);
    expect(g.oben).toBe(64);
  });

  it('rutscht auf schmalen Schirmen nicht aus dem Bild', () => {
    const g = berechneGeometrie({ availWidth: 400, availHeight: 300, availLeft: 0 }, 560);
    expect(g.links).toBeGreaterThanOrEqual(0);
    expect(g.hoehe).toBeGreaterThanOrEqual(400);
  });
});

describe('fensterFeatures', () => {
  it('bittet um ein Popup und traegt KEIN noopener', () => {
    // Mit `noopener` waere das Handle `null` und die ganze Mechanik tot — dieser
    // Test faengt den naechsten gut gemeinten „Sicherheits-Cleanup".
    const f = fensterFeatures({ breite: 560, hoehe: 900, links: 100, oben: 24 });
    expect(f).toContain('popup=yes');
    expect(f).not.toContain('noopener');
    expect(f).not.toContain(' ');
  });
});

describe('fensterTitel', () => {
  it('nennt Seite und App', () => {
    expect(fensterTitel('Vorgangs-Board')).toBe('Hilfe: Vorgangs-Board · TeamFlow');
  });

  it('faellt ohne Titel auf etwas Sinnvolles zurueck', () => {
    expect(fensterTitel('   ')).toBe('Hilfe · TeamFlow');
  });
});

describe('hinweisText', () => {
  it('schweigt, solange das Fenster mitlaeuft', () => {
    expect(hinweisText(false, 'home', 'meilensteine', 'Meilensteine')).toBeNull();
  });

  it('schweigt, wenn festgehalten UND die App auf derselben Seite steht', () => {
    expect(hinweisText(true, 'home', 'home', 'Startseite')).toBeNull();
  });

  it('benennt den festgehaltenen Zustand, statt still die falsche Seite zu zeigen', () => {
    expect(hinweisText(true, 'home', 'meilensteine', 'Meilensteine'))
      .toBe('Festgehalten — die App steht auf „Meilensteine".');
  });

  it('kommt ohne Seitennamen aus', () => {
    expect(hinweisText(true, 'home', 'meilensteine', '')).toContain('einer anderen Seite');
  });
});

describe('Geruest', () => {
  it('traegt alle IDs, die die Steuerung nachschlaegt', () => {
    const html = baueGeruestHtml() + baueKopfHtml('/* x */');
    for (const id of Object.values(HILFE_IDS)) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it('setzt die Zeichenkodierung — Umlaute im Fenstertext', () => {
    expect(baueKopfHtml('')).toContain('charset="utf-8"');
  });

  it('baut das Stylesheet aus Schrift, Tokens und Grundregeln', () => {
    const css = baueHilfeCss({ '--tf-bg': '#fff' }, '@font-face{font-family:X}');
    expect(css).toContain('@font-face{font-family:X}');
    expect(css).toContain('--tf-bg: #fff;');
    expect(css).toContain('main blockquote');
  });
});

describe('Drift-Guard gegen MarkdownRenderer', () => {
  it('stylt jedes Element, das die Dialog-Fassung stylt', () => {
    // Das Fenster kann die Tailwind-`[&_x]:`-Kette nicht benutzen (sie lebt im
    // Bundle des Hauptdokuments) und im Fenster gilt kein Preflight — die Regeln
    // stehen dort darum als Plain-CSS. Dieses Duplikat ist gewollt; was es NICHT
    // sein darf, ist unvollstaendig. Kommt in MarkdownRenderer ein Element dazu,
    // faellt das hier auf statt erst im Fenster.
    const quelle = readFileSync(
      join(SRC, 'components', 'ui', 'MarkdownRenderer.tsx'),
      'utf-8',
    );
    const elemente = new Set(
      [...quelle.matchAll(/\[&_([a-z]+(?:_[a-z]+)*)\]:/g)].map(m => m[1]!.replace(/_/g, ' ')),
    );
    expect(elemente.size).toBeGreaterThan(10);

    const fehlend = [...elemente].filter(
      el => !new RegExp(`(^|,|\\n)\\s*main ${el}[\\s,{:]`, 'm').test(HILFE_BASIS_CSS),
    );
    expect(fehlend, `Ohne Regel im Hilfe-Fenster: ${fehlend.join(', ')}`).toEqual([]);
  });
});
