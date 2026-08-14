/**
 * Type-safe Convenience-Accessors auf die Build-Time-Config.
 *
 * Komponenten importieren diese Helfer statt direkt auf `runtimeConfig.*.*`
 * zu tippen — so fällt das Umschreiben bei Schema-Änderungen leichter.
 */

import { runtimeConfig, MODUL_SLOTS, type ModulSlot } from './runtime-config';
import { registryEditierbar, type RegistryUmgebung } from './registry-zugang';

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

/**
 * v3.0: Sperrt DIESER Build das Modul hinter ein Zusatzpasswort?
 *
 * Reiner Config-Read (kein Store-Zugriff) — die Laufzeit-Antwort „ist es gerade
 * frei?" steht bewusst woanders (`@/core/modul-freischaltung`), weil ein
 * Store-Import hier den Zyklus feature-flags → useKuratorSession → kurator-config
 * → smb-handle → feature-flags schlösse. `npm run cycles` hat eine leere Allowlist.
 */
export function hatModulSchloss(slot: ModulSlot): boolean {
  return !!runtimeConfig.moduleAuth?.[slot];
}

/** Trägt der Build überhaupt Schlösser? (steuert die Einstellungs-Sektion) */
export function hatIrgendeinModulSchloss(): boolean {
  return MODUL_SLOTS.some(hatModulSchloss);
}

/** v2.21: True nur im reinen prod-Endkunden-Build (variant=production OHNE
 *  Rollen-Passwort-Wall). pl + kurator sind ebenfalls variant=production, aber
 *  per `auth.required` (AppPasswordGate) abgegrenzt; dev/demo per Variante.
 *  Genutzt um den Onboarding-Tour-Auto-Start auf prod zu beschränken. */
export function isEndUserProdVariant(): boolean {
  return runtimeConfig.variant === 'production' && !isAppGateRequired();
}

export function isDokumentenscanEnabled(): boolean {
  return features.dokumentenscan;
}

export function isDevInfraPanelEnabled(): boolean {
  return features.devInfraPanel;
}

export function isDevFixturesEnabled(): boolean {
  return features.devFixtures;
}

export function isDokumenteEnabled(): boolean { return features.dokumente; }
/** Dev-only: Löschen von Feedback-Tickets im Kurator-Dashboard (nach Bestätigung).
 *  Destruktiv — nur im dev-Build true. `=== true` für Backward-Kompat mit
 *  pre-2.18-Configs ohne den Flag. */
export function isFeedbackDeleteEnabled(): boolean { return features.feedbackDelete === true; }
/**
 * Ist das Auslastungs-Modul EINKOMPILIERT? (Bauzeit)
 *
 * Achtung: das ist NICHT „darf der Nutzer es sehen". Seit v3.0 liegt das Modul in
 * der pl-Variante hinter einem Zusatzpasswort — die Sichtbarkeits-Frage
 * beantwortet `isAuslastungFreigeschaltet()` in `@/core/modul-freischaltung`.
 * Ein Convention-Test haelt die wenigen erlaubten Aufrufstellen fest.
 */
export function isAuslastungEnabled(): boolean { return features.auslastung === true; }
/** Kürzel-Auswahl als Dropdown (statt Freitext) im Einstellungs-Profil.
 *
 *  v3.0: Der eigene `kuerzelDropdown`-Flag ist entfallen. Er existierte nur fuer
 *  die AS-Variante (Bearbeiter-Filter OHNE Auslastungs-Modul); im gemischten
 *  pl-Build ist das Modul immer einkompiliert, die Ableitung genuegt also. Bewusst
 *  am ROHEN Flag: der Bearbeiter-Filter bleibt auch bei gesperrtem Modul nutzbar. */
export function isKuerzelDropdownEnabled(): boolean {
  return isAuslastungEnabled();
}
/** v2.59: „Online"-Tab in den Einstellungen (PL sieht zuletzt aktive Team-User).
 *  Nur pl + dev. Default false. */
export function isOnlineStatusTabEnabled(): boolean {
  return features.onlineStatusTab === true;
}
/** v2.5: Klartext-Anzeige der TIB-Kürzel im Auslastungs-Modul.
 *
 *  v3.0: eigener Flag entfallen — alle Konsumenten liegen INNERHALB des Moduls,
 *  das seit der Varianten-Zusammenlegung selbst hinter einem Passwort liegt. Ein
 *  zweites Schloss im Tresor pflegte sich nur selbst. */
export function isDeAnonymisierungEnabled(): boolean {
  return isAuslastungEnabled();
}
/** v2.11: PL-UI „Zugangspasswort generieren" in der MA-Verwaltung.
 *
 *  v3.0: eigener Flag entfallen, gleiche Begründung wie `deAnonymisierung` —
 *  beide Konsumenten sitzen im Auslastungs-Modul. */
