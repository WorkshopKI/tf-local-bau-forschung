import type { HybridResult } from '../hybrid-search';

export interface EvalTestCase {
  id: string;
  query: string;
  category: 'keyword' | 'semantic';
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  expectedDocs: string[];
  expectedTop1?: string;
}

export interface TestCaseResult {
  testCase: EvalTestCase;
  results: HybridResult[];
  top1Match: boolean;
  expectedInTop3: string[];
  expectedInTop5: string[];
  expectedInTop10: string[];
  precision3: number;
  precision5: number;
  pass: boolean;
}

export interface EvalSummary {
  total: number;
  passed: number;
  failed: number;
  avgPrecision3: number;
  avgPrecision5: number;
  top1Accuracy: number;
  byCategory: Record<string, { total: number; passed: number }>;
  byDifficulty: Record<string, { total: number; passed: number }>;
}

export interface EvalReport {
  timestamp: string;
  model: string;
  modelId?: string;
  modelLabel?: string;
  totalChunks: number;
  totalDocs: number;
  duration: number;
  results: TestCaseResult[];
  summary: EvalSummary;
}

export interface EvalProgress {
  current: number;
  total: number;
  currentQuery: string;
}
