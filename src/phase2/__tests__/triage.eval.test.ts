/**
 * Eval-Suite über die 11 Beispiel-Dokumente in `docs/phase-2/triage-beispiele/`.
 *
 * Ground-Truth wird aus dem Inhalt der Files abgeleitet (siehe TRIAGE_GROUND_TRUTH).
 * Im PR-Review korrigierbar.
 *
 * Eval-Schwelle laut Plan: ≥ 9 / 11 korrekt klassifiziert in {doc_type, relevance}.
 * Test failt darunter.
 */

import { describe, it, expect } from 'vitest';
import { runStage1 } from '../triage/stage1-structural';
import { runStage2 } from '../triage/stage2-keywords';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { DocType, TriageState } from '../types';

interface GroundTruth {
  filename: string;
  expected_doc_type: DocType;
  expected_relevance: TriageState;        // typischerweise 'relevant' oder 'irrelevant'
  expected_fkz?: string | null;
  expected_akronym?: string | null;
}

const TRIAGE_GROUND_TRUTH: GroundTruth[] = [
  {
    filename: '100200301.docx',
    expected_doc_type: 'verwendungsnachweispruefung',
    expected_relevance: 'relevant',
    expected_fkz: '16KN093231',
  },
  {
    // Anschreiben mit "Antragsbearbeitung - Ergänzung der Unterlagen" → de facto Nachforderung.
    filename: 'GKUV0Q01.docx',
    expected_doc_type: 'nachforderung',
    expected_relevance: 'relevant',
    expected_fkz: '16KN096121',
  },
  {
    filename: 'GMF4VD01.docx',
    expected_doc_type: 'korrespondenz',
    expected_relevance: 'relevant',
  },
  {
    filename: 'GMGY5M01.DOCX',
    expected_doc_type: 'nachforderung',
    expected_relevance: 'relevant',
  },
  {
    filename: 'GMJYXR01.docx',
    expected_doc_type: 'gutachten',
    expected_relevance: 'irrelevant',  // Gutachten-DOCX-Sonderregel
  },
  {
    filename: 'GMKZSZ01.docx',
    expected_doc_type: 'korrespondenz',
    expected_relevance: 'relevant',
  },
  {
    filename: 'GMM35I01.docx',
    expected_doc_type: 'gutachten',
    expected_relevance: 'irrelevant',
    expected_fkz: '16EP250229',
  },
  {
    filename: 'GMN9PQ01.docx',
    expected_doc_type: 'gutachten',
    expected_relevance: 'irrelevant',
    expected_fkz: '16KN129033',
  },
  {
    filename: 'GMN9PQ01.pdf',
    expected_doc_type: 'gutachten',
    expected_relevance: 'relevant',     // PDF-Variante = finale Variante
    expected_fkz: '16KN129033',
  },
  {
    filename: '100200302.pdf',
    expected_doc_type: 'sonstiges',     // 97-Seiten-PDF, signed cover, schwer eindeutig
    expected_relevance: 'relevant',
  },
  {
    filename: '100200303.pdf',
    expected_doc_type: 'sonstiges',     // 116 Seiten, "Eingang"-Header, könnte Sachbericht sein
    expected_relevance: 'relevant',
    expected_fkz: '16KN096120',
  },
];

const beispieleDir = path.resolve(__dirname, '../../../docs/phase-2/triage-beispiele');

async function loadBlob(filename: string): Promise<Blob | null> {
  const fullPath = path.join(beispieleDir, filename);
  if (!existsSync(fullPath)) return null;
  const buf = readFileSync(fullPath);
  return new Blob([buf]);
}

describe('Triage Eval (11 Beispiel-Dokumente)', () => {
  it('Pipeline-Run pro Datei', async () => {
    let correct = 0;
    let stateCorrect = 0;
    const failures: string[] = [];

    for (const gt of TRIAGE_GROUND_TRUTH) {
      const blob = await loadBlob(gt.filename);
      if (!blob) {
        failures.push(`${gt.filename}: file not found`);
        continue;
      }
      // Stage 1 (format-check + Gutachten-DOCX-Sonderregel kommt hier nicht zum
      // Tragen weil ohne DMS-Hint kein doc_type vorliegt; Sonderregel wirkt
      // dann in Stage 2)
      const stage1 = await runStage1({ filename: gt.filename, blob });

      let actualDocType: DocType = 'sonstiges';
      let actualState: TriageState = 'relevant';

      if (stage1.decided) {
        actualDocType = stage1.decided.doc_type;
        actualState = stage1.decided.triage_state;
      } else {
        const stage2 = await runStage2({ filename: gt.filename, blob });
        actualDocType = stage2.result.doc_type;
        actualState = stage2.result.triage_state;
      }

      const docTypeOk = actualDocType === gt.expected_doc_type;
      const stateOk = actualState === gt.expected_relevance;
      if (docTypeOk && stateOk) correct++;
      if (stateOk) stateCorrect++;
      if (!docTypeOk || !stateOk) {
        failures.push(
          `${gt.filename}: expected doc_type=${gt.expected_doc_type}/${gt.expected_relevance}, got ${actualDocType}/${actualState}`,
        );
      }
    }

    // Eval-Output für Build-Logs
    // Vitest unterdrückt console.log nicht; das hilft beim Debuggen.
    console.log(`[triage.eval] doc_type+relevance: ${correct}/${TRIAGE_GROUND_TRUTH.length}, relevance only: ${stateCorrect}/${TRIAGE_GROUND_TRUTH.length}`);
    if (failures.length > 0) {
      console.log('[triage.eval] failures:');
      failures.forEach(f => console.log('  - ' + f));
    }

    // Plan-Schwelle: ≥ 9/11 korrekt
    expect(correct, `failures:\n${failures.join('\n')}`).toBeGreaterThanOrEqual(9);
  }, 60000);
});
