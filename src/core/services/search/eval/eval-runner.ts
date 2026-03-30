import type { HybridSearch } from '../hybrid-search';
import type { EvalTestCase, TestCaseResult, EvalReport, EvalProgress, EvalSummary } from './eval-types';
import { EVAL_TEST_CASES } from './test-cases';
import { EMBEDDING_MODEL } from '../embedding-service';

export class EvalRunner {
  constructor(private search: HybridSearch) {}

  async run(
    onProgress?: (p: EvalProgress) => void,
  ): Promise<EvalReport> {
    const startTime = Date.now();
    const results: TestCaseResult[] = [];

    for (let i = 0; i < EVAL_TEST_CASES.length; i++) {
      const tc = EVAL_TEST_CASES[i]!;
      onProgress?.({ current: i + 1, total: EVAL_TEST_CASES.length, currentQuery: tc.query });

      const result = await this.evaluateCase(tc);
      results.push(result);

      // Micro-yield fuer UI
      await new Promise(r => setTimeout(r, 0));
    }

    return {
      timestamp: new Date().toISOString(),
      model: EMBEDDING_MODEL,
      totalChunks: 0,
      totalDocs: 0,
      duration: Date.now() - startTime,
      results,
      summary: this.computeSummary(results),
    };
  }

  private async evaluateCase(tc: EvalTestCase): Promise<TestCaseResult> {
    const searchResults = await this.search.search(tc.query);
    const top10 = searchResults.slice(0, 10);

    const matchesInTopN = (n: number): string[] => {
      const topN = top10.slice(0, n);
      return tc.expectedDocs.filter(expected =>
        topN.some(r =>
          r.source.includes(expected) ||
          r.title.includes(expected) ||
          r.id.includes(expected),
        ),
      );
    };

    const top1Source = top10[0]?.source ?? '';
    const top1Title = top10[0]?.title ?? '';
    const top1Match = tc.expectedTop1
      ? top1Source.includes(tc.expectedTop1) || top1Title.includes(tc.expectedTop1)
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
      total: results.length,
      passed,
      failed: results.length - passed,
      avgPrecision3: results.reduce((s, r) => s + r.precision3, 0) / results.length,
      avgPrecision5: results.reduce((s, r) => s + r.precision5, 0) / results.length,
      top1Accuracy: top1Cases.length > 0
        ? top1Cases.filter(r => r.top1Match).length / top1Cases.length
        : 0,
      byCategory,
      byDifficulty,
    };
  }
}
