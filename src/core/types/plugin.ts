import type { ComponentType } from 'react';

export interface TeamFlowPlugin {
  id: string;
  name: string;
  icon: string;
  category: 'workflow' | 'tools' | 'admin';
  order: number;
  component: ComponentType;
  adminOnly?: boolean;
  badge?: () => number | null;
}
