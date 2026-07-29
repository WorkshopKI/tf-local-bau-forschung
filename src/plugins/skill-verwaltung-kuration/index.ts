import type { TeamFlowPlugin } from '@/core/types/plugin';
import { SkillVerwaltungPage } from './SkillVerwaltungPage';

/**
 * Skill-Verwaltung — Kurator-pflegbare Skill-/Regel-Registry mit Sandbox-
 * Testlauf. Sichtbar in dev + kurator + pl (Flag `skillVerwaltung`). Bewusst
 * KEIN `kuratorOnly`: für alle sichtbar (pl hat weder `kuratorMenus` noch
 * `is_kurator`); der Schutz sitzt IN der Seite über `canEditSkillRegistry`
 * (Kurator-Session bzw. pl-Schreibrecht).
 *
 * Seit v2.360 `category: 'tools'` statt der eigenen System-Gruppe: die trug nur
 * noch sie und die Einstellungen (jetzt in der Fußzeile). Sie steht in der
 * Gruppe „Werkzeuge" — vor dem Feedback-Board, das als Rückmelde-Kanal ans Ende
 * gehört.
 */
export const skillVerwaltungPlugin: TeamFlowPlugin = {
  id: 'skill-verwaltung-kuration',
  route: '/kuration/skill-verwaltung',
  featureFlag: 'skillVerwaltung',
  name: 'Skill-Verwaltung',
  icon: 'Wrench',
  category: 'tools',
  // Zwischen Suche (20) und Feedback-Board (24).
  order: 22,
  component: SkillVerwaltungPage,
};
