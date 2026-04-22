import type { ComponentType } from 'react';

export interface TeamFlowPlugin {
  id: string;
  name: string;
  icon: string;
  category: 'workflow' | 'tools' | 'kuration';
  order: number;
  component: ComponentType;
  /** Wenn true, nur sichtbar für User mit `profile.is_kurator === true`. */
  kuratorOnly?: boolean;
  /** @deprecated Legacy-Alias vor v1.9; wird per Fallback als kuratorOnly behandelt. */
  adminOnly?: boolean;
  badge?: () => number | null;
}
