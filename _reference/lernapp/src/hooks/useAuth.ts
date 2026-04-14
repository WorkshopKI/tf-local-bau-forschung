// Re-export from AuthContext for backward compatibility
// Components using useAuth() continue to work
import { useAuthContext } from "@/contexts/AuthContext";

export const useAuth = () => {
  try {
    const ctx = useAuthContext();
    return {
      user: ctx.user,
      session: ctx.session,
      loading: ctx.isLoading,
      signUp: async () => ({ error: new Error("Use AuthContext signInWithOTP") }),
      signIn: async () => ({ error: new Error("Use AuthContext signInWithOTP") }),
      signOut: ctx.signOut,
    };
  } catch {
    // Fallback when not inside AuthProvider (shouldn't happen)
    return {
      user: null,
      session: null,
      loading: false,
      signUp: async () => ({ error: new Error("AuthProvider not found") }),
      signIn: async () => ({ error: new Error("AuthProvider not found") }),
      signOut: async () => {},
    };
  }
};
