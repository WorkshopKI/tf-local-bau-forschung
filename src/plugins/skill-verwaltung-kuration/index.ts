import type { TeamFlowPlugin } from '@/core/types/plugin';
import { SkillVerwaltungPage } from './SkillVerwaltungPage';

/**
 * Skill-Verwaltung — Kurator-pflegbare Skill-/Regel-Registry mit Sandbox-
 * Testlauf. Sichtbar in dev + kurator + pl (Flag `skillVerwaltung`). Bewusst
 * `category: 'system'` statt `'kuration'` + KEIN `kuratorOnly`: für alle sichtbar
 * (pl hat weder `kuratorMenus` noch `is_kurator`), aber unten in der System-Gruppe
 * gruppiert. Der Schutz sitzt IN der Seite über `canEditSkillRegistry` (Kurator-
 * Session bzw. pl-Schreibrecht).
 */
export const skillVerwaltungPlugin: TeamFlowPlugin = {
  id: 'skill-verwaltung-kuration',
  route: '/kuration/skill-verwaltung',
  featureFlag: 'skillVerwaltung',
  name: 'Skill-Verwaltung',
  icon: 'Wrench',
  category: 'system',
  order: 10,
  component: SkillVerwaltungPage,
};
