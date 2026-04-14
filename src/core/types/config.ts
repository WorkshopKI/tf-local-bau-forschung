export interface UserProfile {
  name: string;
  department: 'bauantraege' | 'forschung' | 'beide';
  theme: {
    hue: number;
    dark: boolean;
  };
  /** Wenn true, sind Plugins mit adminOnly: true sichtbar (z.B. Suchindex, Feedback-Verwaltung). */
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
}

export interface AppConfig {
  profile: UserProfile;
  aiProvider: AIProviderConfig;
  activeProvider: string;
}
