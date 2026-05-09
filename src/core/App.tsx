import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AppRouter } from '@/core/Router';
import { Onboarding } from '@/core/Onboarding';
import { WelcomeScreen } from '@/core/WelcomeScreen';
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
import { applyThemeColor, setDarkMode } from '@/ui/theme';
import { checkQuarterReset, loadFeedbackConfig } from '@/core/services/feedback';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
import { listProgramme } from '@/core/services/csv';
import { ensureListViewProjection } from '@/core/services/csv/list-view-migration';
import { syncProgrammSnapshot } from '@/core/services/csv/snapshot-sync';
import { rematchOnSnapshotReload } from '@/phase2';
import { migrateLegacyDmsSource } from '@/core/services/dms-sources';
import { runtimeConfig } from '@/config/runtime-config';
import { isDemoDataBundled, dataConfig } from '@/config/feature-flags';
import { seedTestData } from '@/core/services/seed/seed-data';
import type { UserProfile, AIProviderConfig } from '@/core/types/config';

function AppProviders({ storage, aiBridge, showOnboarding, setShowOnboarding, showWelcome, setShowWelcome, department, seedToast, setSeedToast, syncToast, setSyncToast }: {
  storage: StorageService;
  aiBridge: AIBridge;
  showOnboarding: boolean;
  setShowOnboarding: (v: boolean) => void;
  showWelcome: boolean;
  setShowWelcome: (v: boolean) => void;
  department: UserProfile['department'];
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

  const activeDepartment = profileValue.profile?.department ?? department;
  const profileName = profileValue.profile?.name;

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
              ) : showWelcome ? (
                <WelcomeScreen onComplete={() => setShowWelcome(false)} />
              ) : (
                <AppRouter plugins={enabledPlugins} department={activeDepartment} />
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
  const [department, setDepartment] = useState<UserProfile['department']>('beide');
  const [seedToast, setSeedToast] = useState<string | null>(null);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  useEffect(() => {
    document.title = runtimeConfig.build.browserTabTitle;
  }, []);

  const refreshHandleGate = useCallback(async (): Promise<void> => {
    // WelcomeScreen nur anzeigen, wenn die Variante dem User erlaubt, den Pfad selbst zu wählen.
    // Demo-Variante (demoDataBundled=true, allowUserToChangePath=false) und Prod-Variante mit
    // fixedDataSharePath skippen den Picker — die Daten kommen aus dem Bundle bzw. fixen Share.
    if (!dataConfig.allowUserToChangePath) {
      setShowWelcome(false);
      return;
    }
    const handle = await getDatenShareHandle(storage.idb);
    setShowWelcome(!handle);
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

      const complete = await storage.idb.get<boolean>('onboarding-complete');
      if (complete) {
        const profile = await storage.idb.get<UserProfile>('profile');
        if (profile) {
          applyThemeColor(profile.theme.hue);
          setDarkMode(profile.theme.dark);
          setDepartment(profile.department);
        }
        setShowOnboarding(false);
        // Nach Onboarding-Complete: Welcome zeigen, wenn kein Daten-Share-Handle.
        await refreshHandleGate();
      } else {
        setShowOnboarding(true);
      }

      // Load AI provider config
      const aiConfig = await storage.idb.get<AIProviderConfig>('ai-provider');
      if (aiConfig && aiConfig.type !== 'streamlit' && aiConfig.endpoint) {
        aiBridge.switchProvider(aiConfig);
      }

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

  const handleOnboardingComplete = useCallback(async () => {
    setShowOnboarding(false);
    await refreshHandleGate();
  }, [refreshHandleGate]);

  // Demo-Daten-Auto-Seed: Wenn data.demoDataBundled aktiv ist und die IDB
  // noch keinen `seed-complete`-Marker trägt, lädt seedTestData() synthetische
  // Vorgänge/Dokumente/Artefakte. seedTestData() ist idempotent — zweiter Aufruf
  // liefert Nullen und es erscheint kein Toast.
  useEffect(() => {
    if (!ready || showOnboarding || !isDemoDataBundled()) return;
    let cancelled = false;
    (async () => {
      const result = await seedTestData(storage);
      if (cancelled) return;
      if (result.vorgaenge > 0 || result.dokumente > 0 || result.artefakte > 0) {
        setSeedToast(`Demo-Daten geladen (${result.vorgaenge} Vorgänge, ${result.dokumente} Dokumente, ${result.artefakte} Artefakte)`);
        setTimeout(() => setSeedToast(null), 5000);
      }
    })();
    return () => { cancelled = true; };
  }, [ready, showOnboarding, storage]);

  // Snapshot-Sync — non-blocking, nach App-Start.
  // syncToastTimerRef haelt die ID des aktuell laufenden Auto-Dismiss-Timers.
  // Bei einem zweiten Sync innerhalb von 6s wird der alte Timer geclearet,
  // sodass der neue Toast volle 6s sichtbar bleibt (ohne wuerde der erste
  // Timer den zweiten Toast vorzeitig clearen).
  const syncToastTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!ready || showOnboarding) return;
    let cancelled = false;
    (async () => {
      const handle = await getDatenShareHandle(storage.idb);
      if (!handle) return;
      const programme = await listProgramme(storage.idb);
      for (const p of programme) {
        if (cancelled) return;
        const r = await syncProgrammSnapshot(storage.idb, handle, p.id).catch(err => {
          console.warn(`[snapshot-sync] ${p.id} fehlgeschlagen`, err);
          return { synced: false } as const;
        });
        if (!cancelled && r.synced && 'createdAt' in r && r.createdAt) {
          const stamp = new Date(r.createdAt).toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          });
          setSyncToast(`${p.name}: Antragsdaten aktualisiert (Stand: ${stamp})`);
          if (syncToastTimerRef.current !== null) {
            window.clearTimeout(syncToastTimerRef.current);
          }
          syncToastTimerRef.current = window.setTimeout(() => {
            syncToastTimerRef.current = null;
            if (!cancelled) setSyncToast(null);
          }, 6000);
          // Phase-2 Pending-Antrag Re-Match: wenn akronym_index oder antraege
          // neu geladen wurden, ist der Holding-Bucket evtl. abräumbar.
          const reloaded = 'reloadedStores' in r ? (r.reloadedStores ?? []) : [];
          if (reloaded.includes('akronym_index') || reloaded.includes('antraege')) {
            await rematchOnSnapshotReload(storage.idb, p.id).catch(err => {
              console.warn(`[phase2/pending-rematch] ${p.id} fehlgeschlagen`, err);
              return { resolved: 0, remaining: 0 };
            });
          }
        }
      }
    })();
    return () => {
      cancelled = true;
      if (syncToastTimerRef.current !== null) {
        window.clearTimeout(syncToastTimerRef.current);
        syncToastTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, showOnboarding]);

  if (!ready) return <></>;

  return (
    <AppProviders
      storage={storage}
      aiBridge={aiBridge}
      showOnboarding={showOnboarding}
      setShowOnboarding={handleOnboardingComplete as unknown as (v: boolean) => void}
      showWelcome={showWelcome}
      setShowWelcome={setShowWelcome}
      department={department}
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
