import { type ReactNode } from "react";
import { AuthContext } from "./AuthContext";
import type { AuthContextType } from "./AuthContext";
import type { UserProfile } from "@/types";
import { loadFromStorage } from "@/lib/storage";
import { LS_KEYS } from "@/lib/constants";
import { DEFAULT_MODEL } from "@/lib/constants";

const defaultProfile: UserProfile = {
  id: "standalone-user",
  display_name: null,
  auth_method: "email_otp",
  course_id: null,
  is_admin: true,
  preferred_model: DEFAULT_MODEL,
};

export const StandaloneAuthProvider = ({ children }: { children: ReactNode }) => {
  const profile = loadFromStorage<UserProfile>(LS_KEYS.STANDALONE_PROFILE, defaultProfile);

  const value: AuthContextType = {
    user: { id: "standalone-user" } as any,
    session: null,
    profile,
    isLoading: false,
    isLoggedIn: true,
    authMethod: "email_otp",
    signInWithOTP: async () => ({ error: "Nicht verfügbar im Standalone-Modus" }),
    verifyOTP: async () => ({ error: "Nicht verfügbar im Standalone-Modus" }),
    signInWithGuestToken: async () => ({ error: "Nicht verfügbar im Standalone-Modus" }),
    signOut: async () => {
      localStorage.removeItem(LS_KEYS.APP_MODE);
      window.location.href = "/";
    },
    upgradeGuestToEmail: async () => ({ error: "Nicht verfügbar im Standalone-Modus" }),
    refreshProfile: async () => {},
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