export function isMaVerwaltungPasswortEnabled(): boolean {
  return isAuslastungEnabled();
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
/**
 * Darf der aktuelle Build/Nutzer FREMDES Feedback verwalten (Status, Priorität,
 * Kategorie, Aufwand, interne Notiz, öffentliche Antwort, FAQ-Markierung)?
 *
 * Komponiert aus `canWriteDatenShare` — KEIN eigener Flag (Muster von
 * `canEditSkillRegistry`): wer die geteilte `feedback.json` schreiben darf,
 * verwaltet auch Feedback. Damit bekommt die pl-Variante die Bearbeitung ohne
 * Kurator-Profil (v2.364, `datenShareSchreibrecht: true`), während prod-Endnutzer
 * read-only bleiben und weiter über Kommentare/Stimmen mitwirken.
 *
 * Physischer Guard bleibt das self-gated `writeSharedFile` — dieses Prädikat
 * steuert nur die Sichtbarkeit der Bedienelemente. Destruktives Löschen hängt
 * zusätzlich an `isFeedbackDeleteEnabled()`.
 */
export function canManageFeedback(isKurator: boolean): boolean {
  return canWriteDatenShare(isKurator);
}
/** v2.11: MA-Login-Wall beim Start (Kuerzel aus Passwort entschluesselt). Nur
 *  prod + dev. Greift erst wenn die Zugangsdatei existiert (sonst Fallback aufs
 *  alte Kuerzelfeld). Siehe MaLoginGate + useMAIdentity + App.tsx-Startup-Gate. */
export function isMaLoginEnabled(): boolean {
  return features.maLogin === true;
}
/** Gutachten-Testballon: KI-gestützte Kurzfassung auf der Förderantrags-
 *  Detailseite (erster „Mini-Agent" — Dokumenten-Aufnahme → Skill → Review →
 *  DOCX-Vorlage). dev + pl. Default false (`=== true`, Backward-Kompat). */
export function isGutachtenKurzfassungEnabled(): boolean {
  return features.gutachtenKurzfassung === true;
}
/** Gutachten-Workflow A–G (deterministischer Runner über Registry-Skills) — löst
 *  die Kurzfassung-Sektion ab. dev + pl + kurator (der Kurator testet die von ihm
 *  gepflegten Skills am echten Workflow). Default false (`=== true`). */
export function isGutachtenWorkflowEnabled(): boolean {
  return features.gutachtenWorkflow === true;
}
/** NF-Nachforderungen (Artefakt-Engine): Pro-TV-NF-Entwürfe auf der Verbund-
 *  Detailseite (Baustein-Auswahl/-Füllung → QS → DOCX + E-Mail-Entwurf). dev + pl.
 *  Default false (`=== true`, Backward-Kompat). */
export function isNfNachforderungenEnabled(): boolean {
  return features.nfNachforderungen === true;
}
/** Artefakt-Werkbank: EIN Workspace (offene Punkte → Baustein-Auswahl → Entwurf
 *  NF/RNE/ABL) auf der Verbund-Detailseite. Ersetzt bei aktivem Flag die
 *  NachforderungenSection. dev + pl — immer ZUSAMMEN mit `nfNachforderungen`
 *  setzen, sonst bleibt die Artefakt-Leiste ohne NF-Karte
 *  (`useArtefaktLeiste`). Default false (`=== true`). */
export function isArtefaktWerkbankEnabled(): boolean {
  return features.artefaktWerkbank === true;
}
/** Antrag-Aufbereitung: Vollbild-Aufbereitung der VB (Gliederung + Tabellen-Ernte,
 *  Zeitplan-Gantt + Text↔Anlage-5-Plausibilität). Paket 1 rein deterministisch
 *  (kein LLM). dev + pl. Default false (`=== true`, Backward-Kompat). */
export function isAntragAufbereitungEnabled(): boolean {
  return features.antragAufbereitung === true;
}
/** Aufrufer-seitige Ableitung: dürfen Workflow-Entwürfe (`freigabe:'entwurf'`)
 *  sichtbar/ausführbar sein? Explizites Flag gewinnt; fehlt es, gilt es in
 *  `development`-Builds als an. pl + kurator sind `variant: "production"` und
 *  müssen den Flag deshalb EXPLIZIT setzen (tun sie — der Kurator gibt Workflows
 *  frei und muss seine eigenen Entwürfe sehen).
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
 *  Änderung läuft über Datenpflege → Dienste (Sidecar `_intern/anfragen-settings.json`). */
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
/** Die Konfig-Fakten für die Registry-Zugangs-Entscheidung an einer Stelle
 *  einsammeln. EINE Quelle für die Ableitung — die reine Logik lebt in
 *  [registry-zugang.ts] und bekommt das Ergebnis als Arg (kein `runtimeConfig`
 *  in der Gate-Logik, sonst ist sie über die Varianten-Matrix nicht testbar). */
export function registryUmgebung(sessionAktiv: boolean): RegistryUmgebung {
  return {
    devKontext: isDevContext(),
    skillVerwaltung: isSkillVerwaltungEnabled(),
    datenShareSchreibrecht: isDatenShareWritable(),
    sessionAktiv,
  };
}

/**
 * Darf der aktuelle Build/Nutzer die Skill-Registry SCHREIBEN? Komponiert aus
 * bestehenden Primitiven — KEIN neues Auth-Muster. Die Fallunterscheidung
 * (dev/local · pl/as · kurator · prod) steht in `registryEditierbar`.
 * Physischer Guard bleibt `queryPermission` in `writeSkillRegistry`.
 */
export function canEditSkillRegistry(sessionActive: boolean): boolean {
  return registryEditierbar(registryUmgebung(sessionActive));
}

/** Assistent Phase 0: gerätelokales, opt-in Ereignisprotokoll (Recorder + „Assistent
 *  & Gedächtnis"-Einstellungssektion). Fundament für den späteren persönlichen
 *  Assistenten — in Phase 0 KEIN LLM/Chat/UI-Assistent. dev + pl + kurator + as;
 *  Freischaltung ≠ Aufzeichnung (bleibt opt-in + gerätelokal, Pitfall #37).
 *  Default false (`=== true`, Backward-Kompat). */
export function isAssistentProtokollEnabled(): boolean {
  return features.assistentProtokoll === true;
}

/** Assistent Phase 1: kontextbewusstes Assistenz-Panel (deterministisch
 *  assemblierter Kontext, intern-only Transport, session-only Historie).
 *  dev + pl + kurator + as. Default false (`=== true`, Backward-Kompat). Baut auf [[assistent-protokoll]]
 *  (Phase 0) NICHT auf — Phase 1 liest das Protokoll bewusst nicht. */
export function isAssistentPanelEnabled(): boolean {
  return features.assistentPanel === true;
}

/** Assistent Phase 2: Gedächtnis-Konsolidierung (Sleep-time). Hintergrundlauf
 *  destilliert das [[assistent-protokoll]] per INTERNEM Modell in Memory-Blocks;
 *  doppeltes Opt-in (setzt das Protokoll-Opt-in voraus). dev + pl + kurator + as;
 *  setzt `assistentPanel` + `assistentProtokoll` voraus (von `validateConfig`
 *  erzwungen). Default false (`=== true`, Backward-Kompat). */
export function isAssistentGedaechtnisEnabled(): boolean {
  return features.assistentGedaechtnis === true;
}

/** MAP „Neuer Prüf-Workflow": Einreichungs-Import per Drag & Drop, deterministische
 *  Rechenchecks und eine im Betrieb editierbare, versionierte Förderfähigkeits-
 *  Checkliste. Die Einreichung ist eine eigene kv-Entität — der Flag gated kein
 *  Verhalten der Antrags-Pipeline. dev + pl. Default false (`=== true`,
 *  Backward-Kompat). */
export function isMapFoerderfaehigEnabled(): boolean {
  return features.mapFoerderfaehig === true;
}

/** Status-System neu: kuratierbarer Status-Katalog + append-only Historie +
 *  deterministische Ableitungs-Engine + Cockpit/Timeline/Widget. Gated die
 *  gesamte neue Schicht (Katalog-Init, Event-Emission, Cockpit, Timeline,
 *  Konflikt-Badges, Widget). dev/pl/kurator. Default false (`=== true`,
 *  Backward-Kompat). */
export function isStatusCockpitEnabled(): boolean {
  return features.statusCockpit === true;
}

/** Bearbeitungs-Meilensteine + Fristen-Monitoring: kuratierbarer Meilenstein-Plan
 *  (Soll-Wochen nach Antragseingang) + deterministische Bewertung
 *  erreicht/fällig/gerissen + Prognose zur 3-Monats-Gesamtfrist. Gated Plugin,
 *  Home-Widget, Detailseiten-Sektion und den Post-Import-Pass. Eigene Achse neben
 *  dem amtlichen Status; die Anzeige-`Prominenz` des Status-Katalogs bleibt
 *  unberührt. dev/pl/as/kurator. Default false (`=== true`, Backward-Kompat). */
export function isMeilensteinMonitoringEnabled(): boolean {
  return features.meilensteinMonitoring === true;
}

/**
 * Vorgangssystem: Status-Erklärung (Info-Icon), Kürzel-Glossar + Nächster-
 * Schritt-Navigator, To-do-Board, Stillstands-Wächter, Fristen-Cockpit.
 *
 * Leitidee: die App ist **Companion** des Fachsystems, nicht zweite
 * Workflow-Engine — sie leitet keinen Status ab, sondern stellt Erklärung,
 * Navigation und Warnung DANEBEN. dev + pl.
 *
 * **Setzt `statusCockpit` voraus.** Ohne den Flag läuft `initStatusKatalog` gar
 * nicht, es gibt also keinen Katalog, aus dem Codes, ZAH-Phasen oder Trigger
 * gelesen werden könnten. Statt die halbe Oberfläche leer anzuzeigen, ist das
 * Vorgangssystem dann geschlossen — eine Konfiguration mit `vorgangssystem: true`
 * und `statusCockpit: false` ist ein Konfigurations-Fehler, kein Sonderfall.
 */
export function isVorgangssystemEnabled(): boolean {
  return features.vorgangssystem === true && isStatusCockpitEnabled();
}

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
