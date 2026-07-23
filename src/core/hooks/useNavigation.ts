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
  /**
   * Anzeigename des aktiven Plugins — vom `NavigationBridge` aus der Plugin-Liste
   * aufgelöst, Rückfall auf die ID. Hier und nicht beim Verbraucher, damit eine
   * Blatt-Komponente wie das Feedback-Panel für einen einzigen Namen nicht
   * `@/plugins.config` (= jedes Plugin) laden muss; genau daran hingen die
   * Laufzeit-Zyklen aus dem Konsolidierungs-Pass.
   */
  activeName: string;
}

export const NavigationContext = createContext<NavigationContextValue>({
  navigate: () => {},
  activeId: '',
  activeName: '',
});

export function useNavigation(): NavigationContextValue {
  return useContext(NavigationContext);
}
