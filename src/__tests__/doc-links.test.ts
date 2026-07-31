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
    // 47_700 → 47_900 (Konsolidierungs-Pass): der Zyklen-Wächter im Entwicklungs-
    // Gate. Ein Gate-Schritt, den `npm run check` fährt, muss dort stehen, sonst
    // ist er beim ersten roten Lauf unerklärlich. Auf Link + einen Satz gekürzt;
    // das Warum lebt im Docstring von scripts/check-cycles.mjs.
    // 47_900 → 48_300 (v2.310): eine Decision-Tree-Zeile für den Textbaustein-
    // Katalog (NF/RNE/ABL als versionierte App-Daten). Bereits auf Stichworte +
    // Doc-Link gekürzt; ohne Zeile fände die Werkbank ihre Datengrundlage nicht.
    // 48_300 → 49_000 (v2.322): eine Decision-Tree-Zeile + Pitfall #40 fürs
    // Status-System (neu) — Katalog/Historie/Ableitung, gerätelokal, snapshot-
    // basiertes getStatusCategory. Bereits auf Stichworte + Doc-Link + zwei harte
    // Regeln gekürzt; das Warum lebt in docs/status-system/.
    // 49_000 → 49_700 (v2.331): eine Decision-Tree-Zeile + Pitfall #41 für die
    // Bearbeitungs-Meilensteine — die zweite Achse neben dem Status (Soll-Wochen,
    // Frist-Prognose, Plan als TEAM-Sidecar statt gerätelokal wie der Status-
    // Katalog). Genau dieser Unterschied ist die Stelle, an der man sich ohne
    // Hinweis vergreift; das Detail lebt in docs/architecture/meilensteine.md.
    // 49_700 → 50_200 (v2.337): EINE Zeile für die Abschnitts-Journey (Ziel-
    // Fallback, auto-angehängter Feinschliff, Abnahme-Kriterien, Vier-Ebenen-
    // Karte). Bereits auf Stichworte + Doc-Link gekürzt — vier Schichten, die
    // den GA-Lauf verhaltensrelevant ändern, ganz zu verschweigen wäre teurer
    // als die Zeile; das Warum lebt in gutachten-kurzfassung.md.
    // 50_200 → 51_200 (v2.345): eine Decision-Tree-Zeile + Pitfall #42 für den
    // Code-Katalog des Fachsystems. Der Katalog wächst von 7 auf ~184 Felder,
    // und drei Regeln daraus greift man ohne Hinweis daneben: `feldId` ist der
    // ROHE Spalten-Code (nicht der Record-Key), `ebene` und `herkunft` sind
    // verschieden, und ein Feld ohne Rang wirkt nicht. Das Detail lebt in
    // docs/status-system/KATALOG-CODES.md.
    // 51_200 → 52_000 (v2.349): Pitfall #43 für die Kürzel-Zuarbeit. Zwei
    // Regeln, die man ohne Hinweis garantiert falsch macht: Bezeichnung und
    // Rolle sind GENERIERTE Fremddaten (wer sie von Hand editiert, verliert sie
    // beim nächsten Lauf), und ein leeres Rollen-Array heißt „jeder darf",
    // nicht „niemand" — die umgekehrte Lesart blendet 143 von 505 Codes
    // überall aus. Das Detail lebt in docs/status-system/KATALOG-CODES.md.
    // 52_000 → 52_200 (v2.371): EINE Decision-Tree-Zeile für die Variante
    // „local". Sie ist reine Auffindbarkeit — ohne sie weiß ein Agent nicht,
    // dass er die App überhaupt selbst ansehen und bedienen KANN, und fällt auf
    // „bitte manuell prüfen" zurück. Die Zeile trägt nur Stichwort + Doc-Link +
    // Kommando; das Detail lebt in docs/architecture/local-variante.md.
    expect(bytes).toBeLessThan(52_200);
  });
});
