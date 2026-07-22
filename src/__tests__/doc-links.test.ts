/**
 * Link-Guard für die dauerhaft gepflegten Marker-Docs.
 *
 * Prüft, dass alle relativen Markdown-Links in der Wurzel-CLAUDE.md, der
 * Agent-README und den verschachtelten CLAUDE.md auf existierende Dateien
 * zeigen (Anker-Fragmente abgeschnitten, externe URLs ignoriert). Die
 * generierte, gitignorete `code-map.md` ist whitelisted (der precheck-Hook
 * erzeugt sie; auf einem frischen Checkout darf sie fehlen).
 *
 * Bewusst NICHT in codebase-conventions.test.ts (die steht an ihrem
 * MAX_FILE_LOC-Limit).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const DOC_FILES = [
  'CLAUDE.md',
  'docs/agents/README.md',
  'src/plugins/auslastung/CLAUDE.md',
  'src/core/services/assistent/CLAUDE.md',
  'src/plugins/antraege/CLAUDE.md',
];

// Generierte, gitignorete Dateien: dürfen fehlen (precheck-Hook erzeugt sie).
const GENERATED_WHITELIST = new Set(['docs/architecture/code-map.md']);

function extractHrefs(md: string): string[] {
  const re = /\[[^\]]*\]\(([^)\s]+)\)/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

function stripAnchor(href: string): string {
  return href.split('#')[0] ?? '';
}

function isRelativeDocLink(href: string): boolean {
  if (/^(https?:|mailto:)/i.test(href)) return false;
  return stripAnchor(href).length > 0; // reine #anchor-Links ignorieren
}

describe('doc-links', () => {
  for (const docRel of DOC_FILES) {
    it(`alle relativen Links in ${docRel} zeigen auf existierende Dateien`, () => {
      const abs = resolve(ROOT, docRel);
      const md = readFileSync(abs, 'utf8');
      const dir = dirname(abs);
      const broken: string[] = [];
      for (const href of extractHrefs(md)) {
        if (!isRelativeDocLink(href)) continue;
        const targetAbs = resolve(dir, stripAnchor(href));
        const rootRel = targetAbs.slice(ROOT.length + 1).split('\\').join('/');
        if (GENERATED_WHITELIST.has(rootRel)) continue;
        if (!existsSync(targetAbs)) broken.push(`${href} → ${rootRel}`);
      }
      expect(broken, `Kaputte Links in ${docRel}:\n${broken.join('\n')}`).toEqual([]);
    });
  }

  it('Root-CLAUDE.md bleibt unter dem Diät-Ceiling (Regressions-Guard)', () => {
    const bytes = statSync(resolve(ROOT, 'CLAUDE.md')).size;
    // Phase 4 „CLAUDE.md-Diät": von ~68 KB auf ~44 KB. Ceiling fängt eine
    // Rückkehr Richtung Alt-Größe; bei bewusstem Wachstum hier anheben.
    // 47_000 → 47_500 (v2.271): Abschnitt „MAP-Förderfähigkeitsprüfung" + eine
    // Zeile im Decision-Tree. Der Eintrag ist bereits auf zwei harte Regeln plus
    // Themen-Doc-Link eingedampft — kürzer wäre er nutzloser als seine Nachbarn.
    // 47_500 → 47_700 (v2.296): eine Decision-Tree-Zeile für die Skill-Vorgaben
    // (wo Umfang & Form leben, seit sie nicht mehr Regel-Bibliothek sind). Bereits
    // auf Stichwort + Doc-Link gekürzt; ohne Zeile fände sie niemand.
    expect(bytes).toBeLessThan(47_700);
  });
});
