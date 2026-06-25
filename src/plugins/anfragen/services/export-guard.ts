/**
 * Deterministischer Export-Guard — da die App NICHTS automatisch sendet, ist
 * dies die EINZIGE technische Grenze zwischen echter PII und Zwischenablage.
 * Entsprechend hart und bewusst over-detecting (Over-Blocking ist der sichere
 * Fehler).
 *
 * Zwei Stufen:
 *  1. Mapping-Gegenscan: taucht IRGENDEIN `mapping[].original` (case-insensitiv,
 *     whitespace-tolerant) noch im Text auf → Leak.
 *  2. Pattern-Scan: residuale PII, die das LLM übersehen haben könnte
 *     (E-Mail, FKZ, Telefon, IBAN, X.500-DN, Hostnames).
 *
 * MUSS auf dem TATSÄCHLICH zu kopierenden (ggf. editierten) Text laufen — bei
 * JEDEM Kopier-Klick neu (siehe Phase 6 / Convention-Guard).
 */
import type { Mapping, PiiTyp } from '../types';

export interface Treffer {
  /** Der im Text gefundene Klartext. */
  wert: string;
  /** Start-Position im geprüften Text (für Inline-Markierung). */
  index: number;
  laenge: number;
  typ: PiiTyp;
  quelle: 'mapping' | 'pattern';
}

export interface ExportPruefung {
  sicher: boolean;
  treffer: Treffer[];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Originaltext als whitespace-toleranter, case-insensitiver Regex. */
function originalRegex(original: string): RegExp | null {
  const tokens = original.trim().split(/\s+/).filter(Boolean).map(escapeRegex);
  if (tokens.length === 0) return null;
  return new RegExp(tokens.join('\\s+'), 'gi');
}

/** Residuale-PII-Muster. Bewusst eher zu großzügig (Over-Blocking = sicher). */
const PATTERNS: ReadonlyArray<{ typ: PiiTyp; re: RegExp; minDigits?: number }> = [
  { typ: 'email', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  // FKZ: 2 Ziffern, 2 Großbuchstaben, >=4 Ziffern (z. B. 16EP1234, 16KN045678).
  { typ: 'fkz', re: /\b\d{2}[A-Z]{2}\d{4,}\b/g },
  // IBAN: DE-spezifisch + generische Länderkennung.
  { typ: 'iban', re: /\bDE\d{2}[ ]?(?:\d{4}[ ]?){4}\d{2}\b/g },
  { typ: 'iban', re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,}[ ]?[A-Z0-9]{1,4}\b/g },
  // X.500-DN-Fragmente (/O=…/OU=…/CN=…).
  { typ: 'x500', re: /\/(?:O|OU|CN|DC)=[^/\n\r]+/gi },
  // Hostnames / interne FQDNs: mind. 3 Labels (sub.domain.tld) — fängt Message-ID-Hosts.
  { typ: 'hostname', re: /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.){2,}[a-z]{2,}\b/gi },
  // Deutsche Telefonnummern: international (+49 …) ODER 0-Vorwahl + Trenner (Leer/-/Schräg) +
  // Nummer. Der Trenner-Zwang schließt punkt-getrennte Datumsangaben (01.01.2026) aus.
  { typ: 'telefon', re: /\+49[\s/().-]?\d[\d\s/().-]{4,}\d/g, minDigits: 7 },
  { typ: 'telefon', re: /\b0\d{1,5}[\s/-]\d[\d\s/().-]{3,}\d/g, minDigits: 6 },
];

function zaehleZiffern(s: string): number {
  let n = 0;
  for (const ch of s) if (ch >= '0' && ch <= '9') n++;
  return n;
}

export function pruefeExportSicher(text: string, mapping: Mapping[]): ExportPruefung {
  const treffer: Treffer[] = [];

  // 1) Mapping-Gegenscan.
  for (const m of mapping) {
    const re = originalRegex(m.original);
    if (!re) continue;
    for (const match of text.matchAll(re)) {
      if (match.index === undefined) continue;
      treffer.push({ wert: match[0], index: match.index, laenge: match[0].length, typ: m.typ, quelle: 'mapping' });
    }
  }

  // 2) Pattern-Scan.
  for (const { typ, re, minDigits } of PATTERNS) {
    for (const match of text.matchAll(re)) {
      if (match.index === undefined) continue;
      const wert = match[0];
      if (minDigits && zaehleZiffern(wert) < minDigits) continue;
      treffer.push({ wert, index: match.index, laenge: wert.length, typ, quelle: 'pattern' });
    }
  }

  treffer.sort((a, b) => a.index - b.index);
  return { sicher: treffer.length === 0, treffer };
}
