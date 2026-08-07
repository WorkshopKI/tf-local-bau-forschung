import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
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
  /**
   * Spiegel des Profils fuer Leser ausserhalb des Renders. Ohne ihn muesste
   * `updateProfile` den `setProfile`-Updater zum Lesen benutzen — React ruft den
   * aber nicht garantiert synchron auf (und in StrictMode zweimal), ein
   * Schreibvorgang darin ist also weder awaitbar noch einmalig.
   */
  const profilRef = useRef<UserProfile | null>(null);

  const setzeProfil = useCallback((p: UserProfile | null) => {
    profilRef.current = p;
    setProfile(p);
  }, []);

  const reloadProfile = useCallback(async () => {
    const raw = await storage.idb.get<Record<string, unknown>>('profile');
    if (!raw) {
      setzeProfil(null);
      return;
    }
    // Legacy-Migration (v1.14): 'forschung' wurde in 'antraege' konsolidiert.
    if (raw.department === 'forschung') {
      const migrated = { ...raw, department: 'antraege' } as UserProfile;
      await storage.idb.set('profile', migrated);
      setzeProfil(migrated);
      return;
    }
    setzeProfil(raw as unknown as UserProfile);
  }, [storage, setzeProfil]);

  useEffect(() => {
    void reloadProfile();
  }, [reloadProfile]);

  /**
   * Loest ERST auf, wenn das Profil in der IDB steht. Aufrufer laden direkt
   * danach neu (Kurator-Freischaltung) — ein nicht abgewarteter Schreibvorgang
   * ginge dabei verloren.
   */
  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    const prev = profilRef.current;
    if (!prev) return;
    const updated = { ...prev, ...updates };
    if (updates.theme) {
      updated.theme = { ...prev.theme, ...updates.theme };
    }
    setzeProfil(updated);
    await storage.idb.set('profile', updated);
  }, [storage, setzeProfil]);

  return { profile, updateProfile, reloadProfile };
}
