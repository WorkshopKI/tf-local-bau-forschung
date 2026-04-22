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
const ANTRAEGE_IDS = ['K3','S2','S7','S8','S9','S10','S15'];
const HARD_IDS = ['H1','H2','H3','H4','H5','H6','H7','H8','H9','H10'];
const EXTREME_IDS = ['X1','X2','X3','X4','X5','X6','X7','X8','X9','X10'];

export const EVAL_SUITES: EvalSuite[] = [
  {
    id: 'alle', label: 'Alle Testfaelle',
    description: 'Vollstaendige Suite mit allen 40 Testfaellen',
    department: 'alle', cases: EVAL_TEST_CASES,
  },
  {
    id: 'bau', label: 'Bauantraege',
    description: 'Brandschutz, Statik, Energie, Denkmalschutz',
    department: 'bau',
    cases: EVAL_TEST_CASES.filter(tc => BAU_IDS.includes(tc.id)),
  },
  {
    id: 'antraege', label: 'Foerderantraege',
    description: 'KI, Ethik, Datenschutz, Compliance',
    department: 'antraege',
    cases: EVAL_TEST_CASES.filter(tc => ANTRAEGE_IDS.includes(tc.id)),
  },
  {
    id: 'hard', label: 'Schwierige Faelle',
    description: 'Cross-Domain, Distraktoren, Umgangssprache, Konzept-Transfer',
    department: 'alle',
    cases: EVAL_TEST_CASES.filter(tc => HARD_IDS.includes(tc.id)),
  },
  {
    id: 'extreme', label: 'Near-Miss Distraktoren',
    description: 'Queries mit starken thematischen Distraktoren aus DOCX-Antraegen',
    department: 'alle',
    cases: EVAL_TEST_CASES.filter(tc => EXTREME_IDS.includes(tc.id)),
  },
];

export function getSuiteById(id: string): EvalSuite {
  return EVAL_SUITES.find(s => s.id === id) ?? EVAL_SUITES[0]!;
}
