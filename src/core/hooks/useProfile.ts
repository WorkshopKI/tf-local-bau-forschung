import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { UserProfile } from '@/core/types/config';
import type { StorageService } from '@/core/services/storage';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { savePersonalSettings } from '@/core/services/personal-storage';

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
   * Spiegelt das Profil best-effort in den persoenlichen Ordner
   * (`<pers>/ZAH/profile.json`).
   *
   * Diese Kopie ist die einzige Rettung, wenn die varianten-eigene IndexedDB
   * verloren geht (Browser-Eviction, zurueckgesetztes Citrix-Profil, Wechsel
   * der Build-Variante) — `restoreFromPers` im Onboarding liest sie. Bis v4.116
   * wurde sie GENAU EINMAL geschrieben, beim Einrichten: wiederhergestellt kam
   * damit der Stand des Einrichtungstags zurueck, und alles seither Gesetzte
   * (Kuerzel gewechselt, Kurator-Flagge, Beta/Experte, Anzahl auf der
   * Startseite) war fort, ohne dass jemand es sagte.
   *
   * NICHT abgewartet: Aufrufer wie die Farbwahl klicken schnell hintereinander,
   * und ein SMB-Schreibvorgang haengt an der Netzlaufzeit. Die Schreibvorgaenge
   * reihen sich stattdessen an einer Kette auf, damit ein spaeterer Stand nicht
   * von einem frueheren ueberholt wird. Fehler bleiben stumm — die IDB ist die
   * Wahrheit, der Spiegel nur die Rettungskopie (`savePersonalSettings`
   * schluckt sie ohnehin).
   */
  const spiegelKette = useRef<Promise<void>>(Promise.resolve());
  const spiegleInsPersoenliche = useCallback((p: UserProfile) => {
    spiegelKette.current = spiegelKette.current
      .catch(() => {})
      .then(async () => {
        const handle = await getPersoenlichHandle(storage.idb).catch(() => null);
        await savePersonalSettings(storage.idb, handle, { profile: p });
      })
      .catch(() => {});
  }, [storage]);

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
    spiegleInsPersoenliche(updated);
  }, [storage, setzeProfil, spiegleInsPersoenliche]);

  return { profile, updateProfile, reloadProfile };
}
