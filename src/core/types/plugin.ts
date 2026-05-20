import type { ComponentType } from 'react';

/**
 * Feature-Flags, die einzelne Plugins gaten koennen. Subset von
 * `runtimeConfig.features` aus `scripts/config-schema.mjs` — gepflegt als
 * literal-Union, damit ein Tippfehler im Plugin-Index sofort als TS-Error
 * sichtbar wird. Bei einer neuen Plugin-Flag hier ergaenzen.
 */
export type PluginFeatureKey =
  | 'antraege'
  | 'auslastung'
  | 'bauantraege'
  | 'chat'
  | 'dokumente'
  | 'dokumentenscan'
  | 'devFixtures'
  | 'devInfraPanel'
  | 'feedback'
  | 'feedbackBoard'
  | 'suche'
  | 'volltextsuche';

export interface TeamFlowPlugin {
  id: string;
  /**
   * HashRouter-Route ohne `#`-Praefix (z.B. `'/antraege'`, `'/kuration/feedback'`).
   * Wird in `PLUGIN_ROUTES` (siehe `src/plugins.config.ts`) zur ID gemappt — der
   * Router liest sie von dort, keine separate `routes.ts`-Map mehr pflegen.
   * Home-Plugin hat `'/'`.
   */
  route: string;
  /**
   * Optional: Build-Time-Feature-Flag, das dieses Plugin aktiviert. Wenn das
   * Flag in der Variant-Config auf `false` steht, wird das Plugin aus der
   * Sidebar gefiltert. Liste der erlaubten Keys siehe `PluginFeatureKey`.
   * Kuration-Plugins werden zusaetzlich vom `kuratorMenus`-Flag gegated
   * (Kategorie-basiert, das ist redundant zu hier setzen).
   */
  featureFlag?: PluginFeatureKey;
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
