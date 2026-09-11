import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AppRouter } from '@/core/Router';
import { Onboarding } from '@/core/Onboarding';
import { WelcomeScreen } from '@/core/WelcomeScreen';
import { StartupScreen } from '@/core/StartupScreen';
import { AppPasswordGate } from '@/core/AppPasswordGate';
import { MaLoginGate } from '@/core/MaLoginGate';
import { enabledPlugins } from '@/plugins.config';
import { StorageService } from '@/core/services/storage';
import { StorageContext } from '@/core/hooks/useStorage';
import { AIBridge } from '@/core/services/ai/bridge';
import { AIBridgeContext } from '@/core/hooks/useAIBridge';
import { SearchContext, useSearchProvider } from '@/core/hooks/useSearch';
import { TagContext, useTagProvider } from '@/core/hooks/useTags';
import { ProfileContext, useProfileProvider } from '@/core/hooks/useProfile';
import { TourContext, useTour } from '@/core/hooks/useTour';
import { TOUR_STEPS } from '@/core/components/tour/tourSteps';
import { ErrorBoundary } from '@/core/ErrorBoundary';
import { applyThemeColor, farbeAusProfil, setDarkMode } from '@/components/ui/theme';
import { checkQuarterReset, loadFeedbackConfig } from '@/core/services/feedback';
import {
  getDatenShareHandle,
  needsDatenShareDowngrade,
} from '@/core/services/infrastructure/smb-handle';
import { NEEDS_HANDLE_DOWNGRADE_IDB_KEY } from '@/core/services/infrastructure/types';
import { brauchtShareUmzug, leseShareGeneration } from '@/core/services/infrastructure/share-generation';
import { sorgeFuerLokalesProfil } from '@/core/services/infrastructure/local-fs/boot';
import { installiereTfHook } from '@/dev-fixtures/window-hook';
import { listProgramme } from '@/core/services/csv';
import { scheduleIdle } from '@/core/utils/scheduleIdle';
import { ensureListViewProjection } from '@/core/services/csv/list-view-migration';
import { initProtokoll } from '@/core/services/assistent/protokoll';
import { initGedaechtnis, starteKonsolidierungWennFaellig } from '@/core/services/assistent/gedaechtnis';
import { initStatusKatalog } from '@/core/status';
import { useSichtbarkeitStore } from '@/core/sichtbarkeit';
import { bumpCsvSourcesSignal } from '@/core/services/csv/csv-sources-signal';
import { useStartupDataStatus } from '@/core/services/csv/startup-data-status';
import { runDataUpdate } from '@/plugins/csv-sources-kuration/services/data-update';
import { phaseToastLabel, completionToast } from '@/plugins/csv-sources-kuration/services/data-update-toast';
import { useStartBericht } from '@/plugins/csv-sources-kuration/services/start-bericht';
import { migrateLegacyDmsSource } from '@/core/services/dms-sources';
import { runtimeConfig } from '@/config/runtime-config';
import { isDemoDataBundled, dataConfig, isMaLoginEnabled, canWriteDatenShare } from '@/config/feature-flags';
import { useMAIdentity } from '@/core/hooks/useMAIdentity';
import { anmeldungSteht } from '@/core/hooks/useAppGateSession';
import { schliesseGesperrteModule, spiegleKuratorSchalterInSession } from '@/core/modul-freischaltung';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useModulFreischaltung } from '@/core/hooks/useModulFreischaltung';
import { seedTestData } from '@/core/services/seed/seed-data';
import { useConnectionState } from '@/core/services/connection-status';
import { useVisibilityPermissionProbe } from '@/core/hooks/useVisibilityPermissionProbe';
import type { UserProfile, AIProviderConfig } from '@/core/types/config';

