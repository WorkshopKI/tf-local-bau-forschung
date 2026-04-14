import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { UserProfile } from "@/types";

export type { UserProfile } from "@/types";

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  authMethod: "email_otp" | "guest" | null;
}

export interface AuthContextType extends AuthState {
  signInWithOTP: (email: string, courseCode: string) => Promise<{ error?: string }>;
  verifyOTP: (email: string, token: string) => Promise<{ error?: string }>;
  signInWithGuestToken: (token: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  upgradeGuestToEmail: (email: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("user_profiles")
      .select("id, display_name, auth_method, course_id, preferred_model")
      .eq("id", userId)
      .single();

    if (data) {
      // Check admin role via user_roles table
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      setProfile({
        ...data,
        auth_method: data.auth_method as "email_otp" | "guest",
        is_admin: !!roleData,
        preferred_model: (data as Record<string, unknown>).preferred_model as string ?? "google/gemini-3-flash-preview",
      });
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Defer profile load to avoid Supabase deadlocks
          setTimeout(() => loadProfile(session.user.id), 0);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signInWithOTP = async (email: string, courseCode: string): Promise<{ error?: string }> => {
    // Step 1: Check enrollment via edge function
    const { data, error: fnError } = await supabase.functions.invoke("check-enrollment", {
      body: { courseCode, email },
    });

    if (fnError) return { error: "Verbindungsfehler. Bitte versuche es erneut." };
    if (!data?.allowed) return { error: data?.reason || "Einschreibung nicht möglich." };

    // Step 2: Send OTP
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });
    if (error) return { error: error.message };
    return {};
  };

  const verifyOTP = async (email: string, token: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) return { error: "Der Code ist ungültig oder abgelaufen. Bitte fordere einen neuen an." };
    return {};
  };

  const signInWithGuestToken = async (token: string): Promise<{ error?: string }> => {
    const { data, error: fnError } = await supabase.functions.invoke("guest-login", {
      body: { token },
    });

    if (fnError || data?.error) {
      return { error: data?.error || "Dieser Gast-Code ist ungültig oder abgelaufen." };
    }

    if (data?.session) {
      const { error } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (error) return { error: error.message };
    }
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const upgradeGuestToEmail = async (email: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });
    if (error) return { error: error.message };
    return {};
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    isLoading,
    isLoggedIn: !!session,
    authMethod: profile?.auth_method ?? null,
    signInWithOTP,
    verifyOTP,
    signInWithGuestToken,
    signOut,
    upgradeGuestToEmail,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
