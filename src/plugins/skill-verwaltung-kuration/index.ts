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
 * noch sie und die Einstellungen (jetzt in der Fußzeile) und kostete eine
 * Trennlinie plus den Leerraum darüber. In der Arbeitsliste steht sie bei den
 * übrigen Werkzeugen — vor dem Feedback-Board, das als Rückmelde-Kanal ans Ende
 * gehört.
 */
export const skillVerwaltungPlugin: TeamFlowPlugin = {
  id: 'skill-verwaltung-kuration',
  route: '/kuration/skill-verwaltung',
  featureFlag: 'skillVerwaltung',
  name: 'Skill-Verwaltung',
  icon: 'Wrench',
  category: 'tools',
  // Zwischen status-cockpit (8) und feedback-board (75).
  order: 70,
  component: SkillVerwaltungPage,
};
