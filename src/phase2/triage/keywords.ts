/**
 * Stage-2 Keyword-Marker pro doc_type.
 *
 * Abgeleitet aus den Beispiel-Dokumenten in `docs/phase-2/triage-beispiele/`:
 * stereotyp-behördliche Kopf-Phrasen, die in den ersten ~500 Tokens auftauchen.
 *
 * Hit-Rate-Erwartung laut Brief: > 60 %. Caller iteriert über die Marker-
 * Tabelle, vergleicht jedes `pattern` als Lowercase-Substring im Page-1-Text
 * und nimmt den doc_type mit den meisten Treffern (Tiebreaker: Reihenfolge).
 */

import type { KeywordMarker } from '../types';

export const STAGE2_KEYWORD_MARKERS: KeywordMarker[] = [
  {
    doc_type: 'verwendungsnachweispruefung',
    patterns: [
      'verwendungsnachweissprüfung',
      'verwendungsnachweisprüfung',
      'prüfung sachbericht',
      'formale prüfkriterien',
    ],
  },
  {
    doc_type: 'gutachten',
    patterns: [
      'gutachten zum vorhaben',
      'kurzfassung der projektbeschreibung',
      'innovationsprojekt zwischen unternehmen und forschungseinrichtung',
      'zzimfab',                          // Template-ID-Footer
    ],
  },
  {
    doc_type: 'gutachten_qs',
    patterns: [
      'qs zum antrag',
      'qs zur betreuung',
      'qualitätssicherung',
    ],
  },
  {
    doc_type: 'projektbeschreibung',
    patterns: [
      'projektbeschreibung',
      'kurzfassung der projektbeschreibung',
      'ziel des vorhabens',
    ],
  },
  {
    doc_type: 'verwendungsnachweis',
    patterns: [
      'verwendungsnachweis',
      'sachbericht',
      'zahlenmäßiger nachweis',
    ],
  },
  {
    doc_type: 'bescheid',
    patterns: [
      'zuwendungsbescheid',
      'zuwb',
      'schlussbescheid',
      'vorläufiger bescheid',
    ],
  },
  {
    doc_type: 'aenderungsbescheid',
    patterns: [
      'änderungsbescheid',
      'äb personalwechsel',
      'mittelumstellung',
    ],
  },
  {
    doc_type: 'nachforderung',
    patterns: [
      'nachforderung',
      'ergänzung der unterlagen',
      'antragsbearbeitung - (fachliche / administrative) ergänzung',
    ],
  },
  {
    doc_type: 'de_minimis',
    patterns: [
      'de-minimis',
      'de minimis',
    ],
  },
  {
    doc_type: 'korrespondenz',
    patterns: [
      'sehr geehrter',
      'sehr geehrte',
      'per e-mail',
      'kennzeichen:',
      'projektleiter:',
    ],
  },
  {
    doc_type: 'checkliste',
    patterns: [
      'checkliste',
    ],
  },
];

/**
 * Akronym-Hot-Set: typische Tokens, die ein "Akronym" markieren — in der
 * "Verbundtitel:" / "Akronym:" / "Kurzname:" Zeile.
 */
export const AKRONYM_HINT_PATTERNS: RegExp[] = [
  /(?:Akronym|Kurzname|Verbundtitel|Kurztitel)\s*[:.]\s*([A-Z][A-Za-z0-9]{2,})/,
];

/**
 * Match-Output: doc_type + Anzahl Hits + erste matching pattern.
 */
export interface KeywordMatch {
  doc_type: import('../types').DocType;
  hits: number;
  matched_patterns: string[];
}

export function matchKeywords(text: string): KeywordMatch[] {
  const lower = text.toLowerCase();
  const out: KeywordMatch[] = [];
  for (const marker of STAGE2_KEYWORD_MARKERS) {
    let hits = 0;
    const matched: string[] = [];
    for (const p of marker.patterns) {
      if (lower.includes(p.toLowerCase())) {
        hits++;
        matched.push(p);
      }
    }
    const min = marker.min_hits ?? 1;
    if (hits >= min) {
      out.push({ doc_type: marker.doc_type, hits, matched_patterns: matched });
    }
  }
  // Sortieren nach Hit-Anzahl, dann Reihenfolge (stabil)
  out.sort((a, b) => b.hits - a.hits);
  return out;
}

/**
 * Versucht ein Akronym-Hinweis im Text zu erkennen (z.B. nach "Akronym:" oder
 * "Verbundtitel:"-Marker). Liefert das erste Match — Caller validiert gegen
 * den `akronym_index`-Store.
 */
export function findAkronymHint(text: string): string | null {
  for (const re of AKRONYM_HINT_PATTERNS) {
    const m = re.exec(text);
    if (m && m[1]) return m[1];
  }
  return null;
}
