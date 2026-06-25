/**
 * Recall-Bewertung der Anonymisierung (Phase 9). Pure Funktionen — die DSGVO-
 * kritische Metrik ist RECALL (wird jede PII gefunden?), nicht Judge-Geschmack.
 *
 * Pro Ground-Truth-Span:
 *  - `entferntAusText`: der Original-Klartext steht NICHT mehr im anonymisierten
 *    Text (die eigentliche Leak-Frage).
 *  - `imMapping`: ein Mapping-Eintrag deckt den Span ab (Wiedereinsetzbarkeit).
 *
 * Leak-Rate = 1 − Recall (entfernt aus Text). False-Positive-Rate (Over-
 * Anonymisieren) ist sekundär: Mapping-Originale ohne Ground-Truth-Bezug.
 */
import type { PiiTyp } from '../types';
import type { AnonymisierungErgebnis } from '../services/anonymisierung';
import type { AnfrageEvalFixture, PiiSpan } from './fixtures';

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

export interface SpanBewertung {
  span: PiiSpan;
  entferntAusText: boolean;
  imMapping: boolean;
}

export interface FixtureBewertung {
  fixtureId: string;
  spans: SpanBewertung[];
  /** Mapping-Einträge ohne Ground-Truth-Bezug (potenzielle Over-Anonymisierung). */
  falsePositives: number;
  mappingGesamt: number;
}

export function bewerteFixture(fixture: AnfrageEvalFixture, ergebnis: AnonymisierungErgebnis): FixtureBewertung {
  const text = norm(ergebnis.anonymisiertMd);
  const origs = ergebnis.mapping.map(m => norm(m.original)).filter(Boolean);
  const gtNorms = fixture.groundTruth.map(s => norm(s.text));

  const spans: SpanBewertung[] = fixture.groundTruth.map(span => {
    const n = norm(span.text);
    return {
      span,
      entferntAusText: !text.includes(n),
      imMapping: origs.some(o => o.includes(n) || n.includes(o)),
    };
  });

  const falsePositives = origs.filter(o => !gtNorms.some(g => g.includes(o) || o.includes(g))).length;
  return { fixtureId: fixture.id, spans, falsePositives, mappingGesamt: ergebnis.mapping.length };
}

export interface TypMetrik {
  typ: PiiTyp;
  gesamt: number;
  entfernt: number;
  imMapping: number;
  recall: number; // entfernt / gesamt
}

export interface RecallReport {
  proTyp: TypMetrik[];
  gesamt: number;
  entfernt: number;
  gesamtRecall: number;
  leakRate: number;
  leaks: Array<{ fixtureId: string; span: PiiSpan }>;
  mappingLuecken: Array<{ fixtureId: string; span: PiiSpan }>;
  falsePositives: number;
  mappingGesamt: number;
}

export function aggregiereRecall(bewertungen: FixtureBewertung[]): RecallReport {
  const perTyp = new Map<PiiTyp, { gesamt: number; entfernt: number; imMapping: number }>();
  const leaks: RecallReport['leaks'] = [];
  const mappingLuecken: RecallReport['mappingLuecken'] = [];
  let gesamt = 0;
  let entfernt = 0;
  let falsePositives = 0;
  let mappingGesamt = 0;

  for (const b of bewertungen) {
    falsePositives += b.falsePositives;
    mappingGesamt += b.mappingGesamt;
    for (const sb of b.spans) {
      gesamt++;
      const m = perTyp.get(sb.span.typ) ?? { gesamt: 0, entfernt: 0, imMapping: 0 };
      m.gesamt++;
      if (sb.entferntAusText) { m.entfernt++; entfernt++; }
      else leaks.push({ fixtureId: b.fixtureId, span: sb.span });
      if (sb.imMapping) m.imMapping++;
      if (sb.entferntAusText && !sb.imMapping) mappingLuecken.push({ fixtureId: b.fixtureId, span: sb.span });
      perTyp.set(sb.span.typ, m);
    }
  }

  const proTyp: TypMetrik[] = [...perTyp.entries()]
    .map(([typ, m]) => ({ typ, gesamt: m.gesamt, entfernt: m.entfernt, imMapping: m.imMapping, recall: m.gesamt ? m.entfernt / m.gesamt : 1 }))
    .sort((a, b) => a.recall - b.recall);

  return {
    proTyp,
    gesamt,
    entfernt,
    gesamtRecall: gesamt ? entfernt / gesamt : 1,
    leakRate: gesamt ? 1 - entfernt / gesamt : 0,
    leaks,
    mappingLuecken,
    falsePositives,
    mappingGesamt,
  };
}

const pct = (x: number): string => `${(x * 100).toFixed(1)} %`;

export function formatRecallReport(report: RecallReport): string {
  const lines: string[] = [];
  lines.push('=== Anonymisierungs-Recall (fiktive Fixtures) ===');
  lines.push(`Gesamt-Recall: ${pct(report.gesamtRecall)}  (Leak-Rate: ${pct(report.leakRate)})`);
  lines.push(`Spans gesamt: ${report.gesamt} · entfernt: ${report.entfernt} · Leaks: ${report.leaks.length}`);
  lines.push('');
  lines.push('Recall je Typ (aufsteigend — kritische zuerst):');
  for (const t of report.proTyp) {
    lines.push(`  ${t.typ.padEnd(10)} ${pct(t.recall).padStart(7)}  (${t.entfernt}/${t.gesamt} entfernt, ${t.imMapping}/${t.gesamt} im Mapping)`);
  }
  if (report.leaks.length > 0) {
    lines.push('');
    lines.push('LEAKS (noch im anonymisierten Text):');
    for (const l of report.leaks) lines.push(`  [${l.fixtureId}] ${l.span.typ}: "${l.span.text}"`);
  }
  if (report.mappingLuecken.length > 0) {
    lines.push('');
    lines.push('Mapping-Lücken (entfernt, aber nicht wiedereinsetzbar):');
    for (const l of report.mappingLuecken) lines.push(`  [${l.fixtureId}] ${l.span.typ}: "${l.span.text}"`);
  }
  lines.push('');
  lines.push(`Mögliche Over-Anonymisierung (sekundär): ${report.falsePositives}/${report.mappingGesamt} Mapping-Einträge ohne Ground-Truth-Bezug.`);
  return lines.join('\n');
}
