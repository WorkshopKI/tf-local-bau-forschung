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
import { ErrorBoundary } from '@/core/ErrorBoundary';
import { applyThemeColor, setDarkMode } from '@/ui/theme';
import type { UserProfile } from '@/core/types/config';

function AppInner({ storage }: { storage: StorageService }): React.ReactElement {
  const aiBridge = useMemo(() => new AIBridge(), []);
  const searchValue = useSearchProvider(storage);
  const tagValue = useTagProvider(storage);
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    storage.init().then(async () => {
      const complete = await storage.idb.get<boolean>('onboarding-complete');
      if (complete) {
        const profile = await storage.idb.get<UserProfile>('profile');
        if (profile) {
          applyThemeColor(profile.theme.hue);
          setDarkMode(profile.theme.dark);
        }
        setShowOnboarding(false);
      } else {
        setShowOnboarding(true);
      }
      setReady(true);
    });
  }, [storage]);

  if (!ready) return <div />;

  return (
    <AIBridgeContext.Provider value={aiBridge}>
      <SearchContext.Provider value={searchValue}>
        <TagContext.Provider value={tagValue}>
          {showOnboarding ? (
            <Onboarding onComplete={() => setShowOnboarding(false)} />
          ) : (
            <Shell plugins={enabledPlugins} />
          )}
        </TagContext.Provider>
      </SearchContext.Provider>
    </AIBridgeContext.Provider>
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
