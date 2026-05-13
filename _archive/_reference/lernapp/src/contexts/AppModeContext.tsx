import { createContext, useContext, useState, type ReactNode } from "react";
import { loadStringFromStorage } from "@/lib/storage";
import { LS_KEYS } from "@/lib/constants";

export type AppMode = "workshop" | "standalone" | null;

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isWorkshop: boolean;
  isStandalone: boolean;
  isChosen: boolean;
}

const AppModeContext = createContext<AppModeContextType | null>(null);

export const AppModeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<AppMode>(() => {
    const stored = loadStringFromStorage(LS_KEYS.APP_MODE, "");
    if (stored === "workshop" || stored === "standalone") return stored;
    return null;
  });

  const setMode = (m: AppMode) => {
    setModeState(m);
    if (m) {
      localStorage.setItem(LS_KEYS.APP_MODE, m);
    } else {
      localStorage.removeItem(LS_KEYS.APP_MODE);
    }
  };

  return (
    <AppModeContext.Provider
      value={{
        mode,
        setMode,
        isWorkshop: mode === "workshop",
        isStandalone: mode === "standalone",
        isChosen: mode !== null,
      }}
    >
      {children}
    </AppModeContext.Provider>
  );
};

export const useAppMode = () => {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error("useAppMode must be inside AppModeProvider");
  return ctx;
};
