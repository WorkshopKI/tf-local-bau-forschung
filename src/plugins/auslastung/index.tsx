/**
 * Plugin "auslastung" — automatische Kategorisierung + MA-Zuweisung.
 *
 * Sichtbar fuer alle User (category 'workflow'), aber die PL-Tabs
 * (Klassifizierung / Zuweisung / Kapazität / Admin) sind innerhalb der
 * View gegen `profile.is_kurator` gegated. Feature-Flag: features.auslastung.
 */
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { AuslastungView } from './views/AuslastungView';

export const auslastungPlugin: TeamFlowPlugin = {
  id: 'auslastung',
  name: 'Auslastung',
  icon: 'Users',
  category: 'workflow',
  order: 25,
  component: AuslastungView,
};
