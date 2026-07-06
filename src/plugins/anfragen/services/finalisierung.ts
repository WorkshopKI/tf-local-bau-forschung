/**
 * Finalisierung — DETERMINISTISCHE Wiedereinsetzung der Originaldaten.
 *
 * Kein LLM für die De-Anonymisierung: reines Find-Replace `platzhalter → original`
 * über die Mapping-Tabelle. Verlässlich, kein Halluzinationsrisiko.
 */
import type { KindedSegment } from '../highlight';
import type { Mapping } from '../types';

const PLATZHALTER_RE = /\[[A-Z][A-Z0-9_]*_\d+\]/g;

export interface PlatzhalterPruefung {
  /** Im Mapping deklariert, aber in der Antwort nicht (mehr) vorhanden. */
  fehlend: string[];
  /** In der Antwort vorhanden, aber im Mapping unbekannt → bleibt stehen. */
  unbekannt: string[];
}

export function pruefePlatzhalter(antwortAnon: string, mapping: Mapping[]): PlatzhalterPruefung {
  const bekannt = new Set(mapping.map(m => m.platzhalter));
  const fehlend = [...new Set(mapping.filter(m => !antwortAnon.includes(m.platzhalter)).map(m => m.platzhalter))];
  const gefunden = new Set(antwortAnon.match(PLATZHALTER_RE) ?? []);
  const unbekannt = [...gefunden].filter(p => !bekannt.has(p));
  return { fehlend, unbekannt };
}

/** Deterministische Wiedereinsetzung: jeder Platzhalter → sein Original. */
export function wiedereinsetzen(antwortAnon: string, mapping: Mapping[]): string {
  // Längere Platzhalter zuerst (defensiv; [PERSON_1] ist ohnehin kein Teilstring
  // von [PERSON_10] dank schließender Klammer).
  const sorted = [...mapping].sort((a, b) => b.platzhalter.length - a.platzhalter.length);
  let out = antwortAnon;
  for (const m of sorted) out = out.split(m.platzhalter).join(m.original);
  return out;
}

/**
 * Wie `wiedereinsetzen`, aber segmentiert für die Anzeige: jeder eingesetzte
 * Originalwert wird als `kind:'placeholder'` markiert (blau hervorhebbar). Der
 * Klartext (`.map(s => s.text).join('')`) ist identisch zu `wiedereinsetzen`.
 * Unbekannte Platzhalter (kein Mapping-Eintrag) bleiben unmarkiert stehen.
 */
export function wiedereinsetzenSegmente(antwortAnon: string, mapping: Mapping[]): KindedSegment[] {
  const repl = new Map<string, string>();
  for (const m of mapping) if (!repl.has(m.platzhalter)) repl.set(m.platzhalter, m.original);
  const segs: KindedSegment[] = [];
  let last = 0;
  for (const match of antwortAnon.matchAll(PLATZHALTER_RE)) {
    const idx = match.index;
    if (idx === undefined) continue;
    if (idx > last) segs.push({ text: antwortAnon.slice(last, idx), kind: null });
    const orig = repl.get(match[0]);
    segs.push(orig !== undefined ? { text: orig, kind: 'placeholder' } : { text: match[0], kind: null });
    last = idx + match[0].length;
  }
  if (last < antwortAnon.length) segs.push({ text: antwortAnon.slice(last), kind: null });
  return segs;
}

/**
 * Erzeugt die finale, mail-fertige Antwort: deterministische Wiedereinsetzung der
 * Originaldaten (kein LLM).
 */
export async function finalisiere(antwortAnon: string, mapping: Mapping[]): Promise<string> {
  return wiedereinsetzen(antwortAnon, mapping);
}
