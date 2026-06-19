import { createContext, useContext } from 'react';

export interface NavigationParams {
  selectedId?: string;
  /** Optionaler Unter-View des Ziels (z.B. `'versionen'` für den Skill-Editor-Reiter). */
  view?: string;
}

interface NavigationContextValue {
  navigate: (pluginId: string, params?: NavigationParams) => void;
  /** Aktuell aktive Plugin-ID (für Kontext-Erfassung in Feedback etc.). */
  activeId: string;
}

export const NavigationContext = createContext<NavigationContextValue>({
  navigate: () => {},
  activeId: '',
});

export function useNavigation(): NavigationContextValue {
  return useContext(NavigationContext);
}
