import type { TeamFlowPlugin } from '@/core/types/plugin';
import { SkillVerwaltungPage } from './SkillVerwaltungPage';

/**
 * Skill-Verwaltung — Kurator-pflegbare Skill-/Regel-Registry mit Sandbox-
 * Testlauf. Sichtbar in dev + kurator + pl (Flag `skillVerwaltung`). Bewusst
 * `category: 'tools'` statt `'kuration'` + KEIN `kuratorOnly`: nur so erscheint
 * die Seite auch im pl-Build (pl hat weder `kuratorMenus` noch `is_kurator`).
 * Der Schutz sitzt IN der Seite über `canEditSkillRegistry` (Kurator-Session
 * bzw. pl-Schreibrecht).
 */
export const skillVerwaltungPlugin: TeamFlowPlugin = {
  id: 'skill-verwaltung-kuration',
  route: '/kuration/skill-verwaltung',
  featureFlag: 'skillVerwaltung',
  name: 'Skill-Verwaltung',
  icon: 'Wrench',
  category: 'tools',
  order: 78,
  component: SkillVerwaltungPage,
};
