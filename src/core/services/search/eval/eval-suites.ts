import type { EvalTestCase } from './eval-types';
import { EVAL_TEST_CASES } from './test-cases';

export interface EvalSuite {
  id: string;
  label: string;
  description: string;
  department: string;
  cases: EvalTestCase[];
}

const BAU_IDS = ['K1','K2','K4','K5','S1','S2','S3','S4','S5','S6','S11','S12','S13','S14'];
const FORSCHUNG_IDS = ['K3','S2','S7','S8','S9','S10','S15'];

export const EVAL_SUITES: EvalSuite[] = [
  {
    id: 'alle', label: 'Alle Testfaelle',
    description: 'Vollstaendige Suite mit allen Testfaellen',
    department: 'alle', cases: EVAL_TEST_CASES,
  },
  {
    id: 'bau', label: 'Bauantraege',
    description: 'Brandschutz, Statik, Energie, Denkmalschutz',
    department: 'bau',
    cases: EVAL_TEST_CASES.filter(tc => BAU_IDS.includes(tc.id)),
  },
  {
    id: 'forschung', label: 'Forschungsantraege',
    description: 'KI, Ethik, Datenschutz, Compliance',
    department: 'forschung',
    cases: EVAL_TEST_CASES.filter(tc => FORSCHUNG_IDS.includes(tc.id)),
  },
];

export function getSuiteById(id: string): EvalSuite {
  return EVAL_SUITES.find(s => s.id === id) ?? EVAL_SUITES[0]!;
}
