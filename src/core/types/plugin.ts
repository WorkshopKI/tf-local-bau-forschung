import type { ComponentType } from 'react';
import type { StorageService } from '@/core/services/storage';

/**
 * Feature-Flags, die einzelne Plugins gaten koennen. Subset von
 * `runtimeConfig.features` aus `scripts/config-schema.mjs` — gepflegt als
 * literal-Union, damit ein Tippfehler im Plugin-Index sofort als TS-Error
 * sichtbar wird. Bei einer neuen Plugin-Flag hier ergaenzen.
 */
export type PluginFeatureKey =
  | 'antraege'
  | 'auslastung'
  | 'dokumente'
  | 'dokumentenscan'
  | 'devFixtures'
  | 'devInfraPanel'
  | 'feedback'
  | 'skillVerwaltung'
  | 'suche'
  | 'volltextsuche';

/**
 * Services, die ein Plugin in seinem `onInit`-Hook nutzen darf. Aktuell nur
 * `storage` — wenn weitere Services gebraucht werden (aiBridge, etc.), hier
 * ergaenzen.
 */
export interface PluginInitServices {
  storage: StorageService;
}

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
  /**
   * Optional: einmaliger Init-Hook, der nach `storage.init()` beim App-Start
   * aufgerufen wird (asynchron, fehlertolerant, non-blocking). Gedacht fuer
   * Pre-Caching von Sidecar-Dateien, Service-Bootstrap oder Default-Seeds.
   *
   * Erwartete Eigenschaften:
   *  - Idempotent: kann beliebig oft aufgerufen werden (Stores haben ihre
   *    eigenen Idempotenz-Guards).
   *  - Fehler werden vom App-Loader geschluckt — onInit darf scheitern, ohne
   *    den App-Start zu blockieren.
   *  - Sollte schnell sein (<1 s) — fuer schwere Operationen (Embedding-
   *    Korpus etc.) `scheduleIdle` o.ae. nutzen.
   *
   * Dinge die NICHT in onInit gehoeren: Daten die erst beim ersten Render
   * der Plugin-Seite gebraucht werden (laden sonst beim App-Start unnoetig).
   */
  onInit?: (services: PluginInitServices) => Promise<void>;
}
