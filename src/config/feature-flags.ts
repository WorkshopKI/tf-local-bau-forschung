/**
 * Type-safe Convenience-Accessors auf die Build-Time-Config.
 *
 * Komponenten importieren diese Helfer statt direkt auf `runtimeConfig.*.*`
 * zu tippen — so fällt das Umschreiben bei Schema-Änderungen leichter.
 */

import { runtimeConfig } from './runtime-config';

export const features = runtimeConfig.features;
export const kiConfig = runtimeConfig.ki;
export const dataConfig = runtimeConfig.data;
export const brandingConfig = runtimeConfig.branding;
export const menuLabels = runtimeConfig.menuLabels ?? {};
/** Phase-2 Scan-Config mit sicheren Defaults. */
export const scanConfig = runtimeConfig.scan ?? {
  sub_roots: [],
  file_extensions: [],
  max_depth: 20,
  fkz_allowed_prefixes: [],
};

export function menuLabel(key: 'antraege' | 'bauantraege' | 'dokumente', fallback: string): string {
  const v = menuLabels[key];
  return (typeof v === 'string' && v.trim()) ? v : fallback;
}

export function isKuratorMenusEnabled(): boolean {
  return features.kuratorMenus;
}

export function isFeedbackEnabled(): boolean {
  return features.feedback;
}

export function isDokumentenscanEnabled(): boolean {
  return features.dokumentenscan;
}

export function isVolltextsucheEnabled(): boolean {
  return features.volltextsuche;
}

export function isDevInfraPanelEnabled(): boolean {
  return features.devInfraPanel;
}

export function isDevFixturesEnabled(): boolean {
  return features.devFixtures;
}

export function isAntraegeEnabled(): boolean { return features.antraege; }
export function isBauantraegeEnabled(): boolean { return features.bauantraege; }
export function isDokumenteEnabled(): boolean { return features.dokumente; }
export function isAuslastungEnabled(): boolean { return features.auslastung === true; }
/** Homepage-Selbsteintragung + Banner. End-User-Feature, getrennt vom PL-
 *  Plugin (`auslastung`). Wer das Plugin aktiviert hat, will i.d.R. auch
 *  die Selbsteintragung — wenn der Flag fehlt, fallen wir auf `auslastung`
 *  zurueck (Backwards-Kompat fuer pre-1.17-Configs). */
export function isAuslastungSelbstEintragungEnabled(): boolean {
  if (typeof features.auslastungSelbstEintragung === 'boolean') {
    return features.auslastungSelbstEintragung;
  }
  return features.auslastung === true;
}
/** v2.5: Klartext-Anzeige der TIB-Kuerzel im Auslastungs-Modul, mit Passwort
 *  freischaltbar (24h-Session). Nur in dev + pl Varianten aktiviert. */
export function isDeAnonymisierungEnabled(): boolean {
  return features.deAnonymisierung === true;
}
export function isChatEnabled(): boolean { return features.chat; }
export function isSucheEnabled(): boolean { return features.suche; }
export function isFeedbackBoardEnabled(): boolean { return features.feedbackBoard; }

/**
 * True nur im Entwickler-Kontext: `npm run build:dev` (variant=development) und
 * `npm run dev` (variant=custom, DEFAULT_CONFIG). Production-Varianten
 * (prod/kurator/pl) und demo fallen raus. Wird z.B. für den KI-Assistent-Tab
 * in den Einstellungen genutzt — Endkunden konfigurieren keine LLM-Endpoints.
 */
export function isDevContext(): boolean {
  return runtimeConfig.variant === 'development' || runtimeConfig.variant === 'custom';
}

export function isOpenRouterEnabled(): boolean {
  return kiConfig.openrouter.enabled;
}

export function isLocalLlamaEnabled(): boolean {
  return kiConfig.localLlama.enabled;
}

export function hasFixedDataSharePath(): boolean {
  return typeof dataConfig.fixedDataSharePath === 'string' && dataConfig.fixedDataSharePath.length > 0;
}

export function isDemoDataBundled(): boolean {
  return dataConfig.demoDataBundled === true;
}

export function isDataShareEnabled(): boolean {
  return hasFixedDataSharePath() || dataConfig.allowUserToChangePath === true;
}
