/**
 * Dev-only Live-Runner für das Recall-Gate: fährt den Anonymisierungs-Skill über
 * die FIKTIVEN Fixtures (interner Transport) und aggregiert das Recall-Ergebnis.
 *
 * Braucht ein LEBENDES internes Modell (gpt-oss via Bridge) — läuft daher NICHT in
 * `npm run check`, sondern on-demand auf einer Dev-Maschine. Die reine Scoring-/
 * Aggregations-Logik (`bewerteFixture`/`aggregiereRecall`) ist separat unit-getestet.
 *
 * DSGVO-Provenance-Guard: ausschließlich `ANFRAGE_EVAL_FIXTURES` (fiktiv) — der
 * Runner akzeptiert KEINE externen Eingaben.
 */
import type { AIBridge } from '@/core/services/ai/bridge';
import type { SkillRecord } from '@/core/services/skills';
import { runAnonymisierung } from '../services/anonymisierung';
import { ANFRAGE_EVAL_FIXTURES, type AnfrageEvalFixture } from './fixtures';
import { aggregiereRecall, bewerteFixture, formatRecallReport, type RecallReport } from './recall';

/** Provenance-Assert: nur Spans aus dem fiktiven Bundle dürfen in einen Lauf. */
function assertFiktiv(fixtures: readonly AnfrageEvalFixture[]): void {
  for (const f of fixtures) {
    if (!ANFRAGE_EVAL_FIXTURES.includes(f)) {
      throw new Error('Recall-Eval-Provenance verletzt: nur ANFRAGE_EVAL_FIXTURES (fiktiv) erlaubt.');
    }
  }
}

export interface RecallLaufErgebnis {
  report: RecallReport;
  text: string;
}

export async function runRecallEval(bridge: AIBridge, skill: SkillRecord): Promise<RecallLaufErgebnis> {
  assertFiktiv(ANFRAGE_EVAL_FIXTURES);
  const bewertungen = [];
  for (const fixture of ANFRAGE_EVAL_FIXTURES) {
    // Sequenziell — die interne Bridge ist ein einzelnes postMessage-Fenster.
    const ergebnis = await runAnonymisierung(bridge, skill, fixture.text);
    bewertungen.push(bewerteFixture(fixture, ergebnis));
  }
  const report = aggregiereRecall(bewertungen);
  return { report, text: formatRecallReport(report) };
}
