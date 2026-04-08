import { hybridSearch } from '../orama-store';
import type { OramaSearchResult } from '../orama-store';
import { embeddingService } from '../embedding-service';
import { getModelById } from '../model-registry';
import { isReRankerReady, rerank } from '../re-ranker';
import { pipelineLog } from '../pipeline-logger';
import type { EvalTestCase, TestCaseResult, EvalReport, EvalProgress, EvalSummary } from './eval-types';

export class EvalRunner {
  constructor(private modelId: string) {}

  async run(
    testCases: EvalTestCase[],
    onProgress?: (p: EvalProgress) => void,
  ): Promise<EvalReport> {
    const model = getModelById(this.modelId);
    const startTime = Date.now();
    const results: TestCaseResult[] = [];

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i]!;
      onProgress?.({ current: i + 1, total: testCases.length, currentQuery: tc.query });

      let queryVector: number[] | null = null;
      if (embeddingService.isReady()) {
        queryVector = await embeddingService.embedSingle(tc.query, model, 'query');
      }

      const reRankerActive = isReRankerReady();
      const limit = reRankerActive ? 30 : 10;
      let searchResults = hybridSearch(tc.query, queryVector, { limit });
      if (reRankerActive && searchResults.length > 0) {
        searchResults = await rerank(tc.query, searchResults, 15, 10);
        pipelineLog.info('Eval', `[${tc.id}] Re-Ranker: ${searchResults.length} Ergebnisse`);
      }
      const result = this.evaluateCase(tc, searchResults);
      results.push(result);

      await new Promise(r => setTimeout(r, 0));
    }

    return {
      timestamp: new Date().toISOString(),
      model: model.name,
      modelId: this.modelId,
      modelLabel: model.label,
      totalChunks: 0,
      totalDocs: 0,
      duration: Date.now() - startTime,
      results,
      summary: this.computeSummary(results),
    };
  }

  private evaluateCase(tc: EvalTestCase, searchResults: OramaSearchResult[]): TestCaseResult {
    const top10 = searchResults.slice(0, 10);

    /**
     * Extrahiert die Vorgangs-ID aus einem Dateinamen.
     * z.B. "Projekt_FA001.md" → "FA001", "Statik_Tragwerk_BA010.md" → "BA010"
     */
    const extractVorgangId = (filename: string): string | null => {
      const match = filename.match(/([A-Z]{2,3}\d{3,4})/);
      return match ? match[1]! : null;
    };

    const matchesInTopN = (n: number): string[] => {
      const topN = top10.slice(0, n);
      return tc.expectedDocs.filter(expected =>
        topN.some(r =>
          r.source.includes(expected) ||
          r.title.includes(expected) ||
          r.id.includes(expected) ||
          // Vorgangs-ID Match: z.B. "Projekt_FA001.md" matcht "Zwischenbericht_FA001.md"
          (extractVorgangId(expected) !== null &&
           extractVorgangId(expected) === extractVorgangId(r.source)),
        ),
      );
    };

    const top1Source = top10[0]?.source ?? '';
    const top1Title = top10[0]?.title ?? '';
    const top1Match = tc.expectedTop1
      ? top1Source.includes(tc.expectedTop1) || top1Title.includes(tc.expectedTop1) ||
        (extractVorgangId(tc.expectedTop1) !== null &&
         extractVorgangId(tc.expectedTop1) === extractVorgangId(top1Source))
      : false;

    const expectedInTop3 = matchesInTopN(3);
    const expectedInTop5 = matchesInTopN(5);
    const expectedInTop10 = matchesInTopN(10);
    const docCount = tc.expectedDocs.length;

    return {
      testCase: tc,
      results: top10,
      top1Match,
      expectedInTop3,
      expectedInTop5,
      expectedInTop10,
      precision3: docCount > 0 ? expectedInTop3.length / docCount : 0,
      precision5: docCount > 0 ? expectedInTop5.length / docCount : 0,
      pass: expectedInTop5.length > 0,
    };
  }

  private computeSummary(results: TestCaseResult[]): EvalSummary {
    const passed = results.filter(r => r.pass).length;
    const top1Cases = results.filter(r => r.testCase.expectedTop1);

    const byCategory: Record<string, { total: number; passed: number }> = {};
    const byDifficulty: Record<string, { total: number; passed: number }> = {};

    for (const r of results) {
      const cat = r.testCase.category;
      if (!byCategory[cat]) byCategory[cat] = { total: 0, passed: 0 };
      byCategory[cat]!.total++;
      if (r.pass) byCategory[cat]!.passed++;

      const diff = r.testCase.difficulty;
      if (!byDifficulty[diff]) byDifficulty[diff] = { total: 0, passed: 0 };
      byDifficulty[diff]!.total++;
      if (r.pass) byDifficulty[diff]!.passed++;
    }

    return {
      total: results.length, passed, failed: results.length - passed,
      avgPrecision3: results.reduce((s, r) => s + r.precision3, 0) / results.length,
      avgPrecision5: results.reduce((s, r) => s + r.precision5, 0) / results.length,
      top1Accuracy: top1Cases.length > 0
        ? top1Cases.filter(r => r.top1Match).length / top1Cases.length : 0,
      byCategory, byDifficulty,
    };
  }
}
