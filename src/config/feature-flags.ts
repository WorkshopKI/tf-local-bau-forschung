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

/**
 * @deprecated v2.16 — abgeloest durch das build-time Rollen-Passwort-Gate
 * (`isAppGateRequired` / runtimeConfig.auth). Bleibt nur fuer Legacy-Configs +
 * die Validierungs-Deprecation-Warnung erhalten.
 *
 * v2.10: True nur in der kurator-Variante — erzwang beim App-Start eine
 * Kurator-Login-Wall (Passwort gegen kurator-config.enc auf dem Share).
 */
export function isKuratorLoginRequired(): boolean {
  return features.requireKuratorLogin === true;
}

/** v2.16: True wenn der Build eine Rollen-Passwort-Wall beim Start erzwingt
 *  (pl + kurator). Build-time Verifier in `runtimeConfig.auth`. Siehe
 *  AppPasswordGate + app-password.ts. */
export function isAppGateRequired(): boolean {
  return runtimeConfig.auth?.required === true;
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
/** v2.x: Build erlaubt Schreibzugriff auf den Daten-Share auch ohne Kurator-
 *  Profil (z.B. pl-Variante — die PL schreibt die Auslastungs-Klassifizierung
 *  nach `_intern/auslastung.json`). Ausnahme vom v2.0-read-only-Hardening. */
export function isDatenShareWritable(): boolean {
  return features.datenShareSchreibrecht === true;
}
/** Effektives Daten-Share-Schreibrecht: Kurator-Profil ODER der Build erlaubt
 *  es generell (`datenShareSchreibrecht`). EINZIGE Stelle, an der der
 *  Picker-/Grant-Mode (`read` vs `readwrite`) fuer den Daten-Share entschieden
 *  wird — alle Call-Sites (WelcomeScreen, StartupScreen, SpeicherTab,
 *  refreshAllPermissions, needsDatenShareDowngrade, Visibility-Probe) routen
 *  hier durch. */
export function canWriteDatenShare(isKurator: boolean): boolean {
  return isKurator || isDatenShareWritable();
}
/** v2.11: MA-Login-Wall beim Start (Kuerzel aus Passwort entschluesselt). Nur
 *  prod + dev. Greift erst wenn die Zugangsdatei existiert (sonst Fallback aufs
 *  alte Kuerzelfeld). Siehe MaLoginGate + useMAIdentity + App.tsx-Startup-Gate. */
export function isMaLoginEnabled(): boolean {
  return features.maLogin === true;
}
/** v2.11: PL-UI „Zugangspasswort generieren" in der MA-Verwaltung. Nur pl + dev. */
export function isMaVerwaltungPasswortEnabled(): boolean {
  return features.maVerwaltungPasswort === true;
}
export function isChatEnabled(): boolean { return features.chat; }
export function isSucheEnabled(): boolean { return features.suche; }
export function isFeedbackBoardEnabled(): boolean { return features.feedbackBoard; }
/** v2.18: CSV-Auto-Refresh-Banner + „CSV-Quelle verknüpfen"-Picker auch ohne
 *  Kurator-Menüs (z.B. pl-Variante). Der Kurator-Banner läuft unabhängig über
 *  `isKuratorMenusEnabled()` — dieser Flag ist eine *zusätzliche* Bedingung für
 *  Nicht-Kurator-Builds. Braucht `datenShareSchreibrecht` (sonst kein Snapshot-
 *  Write). `=== true` für Backward-Kompat mit pre-2.18-Configs. */
export function isCsvAutoRefreshEnabled(): boolean {
  return features.csvAutoRefresh === true;
}

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
