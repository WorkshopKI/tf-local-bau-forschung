import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { UserProfile } from '@/core/types/config';
import type { StorageService } from '@/core/services/storage';

interface ProfileContextValue {
  profile: UserProfile | null;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  updateProfile: async () => {},
});

export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}

export function useProfileProvider(storage: StorageService): ProfileContextValue {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    storage.idb.get<UserProfile>('profile').then(p => {
      if (p) setProfile(p);
    });
  }, [storage]);

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

  return { profile, updateProfile };
}
