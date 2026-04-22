export interface UserProfile {
  name: string;
  department: 'antraege' | 'bauantraege' | 'beide';
  theme: {
    hue: number;
    dark: boolean;
  };
  /** Wenn true, sind Plugins mit kuratorOnly: true sichtbar (z.B. Suchindex, Feedback-Verwaltung). */
  is_kurator?: boolean;
  /** @deprecated Legacy-Feld vor v1.9; beim Laden als Fallback für is_kurator berücksichtigt. */
  is_admin?: boolean;
}

export interface AIProviderConfig {
  type: 'streamlit' | 'openrouter' | 'internal' | 'cloud';
  endpoint: string;
  model: string;
  apiKey: string;
}

export interface DirectoryEntry {
  id: string;
  label: string;
  type: 'documents' | 'data' | 'models';
  folderName?: string;
  /** 'opfs' = Origin Private File System (Browser-Sandbox, kein echtes Sharing). 'real' (default) = vom User gewählter Ordner. */
  kind?: 'opfs' | 'real';
}

export interface AppConfig {
  profile: UserProfile;
  aiProvider: AIProviderConfig;
  activeProvider: string;
}
