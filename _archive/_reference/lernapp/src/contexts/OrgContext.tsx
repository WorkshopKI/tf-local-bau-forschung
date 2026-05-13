import { createContext, useContext, useState, type ReactNode } from "react";
import type { OrgScope } from "@/types";
import { loadStringFromStorage } from "@/lib/storage";
import { LS_KEYS } from "@/lib/constants";

export type { OrgScope } from "@/types";

export const ORG_SCOPE_LABELS: Record<OrgScope, string> = {
  privat: "Privatgebrauch",
  organisation: "Gesamte Organisation",
  legal: "Abteilung Legal",
  oeffentlichkeitsarbeit: "Abteilung Öffentlichkeitsarbeit",
  hr: "Abteilung HR",
  it: "Abteilung IT",
  bauverfahren: "Fachabteilung Bauverfahren",
};

export const DEPARTMENTS: OrgScope[] = ["legal", "oeffentlichkeitsarbeit", "hr", "it", "bauverfahren"];

interface OrgContextType {
  scope: OrgScope;
  setScope: (scope: OrgScope) => void;
  isDepartment: boolean;
  isOrg: boolean;
  scopeLabel: string;
}

const OrgContext = createContext<OrgContextType | null>(null);

export const OrgProvider = ({ children }: { children: ReactNode }) => {
  const [scope, setScopeState] = useState<OrgScope>(
    () => loadStringFromStorage(LS_KEYS.ORG_SCOPE, "privat") as OrgScope
  );

  const setScope = (s: OrgScope) => {
    setScopeState(s);
    localStorage.setItem(LS_KEYS.ORG_SCOPE, s);
  };

  const isDepartment = DEPARTMENTS.includes(scope);
  const isOrg = scope !== "privat";

  return (
    <OrgContext.Provider value={{ scope, setScope, isDepartment, isOrg, scopeLabel: ORG_SCOPE_LABELS[scope] }}>
      {children}
    </OrgContext.Provider>
  );
};

export const useOrgContext = () => {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrgContext must be inside OrgProvider");
  return ctx;
};
