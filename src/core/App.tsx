import { useState, useEffect, useMemo } from 'react';
import { Shell } from '@/core/Shell';
import { Onboarding } from '@/core/Onboarding';
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
import type { UserProfile, AIProviderConfig } from '@/core/types/config';

function AppProviders({ storage, aiBridge, showOnboarding, setShowOnboarding, department }: {
  storage: StorageService;
  aiBridge: AIBridge;
  showOnboarding: boolean;
  setShowOnboarding: (v: boolean) => void;
  department: UserProfile['department'];
}): React.ReactElement {
  const searchValue = useSearchProvider(storage);
  const tagValue = useTagProvider(storage);
  const profileValue = useProfileProvider(storage);
  const tourValue = useTour(TOUR_STEPS.length);

  const activeDepartment = profileValue.profile?.department ?? department;

  return (
    <AIBridgeContext.Provider value={aiBridge}>
      <ProfileContext.Provider value={profileValue}>
        <SearchContext.Provider value={searchValue}>
          <TagContext.Provider value={tagValue}>
            <TourContext.Provider value={tourValue}>
              {showOnboarding ? (
                <Onboarding onComplete={() => setShowOnboarding(false)} />
              ) : (
                <Shell plugins={enabledPlugins} department={activeDepartment} />
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
  const [department, setDepartment] = useState<UserProfile['department']>('beide');

  useEffect(() => {
    storage.init().then(async () => {
      const complete = await storage.idb.get<boolean>('onboarding-complete');
      if (complete) {
        const profile = await storage.idb.get<UserProfile>('profile');
        if (profile) {
          applyThemeColor(profile.theme.hue);
          setDarkMode(profile.theme.dark);
          setDepartment(profile.department);
        }
        setShowOnboarding(false);
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
    });
  }, [storage, aiBridge]);

  if (!ready) return <></>;

  return (
    <AppProviders
      storage={storage}
      aiBridge={aiBridge}
      showOnboarding={showOnboarding}
      setShowOnboarding={setShowOnboarding}
      department={department}
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
