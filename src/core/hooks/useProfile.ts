import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { UserProfile } from '@/core/types/config';
import type { StorageService } from '@/core/services/storage';

interface ProfileContextValue {
  profile: UserProfile | null;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  /** Lädt das Profil aus IDB neu. Nach Onboarding-Complete aufrufen. */
  reloadProfile: () => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  updateProfile: async () => {},
  reloadProfile: async () => {},
});

export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}

export function useProfileProvider(storage: StorageService): ProfileContextValue {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const reloadProfile = useCallback(async () => {
    const raw = await storage.idb.get<Record<string, unknown>>('profile');
    if (!raw) {
      setProfile(null);
      return;
    }
    // Legacy-Migration (v1.14): 'forschung' wurde in 'antraege' konsolidiert.
    if (raw.department === 'forschung') {
      const migrated = { ...raw, department: 'antraege' } as UserProfile;
      await storage.idb.set('profile', migrated);
      setProfile(migrated);
      return;
    }
    setProfile(raw as unknown as UserProfile);
  }, [storage]);

  useEffect(() => {
    void reloadProfile();
  }, [reloadProfile]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    setProfile(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      if (updates.theme) {
        updated.theme = { ...prev.theme, ...updates.theme };
      }
      storage.idb.set('profile', updated);
      return updated;
    });
  }, [storage]);

  return { profile, updateProfile, reloadProfile };
}
