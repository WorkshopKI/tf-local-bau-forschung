/**
 * Runtime-Zugriff auf die optionale `runtimeConfig.dev`-Sektion.
 *
 * Wird nur genutzt wenn features.devFixtures aktiv ist. Die Validierung in
 * scripts/config-schema.mjs stellt sicher, dass demo/production diese Sektion
 * nicht aktivieren können.
 */

import { runtimeConfig } from '@/config/runtime-config';
import type { TeamflowDevConfig } from '@/config/runtime-config';

const DEFAULTS: Required<TeamflowDevConfig> = {
  defaultKuratorName: 'Dev',
  defaultKuratorPassword: 'dev',
  dataSharePath: null,
  sessionTtlDays: 30,
  autoRefreshSmbPermission: true,
  autoReloadAfterScenario: true,
};

export function getDevConfig(): Required<TeamflowDevConfig> {
  return { ...DEFAULTS, ...(runtimeConfig.dev ?? {}) };
}
