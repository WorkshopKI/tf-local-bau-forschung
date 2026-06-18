/**
 * Pure-Logik des Eval-Fixture-Generators: synthetisiert die ADMINISTRATIVEN
 * Stammdaten-Felder (FKZ/Aktenzeichen, Verbund-Key, EP/KN) und baut daraus den
 * exakten `KurzfassungContext`, den der Gutachten-/Kurzfassungs-Skill produktiv
 * aus dem CSV bekäme. Keine I/O, kein `fetch` — vollständig testbar.
 *
 * Admin-Felder sind deterministisch + stabil (Seed = VB-Dateiname), damit
 * wiederholte Läufe byte-identische FKZ liefern.
 */
import type { KurzfassungContext, KurzfassungTeilvorhaben } from '@/plugins/antraege/kurzfassung/types';
import type { ExtractedContent } from './extract';
import { sha1Hex } from './sha1';

export type Antragstyp = 'EP' | 'KN';
export type TypWahl = 'auto' | 'ep' | 'kn';
export type FkzPrefix = '16EP' | '16KN';

export interface Fixture {
  vbFile: string;
  antragstyp: Antragstyp;
  context: KurzfassungContext;
  vbMarkdown: string;
}

/**
 * Stets 6-stellige Zahl (100000–999999) aus `sha1(seed)`: erste 4 Hex-Stellen
 * (= erste 2 Bytes) als uint, `% 900000`, `+ offset`, erneut `% 900000`,
 * `+ 100000` ⇒ kein Führende-Null-Problem, stabil über Läufe.
 */
export function sechsstellig(seed: string, offset = 0): number {
  const u = parseInt(sha1Hex(seed).slice(0, 8), 16) >>> 0;
  return (((u % 900000) + offset) % 900000) + 100000;
}

export function mintFkz(prefix: FkzPrefix, seed: string, offset = 0): string {
  return `${prefix}${sechsstellig(seed, offset)}`;
}

/**
 * Baut aus dem extrahierten Inhalt + dem Dateinamen-Seed ein vollständiges
 * Fixture. EP/KN-Wahl: `--typ ep|kn` erzwingt, `auto` → ≥2 Partner = Verbund.
 */
export function assembleFixture(
  datei: string,
  vb: string,
  extracted: ExtractedContent,
  typWahl: TypWahl,
): Fixture {
  const partner = extracted.partner;
  const istKN = typWahl === 'kn' || (typWahl === 'auto' && partner.length >= 2);
  const lead = partner[0]?.name ?? null;

  if (istKN) {
    const verbundFkz = mintFkz('16KN', datei);
    const teilvorhaben: KurzfassungTeilvorhaben[] = partner.map((p, i) => ({
      nr: i + 1,
      aktenzeichen: mintFkz('16KN', datei, i + 1),
      titel: p.teilTitel,
      antragsteller: p.name,
    }));
    const context: KurzfassungContext = {
      key: verbundFkz,
      akronym: extracted.akronym,
      titel: extracted.titel,
      antragsteller: lead,
      foerderkennzeichen: verbundFkz,
      knownIds: [verbundFkz, ...teilvorhaben.map(t => t.aktenzeichen)],
      teilvorhaben,
    };
    return { vbFile: datei, antragstyp: 'KN', context, vbMarkdown: vb };
  }

  const aktenzeichen = mintFkz('16EP', datei);
  const context: KurzfassungContext = {
    key: aktenzeichen,
    akronym: extracted.akronym,
    titel: extracted.titel,
    antragsteller: lead,
    foerderkennzeichen: aktenzeichen,
    knownIds: [aktenzeichen],
    teilvorhaben: [],
  };
  return { vbFile: datei, antragstyp: 'EP', context, vbMarkdown: vb };
}

/**
 * Dedupliziert ein Akronym gegen bereits vergebene: kappt auf ≤14 Zeichen,
 * hängt bei Kollision `-2`, `-3`, … an (Basis so getrimmt, dass das Gesamt
 * ≤14 bleibt) und vermerkt das Ergebnis in `used`.
 */
export function dedupeAkronym(akronym: string, used: Set<string>): string {
  const base = akronym.slice(0, 14);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  for (let i = 2; ; i++) {
    const suffix = `-${i}`;
    const candidate = base.slice(0, 14 - suffix.length) + suffix;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
}

/** Lauf-weiter Dedup-Pass über alle Fixtures (stabile Reihenfolge = Eingabe). */
export function applyAkronymDedup(fixtures: Fixture[]): Fixture[] {
  const used = new Set<string>();
  return fixtures.map(f => {
    const akronym = dedupeAkronym(f.context.akronym, used);
    if (akronym === f.context.akronym) return f;
    return { ...f, context: { ...f.context, akronym } };
  });
}

const CSV_HEADER = ['vb_datei', 'antragstyp', 'aktenzeichen', 'akronym', 'titel', 'antragsteller', 'anzahl_tv'];

/** RFC-4180-Quoting: bei `"`, `;`, CR oder LF in Anführungszeichen, `"` verdoppelt. */
function csvCell(value: string): string {
  if (/[";\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** `;`-getrennte CSV mit fester Spaltenfolge; `aktenzeichen` = Verbund-/EP-FKZ. */
export function buildStammdatenCsv(fixtures: Fixture[]): string {
  const rows = [CSV_HEADER.join(';')];
  for (const f of fixtures) {
    const c = f.context;
    rows.push(
      [
        csvCell(f.vbFile),
        csvCell(f.antragstyp),
        csvCell(c.foerderkennzeichen),
        csvCell(c.akronym),
        csvCell(c.titel ?? ''),
        csvCell(c.antragsteller ?? ''),
        csvCell(String(c.teilvorhaben.length)),
      ].join(';'),
    );
  }
  return rows.join('\n') + '\n';
}