function AppProviders({
  storage, aiBridge,
  showOnboarding, setShowOnboarding,
  showWelcome, setShowWelcome,
  showStartup, onStartupReady,
  showAppGate, setShowAppGate,
  showMaLoginGate, setShowMaLoginGate,
  needsDowngrade,
  needsInitialPick,
  needsShareUmzug, onUmzugFertig,
  initialProfile,
  seedToast, setSeedToast,
  syncToast, setSyncToast,
}: {
  storage: StorageService;
  aiBridge: AIBridge;
  showOnboarding: boolean;
  setShowOnboarding: (v: boolean) => void;
  showWelcome: boolean;
  setShowWelcome: (v: boolean) => void;
  showStartup: boolean;
  /** v2.16: laeuft wenn der StartupScreen fertig ist — setzt showStartup=false
   *  und entscheidet danach ueber die Rollen-Passwort-Wall (pl + kurator). */
  onStartupReady: () => void;
  showAppGate: boolean;
  setShowAppGate: (v: boolean) => void;
  /** v2.11: MA-Login-Wall (nur prod-Variante, maLogin). */
  showMaLoginGate: boolean;
  setShowMaLoginGate: (v: boolean) => void;
  needsDowngrade: boolean;
  needsInitialPick: boolean;
  /** v4.0: Der Daten-Share ist umgezogen — Re-Pick erzwingen (Umzugs-Banner). */
  needsShareUmzug: boolean;
  /** v4.0: laeuft nach erfolgreichem Umzugs-Re-Pick. Statt direkt weiterzugehen
   *  wird das Handle-Gate erneut ausgewertet, damit der uebersprungene
   *  Downgrade-Check im selben Start nachgeholt wird. */
  onUmzugFertig: () => void;
  initialProfile: UserProfile | null;
  seedToast: string | null;
  setSeedToast: (v: string | null) => void;
  syncToast: string | null;
  setSyncToast: (v: string | null) => void;
}): React.ReactElement {
  const searchValue = useSearchProvider(storage);
  const tagValue = useTagProvider(storage);
  const profileValue = useProfileProvider(storage);
  const tourValue = useTour(TOUR_STEPS.length);
  const [quarterToast, setQuarterToast] = useState<string | null>(null);

  const profileName = profileValue.profile?.name;
  const isKurator = profileValue.profile?.is_kurator === true || profileValue.profile?.is_admin === true || initialProfile?.is_kurator === true || initialProfile?.is_admin === true;

  // Phase 3: Quartals-Reset-Check + Toast
  useEffect(() => {
    if (!profileName || showOnboarding) return;
    let cancelled = false;
    (async () => {
      const cfg = await loadFeedbackConfig(storage);
      const result = checkQuarterReset(profileName, cfg.budget_points_per_quarter);
      if (!cancelled && result.resetHappened) {
        setQuarterToast(`Neues Quartal (${result.currentQuarter}) — deine Sponsoring-Punkte wurden aufgefrischt.`);
        setTimeout(() => setQuarterToast(null), 6000);
      }
    })();
    return () => { cancelled = true; };
  }, [profileName, showOnboarding, storage]);

  return (
    <AIBridgeContext.Provider value={aiBridge}>
      <ProfileContext.Provider value={profileValue}>
        <SearchContext.Provider value={searchValue}>
          <TagContext.Provider value={tagValue}>
            <TourContext.Provider value={tourValue}>
              {showOnboarding ? (
                <Onboarding onComplete={async () => {
                  await profileValue.reloadProfile();
                  setShowOnboarding(false);
                }} />
              ) : showAppGate ? (
                // v2.61.2: Rollen-Passwort-Wall VOR dem StartupScreen/Stepper — erst
                // anmelden, dann Ordner freigeben (keine Berechtigungs-Prompts vor
                // der Auth-Wall). Der Stepper läuft nach erfolgreichem Login.
                <AppPasswordGate onSuccess={() => setShowAppGate(false)} />
              ) : showWelcome ? (
                <WelcomeScreen onComplete={() => setShowWelcome(false)} isKurator={isKurator} />
              ) : showStartup ? (
                <StartupScreen
                  profile={profileValue.profile ?? initialProfile}
                  needsDowngrade={needsDowngrade}
                  needsInitialPick={needsInitialPick}
                  needsShareUmzug={needsShareUmzug}
                  onUmzugFertig={onUmzugFertig}
                  onReady={onStartupReady}
                />
              ) : showMaLoginGate ? (
                <MaLoginGate onSuccess={() => setShowMaLoginGate(false)} />
              ) : (
                <AppRouter plugins={enabledPlugins} />
              )}
              {quarterToast && (
                <div
                  className="fixed top-4 right-4 z-[60] max-w-[360px] px-3.5 py-2.5 rounded-[var(--tf-radius-lg)] bg-[var(--tf-bg)] text-[12.5px] text-[var(--tf-text)] shadow-lg animate-in fade-in slide-in-from-top-2"
                  style={{ border: '0.5px solid var(--tf-border)' }}
                  role="status"
                >
                  <div className="flex items-start gap-2">
                    <span>🎉</span>
                    <div className="flex-1">{quarterToast}</div>
                    <button
                      type="button"
                      onClick={() => setQuarterToast(null)}
                      className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
                      aria-label="Schließen"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
              {seedToast && (
                <div
                  className="fixed top-4 right-4 z-[60] max-w-[360px] px-3.5 py-2.5 rounded-[var(--tf-radius-lg)] bg-[var(--tf-bg)] text-[12.5px] text-[var(--tf-text)] shadow-lg animate-in fade-in slide-in-from-top-2"
                  style={{ border: '0.5px solid var(--tf-border)' }}
                  role="status"
                >
                  <div className="flex items-start gap-2">
                    <span>📦</span>
                    <div className="flex-1">{seedToast}</div>
                    <button
                      type="button"
                      onClick={() => setSeedToast(null)}
                      className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
                      aria-label="Schließen"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
              {syncToast && (
                <div
                  className="fixed top-16 right-4 z-[60] max-w-[360px] px-3.5 py-2.5 rounded-[var(--tf-radius-lg)] bg-[var(--tf-bg)] text-[12.5px] text-[var(--tf-text)] shadow-lg animate-in fade-in slide-in-from-top-2"
                  style={{ border: '0.5px solid var(--tf-border)' }}
                  role="status"
                >
                  <div className="flex items-start gap-2">
                    <span>📥</span>
                    <div className="flex-1">{syncToast}</div>
                    <button
                      type="button"
                      onClick={() => setSyncToast(null)}
                      className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
                      aria-label="Schließen"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
            </TourContext.Provider>
          </TagContext.Provider>
        </SearchContext.Provider>
      </ProfileContext.Provider>
    </AIBridgeContext.Provider>
  );
}

function hideLoader(): void {
  const loader = document.getElementById('tf-loader');
  if (loader) {
    loader.classList.add('tf-loader-hide');
    setTimeout(() => loader.remove(), 300);
  }
  if (typeof (window as any).__tfLoaderCleanup === 'function') {
    (window as any).__tfLoaderCleanup();
  }
}

function AppInner({ storage }: { storage: StorageService }): React.ReactElement {
  const aiBridge = useMemo(() => new AIBridge(), []);
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showStartup, setShowStartup] = useState(false);
  const [needsDowngrade, setNeedsDowngrade] = useState(false);
  const [needsInitialPick, setNeedsInitialPick] = useState(false);
  // v4.0: Der Daten-Share ist umgezogen (Config-Generation > gespeicherte).
  const [needsShareUmzug, setNeedsShareUmzug] = useState(false);
  const [initialProfile, setInitialProfile] = useState<UserProfile | null>(null);
  const [seedToast, setSeedToast] = useState<string | null>(null);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  // v2.16: Rollen-Passwort-Wall (pl + kurator, runtimeConfig.auth). Loest die
  // v2.10-Kurator-Wall ab — vereinheitlicht ueber AppPasswordGate.
  const [showAppGate, setShowAppGate] = useState(false);
  // v2.11: MA-Login-Wall (nur prod-Variante, maLogin).
  const [showMaLoginGate, setShowMaLoginGate] = useState(false);

  useEffect(() => {
    document.title = runtimeConfig.build.browserTabTitle;
  }, []);

  // Tab-Wakeup-Permission-Probe: bei sichtbarem Tab queryPermission auf die
  // Handles, useConnectionState updaten. Nur queryPermission (kein User-Gesture).
  // Wenn Permission entzogen → mode='offline' → OfflineBanner wird sichtbar.
  const probeIsKurator = initialProfile?.is_kurator === true || initialProfile?.is_admin === true;
  useVisibilityPermissionProbe(ready ? storage.idb : null, probeIsKurator);

  const refreshHandleGate = useCallback(async (profile: UserProfile | null): Promise<void> => {
    // v2.0.1: WelcomeScreen-Anzeige haengt an `allowUserToChangePath` (der Picker
    // ist nur sichtbar wenn der User den Pfad aendern darf). StartupScreen ist
    // davon entkoppelt — er fordert nur Permission fuer einen Handle an, der
    // schon in IDB liegt, ODER triggert einen Initial-Pick wenn das IDB leer
    // ist und der Daten-Share-Pfad fix vorgegeben wurde.
    const handle = await getDatenShareHandle(storage.idb);
    const isKurator = profile?.is_kurator === true || profile?.is_admin === true;

    if (!handle) {
      if (dataConfig.allowUserToChangePath) {
        // User darf den Pfad waehlen → WelcomeScreen.
        setShowWelcome(true);
        setShowStartup(false);
        setNeedsInitialPick(false);
      } else {
        // PL/Prod/Kurator-Variante mit fixedDataSharePath aber leerem IDB:
        // StartupScreen mit Pfad-Hint + "Datenordner verbinden"-Button.
        setShowWelcome(false);
        setNeedsInitialPick(true);
        setNeedsDowngrade(false);
        setShowStartup(true);
      }
      return;
    }

    setShowWelcome(false);
    setNeedsInitialPick(false);

    // v4.0: Umzugs-Gate VOR dem Downgrade-Block. Ein FSAPI-Handle haengt am
    // Dateisystem-Objekt, nicht am Anzeigepfad — ein neuer `fixedDataSharePath`
    // allein wuerde von einer bestehenden Installation schlicht ignoriert und
    // sie schriebe weiter in den alten Ordner. Der Handle bleibt dabei stehen:
    // bricht der Anwender den Picker ab, landet er im alten, funktionierenden
    // Zustand statt in einem leeren.
    if (brauchtShareUmzug(await leseShareGeneration(storage.idb), dataConfig.shareGeneration)) {
      setNeedsShareUmzug(true);
      setNeedsDowngrade(false);
      setShowStartup(true);
      return;
    }
    setNeedsShareUmzug(false);

    // v2.0: StartupScreen anzeigen, damit Permissions in einem User-Gesture-
    // Handler aktualisiert werden koennen.
    //
    // Das Downgrade-Flag ist rollen-spezifisch und liegt in der IndexedDB. Seit
    // v2.87 ist die IDB pro Build-Variante getrennt (`teamflow-<outputFilename>`),
    // sodass das fruehere Cross-Varianten-Szenario strukturell ausgeschlossen ist:
    // prod setzte das Flag in der unter `file://` GETEILTEN `teamflow`-DB, ein
    // parallel offener pl-/kurator-Tab befolgte es und stufte sich grundlos auf
    // `read` herunter → stille NotAllowedError-Writes, Datenverlust
    // (Juni-2026-Vorfall). Der `writeRole`-Guard bleibt als Defense-in-Depth:
    // Schreib-Rollen ignorieren ein gesetztes Flag und raeumen ein fremd-gesetztes
    // weg (Pitfall #25: Mode-Entscheidung ausschliesslich ueber canWriteDatenShare).
    const writeRole = canWriteDatenShare(isKurator);
    const downgradeFlag = await storage.idb.get<boolean>(NEEDS_HANDLE_DOWNGRADE_IDB_KEY);
    const liveDowngrade = writeRole
      ? false
      : (downgradeFlag === true ? true : await needsDatenShareDowngrade(storage.idb, { isKurator }));
    if (writeRole && downgradeFlag) {
      await storage.idb.delete(NEEDS_HANDLE_DOWNGRADE_IDB_KEY);
    } else if (liveDowngrade) {
      await storage.idb.set(NEEDS_HANDLE_DOWNGRADE_IDB_KEY, true);
    }
    setNeedsDowngrade(liveDowngrade);
    setShowStartup(true);

    // ConnectionState bereits mit dem aktuellen Persoenlich-Sync-Stand ergaenzen
    try {
      const programme = await listProgramme(storage.idb);
      const first = programme[0];
      if (first) {
        const verKey = `snapshot-version-${first.id}`;
        // snapshot-version-<id> haelt einen ISO-String (siehe snapshot-keys.ts),
        // kein { ts }-Objekt — direkt als String lesen.
        const ver = await storage.idb.get<string>(verKey);
        if (ver) useConnectionState.getState().setLastSyncTimestamp(ver);
      }
    } catch {
      /* best-effort */
    }
  }, [storage]);

  useEffect(() => {
    storage.init().then(async () => {
      // v1.15: Multi-Source-DMS-Migration. Idempotent — laeuft nur einmal,
      // wenn der dms_sources-Store leer ist UND ein Legacy-dokumentenquelle-
      // Handle existiert. Best-effort, blockiert nicht den App-Start.
      try {
        await migrateLegacyDmsSource(storage.idb);
      } catch (e) {
        console.warn('[App] migrateLegacyDmsSource fehlgeschlagen', e);
      }

      // Assistent Phase 0: gerätelokales Ereignisprotokoll initialisieren
      // (Opt-in-Cache hydratisieren + Retention einmalig). Best-effort,
      // blockiert den App-Start nicht; No-op ohne Feature-Flag/Opt-in.
      try {
        await initProtokoll(storage.idb);
      } catch (e) {
        console.warn('[App] initProtokoll fehlgeschlagen', e);
      }

      // Status-System neu: Katalog laden (beim ersten Mal Seed schreiben) und den
      // In-Memory-Snapshot setzen, aus dem getStatusCategory liest. No-op ohne
      // `statusCockpit`-Flag; blockiert den App-Start nicht.
      try {
        await initStatusKatalog(storage.idb);
      } catch (e) {
        console.warn('[App] initStatusKatalog fehlgeschlagen', e);
      }

      // Beta/Experte: das Kurator-Overlay aus dem gerätelokalen Cache. Gilt
      // sofort — auch offline und bevor der Ordner-Picker lief. Die Team-Fassung
      // holt `ladeVomShare` weiter unten nach, sobald der Share wirklich offen
      // ist; ohne diesen Nachlauf läge auf einer frischen Installation die ganze
      // Sitzung die Auslieferungs-Vorbelegung an.
      try {
        await useSichtbarkeitStore.getState().ladeAusCache(storage.idb);
      } catch (e) {
        console.warn('[App] Sichtbarkeits-Overlay (Cache) fehlgeschlagen', e);
      }

      // Assistent Phase 2: Gedächtnis-Store initialisieren (Opt-in-Cache +
      // Retention invalidierter Einträge). Best-effort; No-op ohne Flag/Opt-in.
      try {
        await initGedaechtnis(storage.idb);
      } catch (e) {
        console.warn('[App] initGedaechtnis fehlgeschlagen', e);
      }
      // Fällige Konsolidierung (letzter Lauf > 12 h) fire-and-forget anstoßen —
      // NICHT awaiten (blockiert den App-Start nicht) und ohne KI-Fenster zu
      // erzwingen. No-op ohne Flag/beide Opt-ins/Fälligkeit.
      void starteKonsolidierungWennFaellig(aiBridge).catch((e) => {
        console.warn('[App] Gedächtnis-Konsolidierung (Start) fehlgeschlagen', e);
      });

      // Phase 2 (v8): Slim-List-View-Bulk-Migration. Idempotent — fuellt
      // nur, wenn der Listen-Store fuer ein Programm noch leer/unvollstaendig
      // ist. Blockiert den App-Start einmalig (~5 s bei 13k Records),
      // danach faellt die Antraege-Liste auf <200 ms.
      try {
        const statusEl = document.getElementById('tf-loader-status');
        await ensureListViewProjection(storage.idb, (p) => {
          if (statusEl) {
            statusEl.textContent =
              `Optimiere Anträge-Liste… ${p.done.toLocaleString('de-DE')}/${p.total.toLocaleString('de-DE')}`;
          }
        });
      } catch (e) {
        console.warn('[App] ensureListViewProjection fehlgeschlagen', e);
      }

      // v3.0: Modul-Freischaltungen wiederherstellen — MUSS vor den onInit-Hooks
      // und vor der Gate-Entscheidung stehen. Nur dadurch koennen die
      // Sichtbarkeits-Praedikate synchron bleiben: sie lesen den Store-Zustand,
      // und der ist ab hier fuer den Rest des Starts korrekt. Laeuft der Rehydrate
      // spaeter, sieht das Auslastungs-onInit faelschlich „gesperrt" und der
      // Warmup unterbleibt trotz gueltiger Freischaltung. Zwei IDB-Punktlesungen.
      //
      // v3.27: Steht eine Anmeldung an, wird stattdessen GESCHLOSSEN. Die
      // Anmeldung legt den Freischalt-Zustand fest — sonst zeigt ein Login mit dem
      // Basis-Passwort weiter, was eine fruehere Sitzung geoeffnet hat. Gleiche
      // Stelle, gleiche Invariante, umgekehrtes Vorzeichen.
      if (anmeldungSteht()) {
        await schliesseGesperrteModule(storage.idb);
      } else {
        await Promise.allSettled([
          useKuratorSession.getState().rehydrate(storage.idb),
          useModulFreischaltung.getState().rehydrate(storage.idb),
        ]);
      }
      // v4.59: In Builds OHNE Kurator-Schloss gibt es kein Passwort, das die
      // Sitzung oeffnen koennte — dort ist der Schalter im Profil die einzige
      // Aussage, und die Sitzung folgt ihm. Ohne das lief eine 12-h-Sitzung ab
      // (oder entstand nie), waehrend der Schalter weiter „an" zeigte: die
      // Kurations-Menues standen offen, jede Schreib-Aktion darin war grau.
      // No-op mit Schloss. Dritte IDB-Punktlesung, gleiche Stelle wie oben.
      try {
        const p = await storage.idb.get<UserProfile>('profile');
        await spiegleKuratorSchalterInSession(
          storage.idb, p?.is_kurator === true || p?.is_admin === true,
        );
      } catch (e) {
        console.warn('[App] Kurator-Schalter/Sitzung abgleichen fehlgeschlagen', e);
      }

      // v2.13: Plugin onInit-Hooks parallel + fehlertolerant. Non-blocking
      // — blockiert den App-Start NICHT, laeuft im Hintergrund. Plugins
      // nutzen das zum Pre-Cache von Sidecar-Dateien (z.B. Auslastung laedt
      // auslastung.json + kuerzel-map waehrend der User noch auf Home steht).
      // Erster Aufruf der Plugin-Seite findet die Daten schon im Store.
      void Promise.allSettled(
        enabledPlugins
          .filter(p => p.onInit)
          .map(p => p.onInit!({ storage }).catch(err => {
            console.warn(`[App] Plugin ${p.id} onInit fehlgeschlagen:`, err);
          })),
      );

      // Variante „local": Profil einmalig seeden, BEVOR das Onboarding-Gate
      // greift. Ohne das landet die per Definition leere Varianten-IDB bei
      // jedem ersten Start im Onboarding-Formular und `refreshHandleGate`
      // laeuft gar nicht erst. No-op ausserhalb der Variante (Dead Code im Build).
      if (__TEAMFLOW_LOCAL_FS__) {
        try {
          await sorgeFuerLokalesProfil(storage.idb);
        } catch (e) {
          console.warn('[App] local-fs Profil-Seed fehlgeschlagen', e);
        }
      }

      const complete = await storage.idb.get<boolean>('onboarding-complete');
      if (complete) {
        const profile = await storage.idb.get<UserProfile>('profile');
        if (profile) {
          // Alle drei Werte der Farbe, nicht nur den Farbton: `applyThemeColor`
          // setzt sonst Standard-Sättigung und -Helligkeit ein und die App
          // startet in einer anderen Farbe, als das Profil sagt.
          {
            const f = farbeAusProfil(profile.theme);
            applyThemeColor(f.h, f.s, f.l);
          }
          setDarkMode(profile.theme.dark);
          setInitialProfile(profile);
        }
        setShowOnboarding(false);
        // Nach Onboarding-Complete: Welcome zeigen, wenn kein Daten-Share-Handle.
        await refreshHandleGate(profile);
      } else {
        setShowOnboarding(true);
      }

      // Load AI provider config. Auch fuer 'streamlit' anwenden, damit die in
      // den Einstellungen gespeicherte Streamlit-URL beim Start wirksam wird
      // (switchProvider nutzt updateUrl() → kein Listener-Leak).
      const aiConfig = await storage.idb.get<AIProviderConfig>('ai-provider');
      if (aiConfig && aiConfig.endpoint) {
        aiBridge.switchProvider(aiConfig);
      }

      // v2.61.2: Rollen-Passwort-Wall (pl/kurator) bereits beim Init entscheiden,
      // damit sie VOR dem StartupScreen/Stepper rendert (erst anmelden, dann Ordner
      // freigeben). Pur — nur auth-Config + sessionStorage, keine Handle-Abhängigkeit.
      setShowAppGate(anmeldungSteht());

      // `window.__tf` fuer programmatische Steuerung (Sicht-Check/Automation).
      // No-op ohne devFixtures; in Prod-Builds entfernt Rollup den Zweig.
      installiereTfHook(storage);

      setReady(true);
      hideLoader();
    }).catch(err => {
      console.error('[App] Initialisierung fehlgeschlagen:', err);
      const statusEl = document.getElementById('tf-loader-status');
      if (statusEl) {
        statusEl.textContent = err instanceof Error ? err.message : 'Initialisierung fehlgeschlagen';
        statusEl.style.color = '#b04040';
        statusEl.style.maxWidth = '480px';
        statusEl.style.textAlign = 'center';
        statusEl.style.padding = '0 16px';
      }
      if (typeof (window as any).__tfLoaderCleanup === 'function') {
        (window as any).__tfLoaderCleanup();
      }
    });
  }, [storage, aiBridge, refreshHandleGate]);

  // v2.16/v2.61.2: Die Rollen-Passwort-Wall (pl + kurator, `runtimeConfig.auth`)
  // wird jetzt beim Init entschieden (siehe oben) — sie rendert VOR dem
  // StartupScreen/Stepper. Kein eigener decideAppGate-Schritt nach dem Startup mehr.

  // v2.11: Entscheidet NACH dem StartupScreen ueber die MA-Login-Wall (prod).
  //  - Flag aus → keine Wall.
  //  - rehydrierte sessionStorage-Session (Same-Tab-Reload) → keine Wall.
  //  - Zugangsdatei existiert + nicht angemeldet → Pflicht-Login.
  //  - Zugangsdatei fehlt → ueberspringen (Fallback aufs alte Kuerzelfeld).
  // Mutual-exclusive zur Rollen-Passwort-Wall (v2.16): prod hat maLogin, pl/kurator
  // haben auth.required + maLogin:false — nie beides → die Gates kollidieren nicht.
  const decideMaGate = useCallback(async (): Promise<void> => {
    if (!isMaLoginEnabled()) { setShowMaLoginGate(false); return; }
    if (useMAIdentity.getState().istAngemeldet) { setShowMaLoginGate(false); return; }
    await useMAIdentity.getState().pruefeZugangsdatei(storage.idb);
    setShowMaLoginGate(useMAIdentity.getState().zugangsdateiVorhanden);
  }, [storage]);

  const handleStartupReady = useCallback(async (): Promise<void> => {
    setShowStartup(false);
    await decideMaGate();
  }, [decideMaGate]);

  const handleOnboardingComplete = useCallback(async () => {
    setShowOnboarding(false);
    const profile = await storage.idb.get<UserProfile>('profile');
    if (profile) {
      // Wie im Init-Pfad oben: seit der Wiederherstellung aus dem persönlichen
      // Ordner kann das Onboarding mit dark=true enden — ohne das hier bliebe
      // der Dark-Mode bis zum nächsten Start aus.
      setDarkMode(profile.theme.dark);
      setInitialProfile(profile);
    }
    await refreshHandleGate(profile);
  }, [refreshHandleGate, storage]);

  // v4.0: Nach dem Umzugs-Re-Pick nicht direkt durchstarten, sondern das
  // Handle-Gate erneut auswerten — der Downgrade-Check wurde beim Umzug
  // uebersprungen und soll im selben Start nachgeholt werden.
  const handleUmzugFertig = useCallback(async (): Promise<void> => {
    const profile = await storage.idb.get<UserProfile>('profile');
    await refreshHandleGate(profile);
  }, [refreshHandleGate, storage]);

  // Wenn der Welcome-Screen Daten-Share verbindet, soll danach der Startup-
  // Screen die Permissions in einer User-Gesture-Kette aushandeln.
  const handleWelcomeComplete = useCallback(async () => {
    setShowWelcome(false);
    const profile = await storage.idb.get<UserProfile>('profile');
    await refreshHandleGate(profile);
  }, [refreshHandleGate, storage]);

  // Demo-Daten-Auto-Seed: Wenn data.demoDataBundled aktiv ist und die IDB
  // noch keinen `seed-complete`-Marker trägt, lädt seedTestData() die
  // Förderanträge aus den anonymisierten Fixture-CSVs (docs/fixtures/).
  // seedTestData() ist idempotent — zweiter Aufruf liefert 0 und kein Toast.
  useEffect(() => {
    if (!ready || showOnboarding || showWelcome || showStartup || showAppGate || showMaLoginGate || !isDemoDataBundled()) return;
    let cancelled = false;
    (async () => {
      const result = await seedTestData(storage);
      if (cancelled) return;
      if (result.antraege > 0) {
        setSeedToast(`Demo-Daten geladen (${result.antraege} Förderanträge)`);
        setTimeout(() => setSeedToast(null), 5000);
      }
    })();
    return () => { cancelled = true; };
  }, [ready, showOnboarding, showWelcome, showStartup, showAppGate, showMaLoginGate, storage]);

  // Snapshot-Sync — non-blocking, nach App-Start.
  // syncToastTimerRef haelt die ID des aktuell laufenden Auto-Dismiss-Timers.
  // Bei einem zweiten Sync innerhalb von 6s wird der alte Timer geclearet,
  // sodass der neue Toast volle 6s sichtbar bleibt (ohne wuerde der erste
  // Timer den zweiten Toast vorzeitig clearen).
  const syncToastTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!ready || showOnboarding || showWelcome || showStartup || showAppGate || showMaLoginGate) return;
    let cancelled = false;
    // v2.62.5: Sync-Start ins Idle-Window NACH dem First-Paint verschieben.
    // Der Effekt feuerte bisher sofort bei App-ready — am ersten Start des
    // Tages laeuft dann der Store-Reload (mehrere Sekunden IDB-Writes) genau
    // parallel zum Homepage-List-View-Load und verlaengert „bis Antraege
    // sichtbar" spuerbar (Citrix). Semantik unveraendert, nur spaeter.
    const cancelIdle = scheduleIdle(() => {
      if (cancelled) return;
      void (async () => {
        const handle = await getDatenShareHandle(storage.idb);
        if (!handle) {
          // Kein Daten-Share → kein Start-Pass; Watcher darf trotzdem arbeiten.
          useStartupDataStatus.getState().setPhase('done');
          return;
        }
        // Die Status-Fassung holt `runDataUpdate` selbst nach (`zieheFassungNach`,
        // vor dem Snapshot-Sync) — hier lief bis v6.57.2 ein eigener, einmaliger
        // Nachlauf, weil `initStatusKatalog` oben VOR dem Ordner-Picker liegt.
        // Dasselbe Nachlauf-Muster für die Beta/Experte-Kuration: oben lief nur
        // der Cache, hier steht der Share offen.
        try {
          await useSichtbarkeitStore.getState().ladeVomShare(storage.idb);
        } catch (e) {
          console.warn('[App] Sichtbarkeits-Overlay (Share) fehlgeschlagen', e);
        }
        if (cancelled) return;
        // EIN orchestrierter Pfad (v2.95): Datenbestand (Snapshot, je Programm)
        // → Export-CSV (Check + Auto-Import, nur pl/kurator). Reihenfolge,
        // force-Throttle-Bypass, Cold-Start-ensureDefaultProgramm, Store-Reload,
        // Phase-2-Rematch, Build-Lock-Handling + das Per-Phasen-Timing
        // (`[data-update]`-Konsolenzeile) stecken alle in runDataUpdate.
        // `running` markiert den Pass, damit der Snapshot-Watcher nicht parallel
        // seinen „Jetzt laden"-Banner für genau diesen Snapshot zeigt.
        useStartupDataStatus.getState().setPhase('running');
        let lastLabel: string | null = null;
        let lastPct = -1;
        try {
          const r = await runDataUpdate(storage.idb, handle, {
            signal: { get cancelled() { return cancelled; } },
            onPhase: p => {
              if (cancelled) return;
              const label = phaseToastLabel(p);
              const pct = Math.round(p.fraction * 100);
              // Gedrosselt: nur bei Label- ODER Prozent-Wechsel in den Store
              // schreiben → der Fortschritts-Banner re-rendert max. ~100×/Phase
              // statt bei jedem feinkörnigen fraction-Tick.
              if (label !== lastLabel || pct !== lastPct) {
                lastLabel = label;
                lastPct = pct;
                useStartupDataStatus.getState().setProgress({ label, fraction: p.fraction });
              }
            },
          });
          if (cancelled) return;
          // Divergenz, Drift, Fehler aus DIESEM Lauf zum Banner reichen — der
          // Toast unten verschwindet nach 6 s, und die Quellen sind danach
          // gestempelt, also keine Kandidaten mehr (siehe start-bericht.ts).
          useStartBericht.getState().setBericht(r.csvReport ?? null);
          const finalMsg = completionToast(r);
          if (finalMsg) {
            setSyncToast(finalMsg);
            if (syncToastTimerRef.current !== null) window.clearTimeout(syncToastTimerRef.current);
            syncToastTimerRef.current = window.setTimeout(() => {
              syncToastTimerRef.current = null;
              if (!cancelled) setSyncToast(null);
            }, 6000);
          } else {
            // Nichts Neues — laufenden Fortschritts-Toast wieder ausblenden.
            setSyncToast(null);
          }
        } finally {
          // Fortschritts-Banner ausblenden, sobald der Pass endet (Erfolg,
          // „nichts Neues" oder Abbruch).
          useStartupDataStatus.getState().setProgress(null);
          // Pass abgeschlossen → Watcher darf (ab jetzt) Banner für ECHTE,
          // erst danach geschriebene Fremd-Snapshots zeigen. Bei einem
          // gecancelten Re-Run (Gate-Übergang) NICHT auf 'done' flippen — der
          // frische, nicht-gecancelte Lauf setzt es; sonst stünde der Watcher
          // kurz auf 'done' während der eigentliche Sync noch läuft.
          if (!cancelled) {
            useStartupDataStatus.getState().setPhase('done');
            // Schemas/Quellen können jetzt frisch in der IDB liegen → Banner-
            // Check re-triggern (zeigt verbleibende unverknüpfte Quellen / Drift).
            bumpCsvSourcesSignal();
          }
        }
      })();
    });
    return () => {
      cancelled = true;
      cancelIdle();
      if (syncToastTimerRef.current !== null) {
        window.clearTimeout(syncToastTimerRef.current);
        syncToastTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, showOnboarding, showWelcome, showStartup, showAppGate, showMaLoginGate]);

  if (!ready) return <></>;

  return (
    <AppProviders
      storage={storage}
      aiBridge={aiBridge}
      showOnboarding={showOnboarding}
      setShowOnboarding={handleOnboardingComplete as unknown as (v: boolean) => void}
      showWelcome={showWelcome}
      setShowWelcome={handleWelcomeComplete as unknown as (v: boolean) => void}
      showStartup={showStartup}
      onStartupReady={() => void handleStartupReady()}
      needsShareUmzug={needsShareUmzug}
      onUmzugFertig={() => void handleUmzugFertig()}
      showAppGate={showAppGate}
      setShowAppGate={setShowAppGate}
      showMaLoginGate={showMaLoginGate}
      setShowMaLoginGate={setShowMaLoginGate}
      needsDowngrade={needsDowngrade}
      needsInitialPick={needsInitialPick}
      initialProfile={initialProfile}
      seedToast={seedToast}
      setSeedToast={setSeedToast}
      syncToast={syncToast}
      setSyncToast={setSyncToast}
    />
  );
}

export function App(): React.ReactElement {
  const storage = useMemo(() => new StorageService(), []);
  return (
    <ErrorBoundary>
      <StorageContext.Provider value={storage}>
        <AppInner storage={storage} />
      </StorageContext.Provider>
    </ErrorBoundary>
  );
}
