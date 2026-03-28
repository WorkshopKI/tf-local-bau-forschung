import { createContext, useContext } from 'react';

export interface NavigationParams {
  selectedId?: string;
}

interface NavigationContextValue {
  navigate: (pluginId: string, params?: NavigationParams) => void;
}

export const NavigationContext = createContext<NavigationContextValue>({
  navigate: () => {},
});

export function useNavigation(): NavigationContextValue {
  return useContext(NavigationContext);
}
