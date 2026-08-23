import type { ComponentType } from 'react';
import type { StorageService } from '@/core/services/storage';
import type { ModulSlot } from '@/config/runtime-config';

/**
 * Feature-Flags, die einzelne Plugins gaten koennen. Subset von
 * `runtimeConfig.features` aus `scripts/config-schema.mjs` — gepflegt als
 * literal-Union, damit ein Tippfehler im Plugin-Index sofort als TS-Error
 * sichtbar wird. Bei einer neuen Plugin-Flag hier ergaenzen.
 */
export type PluginFeatureKey =
  | 'anfragen'
  | 'auslastung'
  | 'dokumente'
  | 'dokumentenscan'
  | 'doppelfoerderung'
  | 'devFixtures'
  | 'devInfraPanel'
  | 'mapFoerderfaehig'
  | 'meilensteinMonitoring'
  | 'skillVerwaltung'
  | 'statusCockpit'
  | 'vorgangssystem';

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
  /**
   * Sidebar-Gruppe — seit v2.362 wieder sichtbar getrennt (Trennlinie + Label):
   *
   * - `workflow` — der tägliche Weg, ganz oben und bewusst OHNE Beschriftung.
   * - `tools` — „Werkzeuge": stabil, aber seltener gebraucht.
   * - `erprobung` — „In Erprobung": Seiten, die noch nicht ausgereift sind.
   *   Zuklappbar. **Hier startet ein neues Plugin**, bis es sich bewährt hat.
   * - `system` — untere Gruppe ohne Label; trägt derzeit nur `hideFromNav`-Seiten
   *   (Einstellungen) und rendert damit nichts.
   * - `kuration` — Kurator-Gruppe (Trennlinie + Label, nur Kurator-Builds).
   *
   * Bewusst NICHT aus dem `featureFlag` abgeleitet: „in Erprobung" ist eine
   * Aussage über Reife, nicht über Sichtbarkeit — sonst wechselte eine Seite die
   * Gruppe als Nebenwirkung einer Flag-Änderung.
   */
  category: 'workflow' | 'tools' | 'erprobung' | 'system' | 'kuration' | 'werkbank';
  order: number;
  component: ComponentType;
  /** Wenn true, nur sichtbar für User mit `profile.is_kurator === true`. */
  kuratorOnly?: boolean;
  /**
   * v3.0: Laufzeit-Schloss. Das Plugin ist einkompiliert (`featureFlag`), aber erst
   * sichtbar, nachdem der Slot per Zusatzpasswort freigeschaltet wurde
   * (`moduleAuth.<slot>` in der Variant-Config). Fehlt das Schloss in der Config,
   * ist nichts gesperrt — dev/local verhalten sich unveraendert.
   *
   * Der Filter sitzt in ShellLayout (Sidebar/Command-Palette/Shortcuts), die Route
   * schuetzt zusaetzlich `ModulSchlossGate` gegen Deep-Links.
   */
  modulSchloss?: ModulSlot;
  /**
   * Wenn true, taucht das Plugin NICHT in der Sidebar-Nav (und den Nav-Command-
   * Items) auf — seine Route bleibt aber registriert und erreichbar (Bookmarks,
   * Deep-Links, Redirects). Genutzt für Seiten, die über andere Wege erreicht
   * werden (z.B. Feedback-Board via Footer-Dialog, Chat via Suche-Assistent).
   */
  hideFromNav?: boolean;
  /**
   * Optionaler Nav-Hinweis-Marker. `'global'` rendert rechtsbündig ein kleines
   * Globus-Icon mit Tooltip „Änderungen wirken für alle Nutzer" — für Seiten,
   * deren Bearbeitung team-weit wirkt (z.B. Skill-Verwaltung).
   */
  navHint?: 'global';
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
