import { useState, useEffect, useMemo } from 'react';
import { Shell } from '@/core/Shell';
import { Onboarding } from '@/core/Onboarding';
import { enabledPlugins } from '@/plugins.config';
import { StorageService } from '@/core/services/storage';
import { StorageContext } from '@/core/hooks/useStorage';
import { applyThemeColor, setDarkMode } from '@/ui/theme';
import type { UserProfile } from '@/core/types/config';

export function App(): React.ReactElement {
  const storage = useMemo(() => new StorageService(), []);
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
    <StorageContext.Provider value={storage}>
      {showOnboarding ? (
        <Onboarding onComplete={() => setShowOnboarding(false)} />
      ) : (
        <Shell plugins={enabledPlugins} />
      )}
    </StorageContext.Provider>
  );
}
