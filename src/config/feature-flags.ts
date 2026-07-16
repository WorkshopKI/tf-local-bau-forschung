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

export function menuLabel(key: 'antraege' | 'dokumente', fallback: string): string {
  const v = menuLabels[key];
  return (typeof v === 'string' && v.trim()) ? v : fallback;
}

export function isKuratorMenusEnabled(): boolean {
  return features.kuratorMenus;
}

/** v2.16: True wenn der Build eine Rollen-Passwort-Wall beim Start erzwingt
 *  (pl + kurator). Build-time Verifier in `runtimeConfig.auth`. Siehe
 *  AppPasswordGate + app-password.ts. */
export function isAppGateRequired(): boolean {
  return runtimeConfig.auth?.required === true;
}

/** v2.21: True nur im reinen prod-Endkunden-Build (variant=production OHNE
 *  Rollen-Passwort-Wall). pl + kurator sind ebenfalls variant=production, aber
 *  per `auth.required` (AppPasswordGate) abgegrenzt; dev/demo per Variante.
 *  Genutzt um den Onboarding-Tour-Auto-Start auf prod zu beschränken. */
export function isEndUserProdVariant(): boolean {
  return runtimeConfig.variant === 'production' && !isAppGateRequired();
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
export function isDokumenteEnabled(): boolean { return features.dokumente; }
/** Dev-only: Löschen von Feedback-Tickets im Kurator-Dashboard (nach Bestätigung).
 *  Destruktiv — nur im dev-Build true. `=== true` für Backward-Kompat mit
 *  pre-2.18-Configs ohne den Flag. */
export function isFeedbackDeleteEnabled(): boolean { return features.feedbackDelete === true; }
export function isAuslastungEnabled(): boolean { return features.auslastung === true; }
/** Kürzel-Auswahl als Dropdown (statt Freitext) im Einstellungs-Profil, ohne das
 *  volle Auslastungs-Modul. Für AS (auslastung aus, aber Bearbeiter-Filter wie
 *  PL). Fällt auf `auslastung` zurück → pl/dev/kurator unverändert. */
export function isKuerzelDropdownEnabled(): boolean {
  return features.kuerzelDropdown === true || isAuslastungEnabled();
}
/** v2.47: Lokaler Themenkorpus-Build erlaubt? Der Build laedt ein ~200-MB-
 *  Embedding-Modell in den Main-Thread-RAM und kann in speicherarmen, geteilten
 *  Umgebungen (Citrix, mehrere User pro Host) den Renderer per Out-of-Memory
 *  crashen ("Aw, Snap"). In der Citrix-pl-Config auf false → die Build-Buttons
 *  ("Corpus aufbauen"/"Inkrementell") sind ausgeblendet, nur "Vom Datenspeicher
 *  laden" bleibt (= dokumentiertes "einer baut, alle laden"-Modell). Default
 *  true (`!== false`: fehlender Flag = erlaubt, Backward-Kompat). */
export function isEmbeddingCorpusBuildEnabled(): boolean {
  return features.embeddingCorpusBuild !== false;
}
/** v2.56: True wenn das Auslastungs-Modul auf reine Themen-Vektoren-Korpus-
 *  Pflege beschränkt ist (kurator-Variante) — schlanker Korpus-View statt
 *  voller PL-Tabs, MA-mutierende Mount-Hooks (reconcile/autoCollect) bleiben
 *  aus. So kann der Kurator den Embedding-Katalog aktuell halten, ohne MA-
 *  Auslastung zu sehen oder zuzuweisen. Default false. */
export function isAuslastungNurKorpusEnabled(): boolean {
  return features.auslastungNurKorpus === true;
}
/** v2.59: „Online"-Tab in den Einstellungen (PL sieht zuletzt aktive Team-User).
 *  Nur pl + dev. Default false. */
export function isOnlineStatusTabEnabled(): boolean {
  return features.onlineStatusTab === true;
}
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
 *  Profil (pl-Variante — die PL schreibt die Auslastungs-Klassifizierung nach
 *  `_intern/auslastung.json`; kurator-Variante — Schreibrecht durchgehend, statt
 *  erst nach dem Passwort-Login, v2.30.1). Ausnahme vom v2.0-read-only-Hardening. */
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
/** Gutachten-Testballon: KI-gestützte Kurzfassung auf der Förderantrags-
 *  Detailseite (erster „Mini-Agent" — Dokumenten-Aufnahme → Skill → Review →
 *  DOCX-Vorlage). Nur dev. Default false (`=== true`, Backward-Kompat). */
export function isGutachtenKurzfassungEnabled(): boolean {
  return features.gutachtenKurzfassung === true;
}
/** Gutachten-Workflow A–G (deterministischer Runner über Registry-Skills) — löst
 *  die Kurzfassung-Sektion ab. Nur dev. Default false (`=== true`). */
export function isGutachtenWorkflowEnabled(): boolean {
  return features.gutachtenWorkflow === true;
}
/** NF-Nachforderungen (Artefakt-Engine): Pro-TV-NF-Entwürfe auf der Verbund-
 *  Detailseite (Baustein-Auswahl/-Füllung → QS → DOCX + E-Mail-Entwurf). Nur dev
 *  (Testballon). Default false (`=== true`, Backward-Kompat). */
export function isNfNachforderungenEnabled(): boolean {
  return features.nfNachforderungen === true;
}
/** Antrag-Aufbereitung: Vollbild-Aufbereitung der VB (Gliederung + Tabellen-Ernte,
 *  Zeitplan-Gantt + Text↔Anlage-5-Plausibilität). Paket 1 rein deterministisch
 *  (kein LLM). Nur dev. Default false (`=== true`, Backward-Kompat). */
export function isAntragAufbereitungEnabled(): boolean {
  return features.antragAufbereitung === true;
}
/** Aufrufer-seitige Ableitung: dürfen Workflow-Entwürfe (`freigabe:'entwurf'`)
 *  sichtbar/ausführbar sein? Explizites Flag gewinnt; fehlt es, gilt es in
 *  `development`-Builds als an (dev sieht Entwürfe, prod-artige Configs nicht).
 *  EINE Quelle für die Gate-Ableitung (die reine `istWorkflowVerfuegbar`
 *  bekommt das Ergebnis als Arg — kein `runtimeConfig` in der Gate-Logik). */
export function erlaubeWorkflowEntwuerfe(): boolean {
  return features.workflowEntwuerfe ?? (runtimeConfig.variant === 'development');
}
/** LLM-Kontextlänge-Einstellung (KI-Assistent-Tab) sichtbar machen, wo die
 *  LLM-Skill-Generierung läuft — Kurzfassung ODER Gutachten-Workflow (dev + pl).
 *  Aus dem Wert wird der VB-Schwellwert abgeleitet ([llm-context.ts]). */
export function isLlmKontextSettingEnabled(): boolean {
  return isGutachtenKurzfassungEnabled() || isGutachtenWorkflowEnabled() || isNfNachforderungenEnabled();
}
/** Skill-Verwaltung (Kurator-pflegbare Skill-/Regel-Registry). Sichtbar dev +
 *  kurator + pl. Default false. */
export function isSkillVerwaltungEnabled(): boolean {
  return features.skillVerwaltung === true;
}
/** Modul „Anfragen": E-Mail-Kurzanfrage (.msg) → interne KI-Anonymisierung →
 *  Export in den externen ZIM FAQ-Assistenten → deterministische Wiedereinsetzung.
 *  Plugin gegated über `featureFlag: 'anfragen'`. Aktiv in dev + pl + as (nicht
 *  prod/kurator). Der Anonymisierer-SKILL ist davon unabhängig `aktiv: false`
 *  geseedet (Recall-Gate; in dev per Runtime-Override immer freigeschaltet).
 *  Default false (`=== true`, Backward-Kompat). Detail: docs/architecture/anfragen-modul.md. */
export function isAnfragenEnabled(): boolean {
  return features.anfragen === true;
}
/** Kanonischer Code-Default der ZIM-FAQ-Assistent-URL (Modul „Anfragen") — die
 *  EINZIGE Quelle im Code. `scripts/config-schema.mjs` trägt die URL NICHT mehr
 *  doppelt (nur optionaler Per-Variant-Override-Slot). Team-weite Laufzeit-
 *  Änderung läuft über Kuration → Anfragen (Sidecar `_intern/anfragen-settings.json`). */
export const DEFAULT_ANFRAGEN_DASHBOARD_URL =
  'https://claude.ai/public/artifacts/5faeb8ed-c446-4050-aad8-3464094a2b9f';

/** Build-Config-Wert ODER Code-Default. (Laufzeit-Override aus dem Share wird
 *  in `resolveAnfragenDashboardUrl` davorgeschaltet.) */
export function getAnfragenDashboardUrl(): string {
  return runtimeConfig.anfragen?.dashboardUrl || DEFAULT_ANFRAGEN_DASHBOARD_URL;
}

/** Kanonische Code-Defaults der Deep-Research-Ziel-URLs (Antrag-Aufbereitung, nur dev)
 *  — die EINZIGE Quelle im Code (config-schema.mjs trägt nur optionale Override-Slots).
 *  Team-weite Laufzeit-Änderung läuft über den Sidecar `_intern/aufbereitung-settings.json`. */
export const DEFAULT_AUFBEREITUNG_CHATGPT_URL = 'https://chatgpt.com/';
export const DEFAULT_AUFBEREITUNG_CLAUDE_URL = 'https://claude.ai/new';
export const DEFAULT_AUFBEREITUNG_MISTRAL_URL = 'https://chat.mistral.ai/chat';

export interface AufbereitungDrUrls {
  chatgpt: string;
  claude: string;
  mistral: string;
}

/** Build-Config-Werte ODER Code-Defaults der DR-Ziel-URLs. (Laufzeit-Override aus dem
 *  Share wird in `resolveAufbereitungSettings` davorgeschaltet.) */
export function getAufbereitungDrUrls(): AufbereitungDrUrls {
  const c = runtimeConfig.aufbereitung;
  return {
    chatgpt: c?.chatgptUrl || DEFAULT_AUFBEREITUNG_CHATGPT_URL,
    claude: c?.claudeUrl || DEFAULT_AUFBEREITUNG_CLAUDE_URL,
    mistral: c?.mistralUrl || DEFAULT_AUFBEREITUNG_MISTRAL_URL,
  };
}
/** In-App Streamlit-Bridge-Installer im KI-Assistent-Tab (Streamlit-URL +
 *  Bookmarklet + Verbindungstest). Zugang zum internen gpt-oss ohne API.
 *  Sichtbar in dev + prod + kurator + pl. Default false. */
export function isStreamlitBridgeEnabled(): boolean {
  return features.streamlitBridge === true;
}
/**
 * Darf der aktuelle Build/Nutzer die Skill-Registry SCHREIBEN? Komponiert aus
 * bestehenden Primitiven — KEIN neues Auth-Muster:
 *  - dev (`build:dev` + `npm run dev`): IMMER voll editierbar — der Entwickler
 *    muss alles testen können, ohne erst die Kurator-Session zu aktivieren.
 *  - pl-Build (Schreibrecht auf dem Share, aber ohne Kurator-Login) editiert
 *    direkt: `datenShareSchreibrecht && !kuratorMenus` identifiziert pl eindeutig.
 *  - sonst (kurator): nur mit aktiver Kurator-Session; prod/demo read-only.
 * Physischer Guard bleibt `queryPermission` in `writeSkillRegistry`.
 */
export function canEditSkillRegistry(sessionActive: boolean): boolean {
  if (isDevContext()) return true;
  if (isDatenShareWritable() && !isKuratorMenusEnabled()) return true;
  return sessionActive;
}

/** Assistent Phase 0: gerätelokales, opt-in Ereignisprotokoll (Recorder + „Assistent
 *  & Gedächtnis"-Einstellungssektion). Fundament für den späteren persönlichen
 *  Assistenten — in Phase 0 KEIN LLM/Chat/UI-Assistent. Nur dev. Default false
 *  (`=== true`, Backward-Kompat). */
export function isAssistentProtokollEnabled(): boolean {
  return features.assistentProtokoll === true;
}

/** Assistent Phase 1: kontextbewusstes Assistenz-Panel (deterministisch
 *  assemblierter Kontext, intern-only Transport, session-only Historie). Nur dev.
 *  Default false (`=== true`, Backward-Kompat). Baut auf [[assistent-protokoll]]
 *  (Phase 0) NICHT auf — Phase 1 liest das Protokoll bewusst nicht. */
export function isAssistentPanelEnabled(): boolean {
  return features.assistentPanel === true;
}

/** Assistent Phase 2: Gedächtnis-Konsolidierung (Sleep-time). Hintergrundlauf
 *  destilliert das [[assistent-protokoll]] per INTERNEM Modell in Memory-Blocks;
 *  doppeltes Opt-in (setzt das Protokoll-Opt-in voraus). Nur dev. Default false
 *  (`=== true`, Backward-Kompat). */
export function isAssistentGedaechtnisEnabled(): boolean {
  return features.assistentGedaechtnis === true;
}

export function isSucheEnabled(): boolean { return features.suche; }
/** v2.18: CSV-Auto-Refresh-Banner + „CSV-Quelle verknüpfen"-Picker auch ohne
 *  Kurator-Menüs (z.B. pl-Variante). Der Kurator-Banner läuft unabhängig über
 *  `isKuratorMenusEnabled()` — dieser Flag ist eine *zusätzliche* Bedingung für
 *  Nicht-Kurator-Builds. Braucht `datenShareSchreibrecht` (sonst kein Snapshot-
 *  Write). `=== true` für Backward-Kompat mit pre-2.18-Configs. */
export function isCsvAutoRefreshEnabled(): boolean {
  return features.csvAutoRefresh === true;
}

/** v2.97: Delta-Snapshots SCHREIBEN (nur Writer-Builds: pl + kurator + dev).
 *  Der Leser versteht Deltas immer — dieser Flag steuert nur das Schreiben.
 *  `=== true`: fehlt der Flag (alte Configs) → voller v1-Write wie bisher. */
export function isDeltaSnapshotWriteEnabled(): boolean {
  return features.deltaSnapshotWrite === true;
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
