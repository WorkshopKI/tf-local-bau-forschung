export interface UserProfile {
  name: string;
  department: 'bauantraege' | 'forschung' | 'beide';
  theme: {
    hue: number;
    dark: boolean;
  };
}

export interface AIProviderConfig {
  type: 'streamlit' | 'llama-local' | 'openrouter' | 'cloud';
  endpoint: string;
  model: string;
  apiKey: string;
}

export interface DirectoryEntry {
  id: string;
  label: string;
  type: 'documents' | 'data';
  folderName?: string;
}

export interface AppConfig {
  profile: UserProfile;
  aiProvider: AIProviderConfig;
  activeProvider: string;
}
